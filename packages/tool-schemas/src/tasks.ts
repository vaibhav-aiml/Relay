import { z } from 'zod';

export const tasksCreateSchema = z.object({
  goal: z.string().min(1).describe('The subtask or objective to execute'),
});
export type TasksCreateInput = z.infer<typeof tasksCreateSchema>;

export const tasksGetStatusSchema = z.object({
  taskId: z.string().min(1).describe('The ID of the task to inspect'),
});
export type TasksGetStatusInput = z.infer<typeof tasksGetStatusSchema>;

export const tasksCancelSchema = z.object({
  taskId: z.string().min(1).describe('The ID of the task to cancel'),
  reason: z.string().optional().describe('Reason for cancellation'),
});
export type TasksCancelInput = z.infer<typeof tasksCancelSchema>;
