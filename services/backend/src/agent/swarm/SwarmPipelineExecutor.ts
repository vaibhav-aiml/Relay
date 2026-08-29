import { Task, SubAgentTask, User, Approval } from '@relay/shared-types';
import { AGENT_CONFIG } from '@relay/config';
import { IDatabaseRepository } from '../../database/types.js';
import { ToolRegistry } from '../../tools/registry.js';
import { Planner } from '../planner.js';
import { WorkerAgent } from './WorkerAgent.js';
import { AggregateReporter } from './AggregateReporter.js';
import { ARCHETYPES } from './archetypes.js';

export class SwarmPipelineExecutor {
  private db: IDatabaseRepository;
  private activeLlmCalls = 0;
  private llmQueue: Array<() => void> = [];

  constructor(db: IDatabaseRepository) {
    this.db = db;
  }

  /**
   * Concurrency semaphore limiting simultaneous active LLM calls across the swarm.
   */
  private async acquireLlmSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeLlmCalls >= AGENT_CONFIG.MAX_CONCURRENT_LLM_CALLS) {
      await new Promise<void>((resolve) => this.llmQueue.push(resolve));
    }

    this.activeLlmCalls++;
    try {
      return await fn();
    } finally {
      this.activeLlmCalls--;
      if (this.llmQueue.length > 0) {
        const next = this.llmQueue.shift();
        if (next) next();
      }
    }
  }

  /**
   * Executes the entire multi-stage swarm pipeline from start to completion.
   * 
   * CRITICAL: This is the SINGLE AUTHORITATIVE WRITER for `task`.
   */
  public async executeSwarm(
    task: Task,
    user: User,
    customPlanner?: Planner
  ): Promise<Task> {
    const planner = customPlanner || new Planner(user);
    const memories = await this.db.getMemories(user.id);
    const startTime = Date.now();

    task.isSwarm = true;
    const subtasks = task.subtasks || [];
    if (subtasks.length === 0) {
      task.status = 'COMPLETED';
      task.finalAnswer = 'No subtasks to execute.';
      await this.db.saveTask(task);
      return task;
    }

    // Check if any subtask is already waiting for user approval
    const existingApprovals = this.collectPendingApprovals(task);
    if (existingApprovals.length > 0) {
      task.pendingApprovals = existingApprovals;
      task.status = 'WAITING_APPROVAL';
      await this.db.saveTask(task);
      return task;
    }

    task.status = 'EXECUTING';
    await this.db.saveTask(task);

    // Determine total stages
    const totalStages = Math.max(...subtasks.map((s) => s.stage), 1);

    for (let currentStage = 1; currentStage <= totalStages; currentStage++) {
      // 1. Whole-swarm wall clock timeout guard
      const elapsed = Date.now() - startTime;
      if (elapsed >= AGENT_CONFIG.MAX_SWARM_WALL_CLOCK_MS) {
        task.status = 'FAILED';
        task.error = `Swarm exceeded maximum total execution duration (${AGENT_CONFIG.MAX_SWARM_WALL_CLOCK_MS / 1000}s)`;
        await this.db.saveTask(task);
        return task;
      }

      // 2. Prior stage completeness check
      const priorIncomplete = (task.subtasks || []).filter(
        (s) => s.stage < currentStage && s.status !== 'completed' && s.status !== 'failed'
      );
      if (priorIncomplete.length > 0) {
        const approvals = this.collectPendingApprovals(task);
        if (approvals.length > 0) {
          task.pendingApprovals = approvals;
          task.status = 'WAITING_APPROVAL';
          await this.db.saveTask(task);
          return task;
        }
        // Still running prior stage
        return task;
      }

      // 3. Identify subtasks in this stage that are ready to run
      const stageSubtasks = (task.subtasks || []).filter(
        (s) => s.stage === currentStage && s.status === 'pending'
      );

      if (stageSubtasks.length > 0) {
        // Build upstream context from previously completed stages
        const upstreamContext = this.extractUpstreamContext(task.subtasks || [], currentStage);

        await this.db.logEvent({
          taskId: task.id,
          type: 'status_change',
          status: 'started',
          message: `Executing Swarm Stage ${currentStage} of ${totalStages} (${stageSubtasks.length} parallel workers)`,
          safeMetadata: { stage: currentStage, totalStages, subtaskCount: stageSubtasks.length },
        });

        // 4. Execute all subtasks in this stage in parallel via Promise.allSettled
        const workerPromises = stageSubtasks.map((st) =>
          WorkerAgent.execute(st, {
            parentTask: task,
            user,
            db: this.db,
            memories,
            upstreamContext,
            planner,
            llmConcurrencyLimiter: <T>(fn: () => Promise<T>) => this.acquireLlmSlot(fn),
          })
        );

        const results = await Promise.allSettled(workerPromises);

        // 5. Sequentially merge results into authoritative in-memory task
        for (let i = 0; i < stageSubtasks.length; i++) {
          const original = stageSubtasks[i];
          const settleResult = results[i];

          if (settleResult.status === 'fulfilled') {
            const updatedSubtask = settleResult.value;
            this.mergeSubtaskIntoTask(task, updatedSubtask);
          } else {
            original.status = 'failed';
            original.error = settleResult.reason?.message || 'Worker execution failed unexpectedly';
            this.mergeSubtaskIntoTask(task, original);
          }
        }
      }

      // 6. Gather all pending approvals after stage execution
      const currentApprovals = this.collectPendingApprovals(task);
      task.pendingApprovals = currentApprovals;

      // 7. Check if any subtask in the swarm is waiting for user approval
      if (currentApprovals.length > 0) {
        task.status = 'WAITING_APPROVAL';
        task.updatedAt = new Date().toISOString();
        await this.db.saveTask(task);
        return task; // Pause swarm until approvals are resolved!
      }

      // Persist stage completion
      task.updatedAt = new Date().toISOString();
      await this.db.saveTask(task);
    }

    // Double check that no subtasks are left waiting
    const finalApprovals = this.collectPendingApprovals(task);
    if (finalApprovals.length > 0) {
      task.pendingApprovals = finalApprovals;
      task.status = 'WAITING_APPROVAL';
      await this.db.saveTask(task);
      return task;
    }

    // 8. All stages completed -> Generate Aggregate Final Report
    task.status = 'VERIFYING';
    await this.db.saveTask(task);

    const aggregateReport = await AggregateReporter.generateReport(task, task.subtasks || [], user, planner);

    task.finalAnswer = aggregateReport;
    task.status = 'COMPLETED';
    task.completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    task.pendingApprovals = [];

    await this.db.logEvent({
      taskId: task.id,
      type: 'swarm_aggregated',
      status: 'succeeded',
      message: 'All worker agents completed. Final report synthesized.',
      safeMetadata: { totalSubtasks: (task.subtasks || []).length, totalStages },
    });

    await this.db.saveTask(task);
    return task;
  }

  /**
   * Resumes a paused swarm subtask after an approval decision is received.
   */
  public async resumeSwarmApproval(
    task: Task,
    approvalId: string,
    decision: 'approved' | 'denied',
    user: User,
    customPlanner?: Planner
  ): Promise<Task> {
    const planner = customPlanner || new Planner(user);
    const subtasks = task.subtasks || [];

    // Resolve the approval in the database first
    const resolvedApproval = await this.db.resolveApproval(approvalId, decision);

    // Find the subtask that generated this approval strictly
    const targetSubtask = subtasks.find(
      (st) =>
        st.pendingApproval?.id === approvalId ||
        (resolvedApproval?.subTaskId && st.id === resolvedApproval.subTaskId)
    );

    // Remove resolved approval from task pendingApprovals queue
    task.pendingApprovals = (task.pendingApprovals || []).filter((a) => a.id !== approvalId);

    if (!targetSubtask) {
      // Fallback: continue swarm execution
      return this.executeSwarm(task, user, planner);
    }

    targetSubtask.pendingApproval = undefined;

    if (decision === 'denied') {
      targetSubtask.status = 'failed';
      targetSubtask.error = `Action denied by user: ${resolvedApproval.description}`;
      this.mergeSubtaskIntoTask(task, targetSubtask);
      await this.db.saveTask(task);
      return this.executeSwarm(task, user, planner);
    }

    // Execute the approved tool call for this specific subtask
    const registry = ToolRegistry.getInstance();
    const toolDef = registry.get(resolvedApproval.toolName);
    if (!toolDef) {
      targetSubtask.status = 'failed';
      targetSubtask.error = `Approved tool ${resolvedApproval.toolName} not found`;
      this.mergeSubtaskIntoTask(task, targetSubtask);
      await this.db.saveTask(task);
      return this.executeSwarm(task, user, planner);
    }

    const executionResult = await registry.executeWithGuards(resolvedApproval.toolName, resolvedApproval.args, {
      userId: user.id,
      taskId: task.id,
      db: this.db,
    });

    // Update the pending step in the subtask plan
    const step = targetSubtask.plan.find((s) => s.toolName === resolvedApproval.toolName && s.status === 'needs_approval');
    if (step) {
      if (executionResult.success) {
        step.status = 'completed';
        step.result = executionResult.output;
        step.verified = executionResult.verified;
      } else {
        step.status = 'failed';
        targetSubtask.status = 'failed';
        targetSubtask.error = executionResult.error;
      }
    }

    if (executionResult.success) {
      targetSubtask.status = 'running';
      // Continue worker loop for remaining steps in this subtask
      const memories = await this.db.getMemories(user.id);
      const upstreamContext = this.extractUpstreamContext(subtasks, targetSubtask.stage);

      const continuedSubtask = await WorkerAgent.execute(targetSubtask, {
        parentTask: task,
        user,
        db: this.db,
        memories,
        upstreamContext,
        planner,
        llmConcurrencyLimiter: <T>(fn: () => Promise<T>) => this.acquireLlmSlot(fn),
      });

      this.mergeSubtaskIntoTask(task, continuedSubtask);
    }

    await this.db.saveTask(task);

    // Continue the swarm pipeline for any remaining subtasks/stages
    return this.executeSwarm(task, user, planner);
  }

  private collectPendingApprovals(task: Task): Approval[] {
    const approvals: Approval[] = [];
    for (const st of task.subtasks || []) {
      if (st.status === 'waiting_approval' && st.pendingApproval) {
        approvals.push(st.pendingApproval);
      }
    }
    return approvals;
  }

  private mergeSubtaskIntoTask(task: Task, updatedSubtask: SubAgentTask): void {
    if (!task.subtasks) task.subtasks = [];
    const index = task.subtasks.findIndex((s) => s.id === updatedSubtask.id);
    if (index >= 0) {
      task.subtasks[index] = updatedSubtask;
    } else {
      task.subtasks.push(updatedSubtask);
    }
  }

  private extractUpstreamContext(subtasks: SubAgentTask[], currentStage: number): string {
    const priorCompleted = subtasks.filter((s) => s.stage < currentStage && s.status === 'completed');
    if (priorCompleted.length === 0) return '';

    return priorCompleted
      .map((s) => {
        const arch = ARCHETYPES[s.agentType]?.displayName || s.agentType;
        const res = typeof s.result === 'object' ? JSON.stringify(s.result) : String(s.result || '');
        return `[${arch} Completed]: "${s.name}" -> ${res}`;
      })
      .join('\n');
  }
}
