import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { Task, CreateTaskRequest } from '@relay/shared-types';
import { getDatabase } from '../database/index.js';
import { AgentOrchestrator } from '../agent/orchestrator.js';
import { AuthenticatedRequest, authMiddleware } from '../auth/middleware.js';

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  const db = getDatabase();
  const orchestrator = new AgentOrchestrator(db);

  // Create and launch new task
  app.post<{ Body: CreateTaskRequest }>('/', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { goal } = req.body;

    if (!goal || typeof goal !== 'string') {
      return reply.status(400).send({ error: 'Goal is required' });
    }

    const taskId = uuidv4();
    const now = new Date().toISOString();

    const task: Task = {
      id: taskId,
      userId: user.id,
      goal: goal.trim(),
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      iterations: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.saveTask(task);
    await db.logEvent({
      taskId: task.id,
      type: 'status_change',
      status: 'started',
      message: `Task created: "${task.goal}"`,
      safeMetadata: { goal: task.goal },
    });

    // Run agent orchestrator asynchronously in background, or await first step
    orchestrator.runTask(task, user).catch((err) => {
      req.log.error({ err, taskId: task.id }, 'Agent loop encountered unexpected error');
    });

    return reply.status(201).send({ task });
  });

  // List & Search tasks for current user
  app.get<{
    Querystring: {
      q?: string;
      status?: string;
      tool?: string;
      timeHorizon?: 'all' | 'today' | 'week' | 'month';
      limit?: number;
    };
  }>('/', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { q, status, tool, timeHorizon, limit } = req.query;

    const tasks = await db.listTasks(user.id, {
      query: q,
      status,
      tool,
      timeHorizon,
      limit: limit ? Number(limit) : 50,
    });
    return reply.send({ tasks, total: tasks.length });
  });

  // Clear all task history for current user
  app.delete('/history', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    if (db.clearTaskHistory) {
      await db.clearTaskHistory(user.id);
    }
    return reply.send({ success: true, message: 'Task history cleared successfully' });
  });

  // Get task by ID with full event trace
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const task = await db.getTask(user.id, id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    const events = await db.getTaskEvents(id);
    const pendingApproval = await db.getPendingApprovalForTask(id);

    return reply.send({
      task: {
        ...task,
        pendingApproval: pendingApproval || undefined,
      },
      events,
    });
  });

  // Cancel task
  app.post<{ Params: { id: string }; Body: { reason?: string } }>('/:id/cancel', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const task = await db.getTask(user.id, id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    task.status = 'CANCELLED';
    task.error = req.body?.reason || 'Cancelled by user';
    task.updatedAt = new Date().toISOString();
    await db.saveTask(task);

    await db.logEvent({
      taskId: task.id,
      type: 'status_change',
      status: 'failed',
      message: `Task cancelled: ${task.error}`,
      safeMetadata: { cancelled: true },
    });

    return reply.send({ task });
  });

  // Reply / Follow-up to continue a completed task
  app.post<{ Params: { id: string }; Body: { reply: string } }>('/:id/reply', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const { reply: userReply } = req.body || {};

    if (!userReply || typeof userReply !== 'string' || !userReply.trim()) {
      return reply.status(400).send({ error: 'Reply text is required' });
    }

    const task = await db.getTask(user.id, id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    // Run orchestrator continuation asynchronously
    orchestrator.continueTaskWithReply(id, userReply.trim(), user).catch((err) => {
      req.log.error({ err, taskId: id }, 'Agent continuation loop encountered error');
    });

    // Return the updated task immediately in PLANNING status
    const updatedTask = await db.getTask(user.id, id);
    return reply.send({ task: updatedTask || task, message: 'Follow-up submitted successfully' });
  });
}
