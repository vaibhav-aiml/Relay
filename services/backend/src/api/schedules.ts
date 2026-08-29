import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { CreateScheduleRequest, UpdateScheduleRequest, ScheduledRoutine } from '@relay/shared-types';
import { getDatabase } from '../database/index.js';
import { AuthenticatedRequest, authMiddleware } from '../auth/middleware.js';
import { buildCronFromPreset, getNextRun, parseWhenToSchedule, isValidCron } from '../scheduler/cronEvaluator.js';
import { SchedulerDaemon } from '../scheduler/daemon.js';

export async function scheduleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  const db = getDatabase();

  // 1. List user routines
  app.get<{
    Querystring: {
      status?: 'active' | 'paused' | 'completed' | 'cancelled' | 'all';
    };
  }>('/', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { status } = req.query;

    const schedules = await db.listSchedules(user.id, status || 'all');
    return reply.send({ schedules, total: schedules.length });
  });

  // 2. Create routine
  app.post<{ Body: CreateScheduleRequest }>('/', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const {
      name,
      goal,
      scheduleType = 'recurring',
      frequency,
      time,
      daysOfWeek,
      when,
      scheduledAt,
      cronExpression: rawCron,
      preApprovedTools = [],
      autoApprove = true,
      notificationType = 'push_and_run',
    } = req.body;

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Routine title (name) is required' });
    }
    if (!goal || !goal.trim()) {
      return reply.status(400).send({ error: 'Goal is required' });
    }

    const timezone = user.profile.timezone || 'UTC';
    let cronExpression: string | undefined = rawCron;
    let computedScheduledAt: string | undefined = scheduledAt;
    let humanSchedule = '';

    if (when && when.trim()) {
      try {
        const parsed = parseWhenToSchedule(when.trim(), timezone);
        cronExpression = parsed.cronExpression;
        computedScheduledAt = parsed.scheduledAt;
        humanSchedule = parsed.humanSchedule;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    } else if (frequency || time) {
      try {
        const built = buildCronFromPreset(frequency, time, daysOfWeek, rawCron);
        cronExpression = built.cronExpression;
        humanSchedule = built.humanSchedule;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    } else if (computedScheduledAt) {
      humanSchedule = `One-time at ${new Date(computedScheduledAt).toLocaleString()}`;
    } else if (cronExpression) {
      if (!isValidCron(cronExpression, timezone)) {
        return reply.status(400).send({ error: `Invalid cron expression: "${cronExpression}"` });
      }
      humanSchedule = `Custom cron: ${cronExpression}`;
    } else {
      const built = buildCronFromPreset('daily', '09:00');
      cronExpression = built.cronExpression;
      humanSchedule = built.humanSchedule;
    }

    const now = new Date();
    let nextRunAt: string;

    if (scheduleType === 'once' || computedScheduledAt) {
      nextRunAt = computedScheduledAt || new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      computedScheduledAt = nextRunAt;
    } else {
      if (!cronExpression) {
        cronExpression = '0 9 * * *';
      }
      nextRunAt = getNextRun(cronExpression, timezone, now).toISOString();
    }

    const scheduleId = uuidv4();
    const nowIso = now.toISOString();

    const routine: ScheduledRoutine = {
      id: scheduleId,
      userId: user.id,
      name: name.trim(),
      goal: goal.trim(),
      scheduleType: scheduleType || (computedScheduledAt ? 'once' : 'recurring'),
      cronExpression,
      humanSchedule,
      scheduledAt: computedScheduledAt,
      nextRunAt,
      status: 'active',
      totalRuns: 0,
      preApprovedTools: Array.isArray(preApprovedTools) ? preApprovedTools : [],
      autoApprove: autoApprove !== false,
      notificationType: notificationType || 'push_and_run',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.saveSchedule(routine);
    SchedulerDaemon.notifyScheduleChanged();
    return reply.status(201).send({ schedule: routine });
  });

  // 3. Get routine details
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const routine = await db.getSchedule(user.id, id);
    if (!routine) {
      return reply.status(404).send({ error: 'Routine not found' });
    }

    return reply.send({ schedule: routine });
  });

  // 4. Update routine (Edit goal, cadence, permissions)
  app.put<{ Params: { id: string }; Body: UpdateScheduleRequest }>('/:id', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const existing = await db.getSchedule(user.id, id);
    if (!existing) {
      return reply.status(404).send({ error: 'Routine not found' });
    }

    const timezone = user.profile.timezone || 'UTC';
    const body = req.body;

    let cronExpression = body.cronExpression || existing.cronExpression;
    let humanSchedule = existing.humanSchedule;
    let scheduledAt = body.scheduledAt || existing.scheduledAt;
    const scheduleType = body.scheduleType || existing.scheduleType;

    const targetFrequency =
      body.frequency ||
      (existing.cronExpression?.includes('1-5')
        ? 'weekdays'
        : existing.scheduleType === 'once'
        ? 'once'
        : 'daily');

    if (body.when) {
      const parsed = parseWhenToSchedule(body.when, timezone);
      cronExpression = parsed.cronExpression;
      scheduledAt = parsed.scheduledAt;
      humanSchedule = parsed.humanSchedule;
    } else if (body.frequency || body.time || body.daysOfWeek) {
      const built = buildCronFromPreset(targetFrequency, body.time, body.daysOfWeek, body.cronExpression);
      cronExpression = built.cronExpression;
      humanSchedule = built.humanSchedule;
    }

    let nextRunAt = existing.nextRunAt;
    const now = new Date();

    if (scheduleType === 'once') {
      nextRunAt = scheduledAt || existing.nextRunAt;
    } else if (cronExpression && (body.frequency || body.time || body.cronExpression || body.when)) {
      nextRunAt = getNextRun(cronExpression, timezone, now).toISOString();
    }


    const updated: ScheduledRoutine = {
      ...existing,
      name: body.name !== undefined ? body.name.trim() : existing.name,
      goal: body.goal !== undefined ? body.goal.trim() : existing.goal,
      scheduleType,
      cronExpression,
      humanSchedule,
      scheduledAt,
      nextRunAt,
      status: body.status || existing.status,
      preApprovedTools: body.preApprovedTools !== undefined ? body.preApprovedTools : existing.preApprovedTools,
      autoApprove: body.autoApprove !== undefined ? body.autoApprove : existing.autoApprove,
      notificationType: body.notificationType || existing.notificationType,
      updatedAt: now.toISOString(),
    };

    await db.saveSchedule(updated);
    SchedulerDaemon.notifyScheduleChanged();
    return reply.send({ schedule: updated });
  });

  // 5. Toggle Active <-> Paused
  app.post<{ Params: { id: string } }>('/:id/toggle', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const routine = await db.getSchedule(user.id, id);
    if (!routine) {
      return reply.status(404).send({ error: 'Routine not found' });
    }

    const newStatus = routine.status === 'active' ? 'paused' : 'active';
    routine.status = newStatus;
    routine.updatedAt = new Date().toISOString();

    // If resuming recurring routine, recalculate nextRunAt
    if (newStatus === 'active' && routine.scheduleType === 'recurring' && routine.cronExpression) {
      const timezone = user.profile.timezone || 'UTC';
      try {
        routine.nextRunAt = getNextRun(routine.cronExpression, timezone).toISOString();
      } catch (err) {
        // ignore
      }
    }

    await db.saveSchedule(routine);
    SchedulerDaemon.notifyScheduleChanged();
    return reply.send({ schedule: routine, message: `Routine is now ${newStatus}` });
  });

  // 6. Manual Test Run ("Run Now")
  app.post<{ Params: { id: string } }>('/:id/run', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const daemon = SchedulerDaemon.getInstance(db);
    try {
      const task = await daemon.triggerNow(user.id, id);
      const updatedRoutine = await db.getSchedule(user.id, id);
      return reply.send({
        success: true,
        message: 'Routine triggered successfully',
        task,
        schedule: updatedRoutine,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: `Failed to run routine: ${err.message}` });
    }
  });

  // 7. Delete Routine
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const success = await db.deleteSchedule(user.id, id);
    if (!success) {
      return reply.status(404).send({ error: 'Routine not found or already deleted' });
    }

    SchedulerDaemon.notifyScheduleChanged();
    return reply.send({ success: true, message: 'Routine deleted successfully' });
  });

  // 8. Register Expo Push Token
  app.post<{ Body: { pushToken: string; timezone?: string } }>('/push-token', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { pushToken, timezone } = req.body || {};

    if (pushToken && typeof pushToken === 'string') {
      user.profile.pushToken = pushToken;
      if (db.updateUserPushToken) {
        await db.updateUserPushToken(user.id, pushToken);
      }
    }
    if (timezone && typeof timezone === 'string') {
      user.profile.timezone = timezone;
    }
    await db.saveUser(user);

    return reply.send({ success: true, message: 'Push token registered successfully' });
  });
}
