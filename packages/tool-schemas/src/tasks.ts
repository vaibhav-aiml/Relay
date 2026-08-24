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

export const tasksScheduleSchema = z.object({
  name: z.string().min(1).describe('A friendly title for the routine (e.g. Morning Briefing, Dinner Reminder)'),
  goal: z.string().min(1).describe('The natural language goal/task to execute when triggered'),
  scheduleType: z.enum(['once', 'recurring']).optional().default('recurring').describe('Whether this runs once or on a recurring cadence'),
  when: z.string().optional().describe("Natural time description, e.g. 'every weekday at 8:30 AM', 'daily at 7 PM', 'in 2 hours'"),
  frequency: z.enum(['daily', 'weekdays', 'weekly', 'hourly', 'once', 'custom']).optional().describe('Preset recurrence frequency'),
  time: z.string().optional().describe("Time of day in HH:mm format e.g. '08:30'"),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional().describe('Days of week for weekly recurrence (0=Sun, 1=Mon, ..., 6=Sat)'),
  scheduledAt: z.string().optional().describe('ISO timestamp for one-time future execution'),
  cronExpression: z.string().optional().describe('Advanced 5-part cron expression (e.g. 30 8 * * 1-5)'),
  preApprovedTools: z.array(z.string()).optional().describe('List of tools pre-approved to execute autonomously without manual prompt confirmation'),
  notificationType: z.enum(['silent', 'push', 'push_and_run']).optional().default('push_and_run').describe('Notification mode for this routine'),
});

export type TasksScheduleInput = z.infer<typeof tasksScheduleSchema>;

export const tasksListScheduledSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'cancelled', 'all']).optional().default('active').describe('Filter routines by status'),
});
export type TasksListScheduledInput = z.infer<typeof tasksListScheduledSchema>;

export const tasksCancelScheduledSchema = z.object({
  scheduleId: z.string().min(1).describe('The ID of the routine to cancel/delete'),
});
export type TasksCancelScheduledInput = z.infer<typeof tasksCancelScheduledSchema>;

