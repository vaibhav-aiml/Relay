import { v4 as uuidv4 } from 'uuid';
import { ScheduledRoutine, Task, User } from '@relay/shared-types';
import { IDatabaseRepository } from '../database/types.js';
import { getDatabase } from '../database/index.js';
import { AgentOrchestrator } from '../agent/orchestrator.js';
import { getNextRun } from './cronEvaluator.js';
import { sendPushNotification } from './notifications.js';

export interface SchedulerDaemonOptions {
  tickIntervalMs?: number;
}

export class SchedulerDaemon {
  private static instance: SchedulerDaemon | null = null;
  private db: IDatabaseRepository;
  private orchestrator: AgentOrchestrator;
  private tickIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private runningRoutineIds: Set<string> = new Set();
  private isRunning: boolean = false;

  constructor(db?: IDatabaseRepository, options?: SchedulerDaemonOptions) {
    this.db = db || getDatabase();
    this.orchestrator = new AgentOrchestrator(this.db);
    this.tickIntervalMs = options?.tickIntervalMs || 15_000;
  }

  public static getInstance(db?: IDatabaseRepository, options?: SchedulerDaemonOptions): SchedulerDaemon {
    if (!SchedulerDaemon.instance) {
      SchedulerDaemon.instance = new SchedulerDaemon(db, options);
    }
    return SchedulerDaemon.instance;
  }

  /**
   * Starts the periodic scheduler daemon tick loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[SchedulerDaemon] Starting scheduler daemon (tick interval: ${this.tickIntervalMs}ms)`);

    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        console.error('[SchedulerDaemon] Uncaught error in tick loop:', err);
      });
    }, this.tickIntervalMs);

    // Run an initial tick immediately on start
    this.tick().catch((err) => {
      console.error('[SchedulerDaemon] Error in initial tick:', err);
    });
  }

  /**
   * Stops the periodic scheduler daemon tick loop.
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[SchedulerDaemon] Stopped scheduler daemon');
  }

  /**
   * Evaluates due routines and dispatches active routines.
   * Can be invoked directly in unit tests for deterministic testing.
   */
  public async tick(): Promise<void> {
    const now = new Date();
    const nowIso = now.toISOString();

    let dueRoutines: ScheduledRoutine[] = [];
    try {
      dueRoutines = await this.db.getDueSchedules(nowIso);
    } catch (dbErr: any) {
      console.error('[SchedulerDaemon] Failed to fetch due schedules from DB:', dbErr.message);
      return;
    }

    const dispatches: Promise<any>[] = [];

    for (const due of dueRoutines) {
      // 1. In-flight concurrency lock
      if (this.runningRoutineIds.has(due.id)) {
        continue;
      }

      // 2. Re-fetch fresh state to avoid race conditions with user pausing/deleting
      const routine = await this.db.getSchedule(due.userId, due.id);
      if (!routine || routine.status !== 'active') {
        continue;
      }

      // 3. 5-Minute Catch-Up Window for Server Downtime
      if (routine.scheduleType === 'recurring' && routine.cronExpression) {
        const scheduledTime = new Date(routine.nextRunAt).getTime();
        const diffMs = now.getTime() - scheduledTime;
        const FIVE_MINUTES_MS = 5 * 60 * 1000;

        if (diffMs > FIVE_MINUTES_MS) {
          console.warn(`[SchedulerDaemon] Routine "${routine.name}" missed scheduled window (${Math.round(diffMs / 1000)}s late). Skipping to next occurrence.`);
          const user = await this.db.getUser(routine.userId);
          const tz = user?.profile?.timezone || 'UTC';
          try {
            routine.nextRunAt = getNextRun(routine.cronExpression, tz, now).toISOString();
            await this.db.saveSchedule(routine);
          } catch (cronErr) {
            console.error('[SchedulerDaemon] Failed to advance cron for missed routine:', cronErr);
          }
          continue;
        }
      }

      // 4. Lock and Dispatch
      this.runningRoutineIds.add(routine.id);
      const dispatchPromise = this.dispatch(routine, false).finally(() => {
        this.runningRoutineIds.delete(routine.id);
      });
      dispatches.push(dispatchPromise);
    }

    if (dispatches.length > 0) {
      await Promise.allSettled(dispatches);
    }
  }


  /**
   * Manually triggers an immediate test run of a routine without modifying recurring nextRunAt cadence.
   */
  public async triggerNow(userId: string, routineId: string): Promise<Task> {
    const routine = await this.db.getSchedule(userId, routineId);
    if (!routine) {
      throw new Error(`Routine with ID ${routineId} not found`);
    }

    this.runningRoutineIds.add(routine.id);
    try {
      return await this.dispatch(routine, true);
    } finally {
      this.runningRoutineIds.delete(routine.id);
    }
  }

  /**
   * Executes a scheduled routine by spawning an autonomous Agent Task.
   */
  private async dispatch(routine: ScheduledRoutine, isManualTrigger: boolean = false): Promise<Task> {
    // 1. Resolve User
    const user = await this.db.getUser(routine.userId);
    if (!user) {
      console.error(`[SchedulerDaemon] User ${routine.userId} not found for routine "${routine.name}". Marking routine cancelled.`);
      routine.status = 'cancelled';
      await this.db.saveSchedule(routine);
      throw new Error(`User ${routine.userId} not found`);
    }

    const taskId = uuidv4();
    const nowIso = new Date().toISOString();

    // 2. Create Task tagged with scheduled source and routineId
    const task: Task = {
      id: taskId,
      userId: user.id,
      goal: routine.goal,
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      iterations: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      source: 'scheduled',
      routineId: routine.id,
      preApprovedTools: routine.preApprovedTools || [],
      autoApproveRoutine: routine.autoApprove !== false,
    };

    await this.db.saveTask(task);
    await this.db.logEvent({
      taskId: task.id,
      type: 'status_change',
      status: 'started',
      message: `[Routine: ${routine.name}] Autonomous task started`,
      safeMetadata: { routineId: routine.id, isManualTrigger },
    });

    // 3. Send initial Push Notification if enabled
    if (routine.notificationType !== 'silent' && user.profile.pushToken) {
      sendPushNotification(this.db, user.id, user.profile.pushToken, {
        title: `Relay Routine: ${routine.name}`,
        body: `Running your routine: "${routine.goal.slice(0, 80)}"`,
        channelId: 'relay-updates',
        data: { routineId: routine.id, taskId: task.id, type: 'routine_started' },
      }).catch(() => {});
    }

    let finalTask: Task = task;

    try {
      // 4. Run Agent Orchestrator loop
      finalTask = await this.orchestrator.runTask(task, user);

      if (finalTask.status === 'COMPLETED') {
        routine.lastStatus = 'success';
        routine.consecutiveFailures = 0;
      } else if (finalTask.status === 'WAITING_APPROVAL') {
        routine.lastStatus = 'running';
      } else {
        routine.lastStatus = 'failed';
        routine.consecutiveFailures = (routine.consecutiveFailures || 0) + 1;
      }
    } catch (execErr: any) {
      console.error(`[SchedulerDaemon] Task execution failed for routine "${routine.name}":`, execErr.message);
      routine.lastStatus = 'failed';
      routine.consecutiveFailures = (routine.consecutiveFailures || 0) + 1;
      await this.db.logEvent({
        taskId: task.id,
        type: 'error',
        status: 'failed',
        message: `Routine execution failed: ${execErr.message}`,
        safeMetadata: { routineId: routine.id },
      });
    } finally {
      // 5. Update Routine stats and calculate next run
      routine.lastRunAt = new Date().toISOString();
      routine.lastTaskId = task.id;
      routine.totalRuns = (routine.totalRuns || 0) + 1;

      // If 5 consecutive failures occur, pause to prevent runaway issues
      if ((routine.consecutiveFailures || 0) >= 5) {
        routine.status = 'paused';
        console.warn(`[SchedulerDaemon] Paused routine "${routine.name}" due to 5 consecutive failures.`);
      }

      if (!isManualTrigger) {
        if (routine.scheduleType === 'once') {
          routine.status = 'completed';
        } else if (routine.scheduleType === 'recurring' && routine.cronExpression) {
          const tz = user.profile.timezone || 'UTC';
          try {
            routine.nextRunAt = getNextRun(routine.cronExpression, tz).toISOString();
          } catch (cronErr: any) {
            console.error(`[SchedulerDaemon] Failed to compute next run for "${routine.name}":`, cronErr.message);
          }
        }
      }

      await this.db.saveSchedule(routine);
    }

    return finalTask;
  }
}
