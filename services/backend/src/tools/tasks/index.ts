import {
  tasksCreateSchema,
  tasksGetStatusSchema,
  tasksCancelSchema,
  TasksCreateInput,
  TasksGetStatusInput,
  TasksCancelInput,
} from '@relay/tool-schemas';
import { ToolDefinition, ExecutionContext } from '../types.js';

export const tasksCreateTool: ToolDefinition<TasksCreateInput> = {
  name: 'tasks.create',
  description: 'Create a new background task or sub-objective.',
  inputSchema: tasksCreateSchema,
  riskLevel: 'LOW',
  requiredPermission: 'tasks.create',
  timeoutMs: 10_000,
  retryPolicy: { maxRetries: 1, backoffMs: 1000 },
  execute: async (input: TasksCreateInput) => {
    return {
      subtaskId: `subtask-${Date.now()}`,
      goal: input.goal,
      status: 'CREATED',
    };
  },
  verify: async (output) => Boolean(output && output.subtaskId),
};

export const tasksGetStatusTool: ToolDefinition<TasksGetStatusInput> = {
  name: 'tasks.getStatus',
  description: 'Check the progress, status, and result of a task.',
  inputSchema: tasksGetStatusSchema,
  riskLevel: 'LOW',
  requiredPermission: 'tasks.getStatus',
  timeoutMs: 5_000,
  retryPolicy: { maxRetries: 1, backoffMs: 500 },
  execute: async (input: TasksGetStatusInput, ctx: ExecutionContext) => {
    const task = await ctx.db.getTask(ctx.userId, input.taskId);
    if (!task) throw new Error(`Task ${input.taskId} not found`);
    return {
      taskId: task.id,
      status: task.status,
      currentStep: task.currentStep,
      plan: task.plan,
    };
  },
  verify: async (output) => Boolean(output && output.taskId),
};

export const tasksCancelTool: ToolDefinition<TasksCancelInput> = {
  name: 'tasks.cancel',
  description: 'Cancel an active task.',
  inputSchema: tasksCancelSchema,
  riskLevel: 'LOW',
  requiredPermission: 'tasks.cancel',
  timeoutMs: 5_000,
  retryPolicy: { maxRetries: 1, backoffMs: 500 },
  execute: async (input: TasksCancelInput, ctx: ExecutionContext) => {
    const task = await ctx.db.getTask(ctx.userId, input.taskId);
    if (!task) throw new Error(`Task ${input.taskId} not found`);
    task.status = 'CANCELLED';
    task.error = input.reason || 'Cancelled by agent/user';
    await ctx.db.saveTask(task);
    return {
      taskId: task.id,
      status: 'CANCELLED',
    };
  },
  verify: async (output) => output.status === 'CANCELLED',
};

import {
  tasksScheduleSchema,
  tasksListScheduledSchema,
  tasksCancelScheduledSchema,
  TasksScheduleInput,
  TasksListScheduledInput,
  TasksCancelScheduledInput,
} from '@relay/tool-schemas';
import { v4 as uuidv4 } from 'uuid';
import { ScheduledRoutine } from '@relay/shared-types';
import { buildCronFromPreset, getNextRun, parseWhenToSchedule, isValidCron } from '../../scheduler/cronEvaluator.js';

export const tasksScheduleTool: ToolDefinition<TasksScheduleInput> = {
  name: 'tasks.schedule',
  description: 'Schedule a new future one-time task or recurring routine (e.g. daily morning briefing, evening dinner reminder).',
  inputSchema: tasksScheduleSchema,
  riskLevel: 'LOW',
  requiredPermission: 'tasks.schedule',
  timeoutMs: 10_000,
  retryPolicy: { maxRetries: 1, backoffMs: 500 },
  execute: async (input: TasksScheduleInput, ctx: ExecutionContext) => {
    const user = await ctx.db.getUser(ctx.userId);
    const timezone = user?.profile?.timezone || 'UTC';

    let cronExpression: string | undefined = input.cronExpression;
    let scheduledAt: string | undefined = input.scheduledAt;
    let humanSchedule = '';

    if (input.when) {
      const parsed = parseWhenToSchedule(input.when, timezone);
      cronExpression = parsed.cronExpression;
      scheduledAt = parsed.scheduledAt;
      humanSchedule = parsed.humanSchedule;
    } else if (input.frequency || input.time) {
      const built = buildCronFromPreset(input.frequency, input.time, input.daysOfWeek, input.cronExpression);
      cronExpression = built.cronExpression;
      humanSchedule = built.humanSchedule;
    } else if (input.scheduledAt) {
      scheduledAt = input.scheduledAt;
      humanSchedule = `One-time at ${new Date(scheduledAt).toLocaleString()}`;
    } else if (cronExpression) {
      if (!isValidCron(cronExpression, timezone)) {
        throw new Error(`Invalid cron expression: "${cronExpression}"`);
      }
      humanSchedule = `Custom cron: ${cronExpression}`;
    } else {
      // Default to daily at 9:00 AM
      const built = buildCronFromPreset('daily', '09:00');
      cronExpression = built.cronExpression;
      humanSchedule = built.humanSchedule;
    }

    let nextRunAt: string;
    const now = new Date();

    if (input.scheduleType === 'once' || scheduledAt) {
      nextRunAt = scheduledAt || new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      scheduledAt = nextRunAt;
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
      userId: ctx.userId,
      name: input.name.trim(),
      goal: input.goal.trim(),
      scheduleType: input.scheduleType || (scheduledAt ? 'once' : 'recurring'),
      cronExpression,
      humanSchedule,
      scheduledAt,
      nextRunAt,
      status: 'active',
      totalRuns: 0,
      preApprovedTools: input.preApprovedTools || [],
      autoApprove: true,
      notificationType: input.notificationType || 'push_and_run',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await ctx.db.saveSchedule(routine);

    return {
      scheduleId: routine.id,
      name: routine.name,
      goal: routine.goal,
      humanSchedule: routine.humanSchedule,
      nextRunAt: routine.nextRunAt,
      status: routine.status,
    };
  },
  verify: async (output) => Boolean(output && output.scheduleId),
};

export const tasksListScheduledTool: ToolDefinition<TasksListScheduledInput> = {
  name: 'tasks.listScheduled',
  description: 'List user routines and scheduled tasks.',
  inputSchema: tasksListScheduledSchema,
  riskLevel: 'LOW',
  requiredPermission: 'tasks.listScheduled',
  timeoutMs: 5_000,
  retryPolicy: { maxRetries: 1, backoffMs: 500 },
  execute: async (input: TasksListScheduledInput, ctx: ExecutionContext) => {
    const routines = await ctx.db.listSchedules(ctx.userId, input.status);
    return {
      schedules: routines.map((r) => ({
        id: r.id,
        name: r.name,
        goal: r.goal,
        scheduleType: r.scheduleType,
        humanSchedule: r.humanSchedule,
        nextRunAt: r.nextRunAt,
        status: r.status,
        lastStatus: r.lastStatus,
      })),
      total: routines.length,
    };
  },
  verify: async (output) => Array.isArray(output?.schedules),
};

export const tasksCancelScheduledTool: ToolDefinition<TasksCancelScheduledInput> = {
  name: 'tasks.cancelScheduled',
  description: 'Cancel or delete a scheduled routine.',
  inputSchema: tasksCancelScheduledSchema,
  riskLevel: 'LOW',
  requiredPermission: 'tasks.cancelScheduled',
  timeoutMs: 5_000,
  retryPolicy: { maxRetries: 1, backoffMs: 500 },
  execute: async (input: TasksCancelScheduledInput, ctx: ExecutionContext) => {
    const success = await ctx.db.deleteSchedule(ctx.userId, input.scheduleId);
    return {
      scheduleId: input.scheduleId,
      cancelled: success,
    };
  },
  verify: async (output) => Boolean(output && output.scheduleId),
};

