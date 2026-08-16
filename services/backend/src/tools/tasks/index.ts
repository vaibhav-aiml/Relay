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
