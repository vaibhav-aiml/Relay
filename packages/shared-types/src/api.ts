import { Task, TaskEvent } from './task.js';
import { Approval } from './approval.js';
import { Connection } from './connection.js';

export interface CreateTaskRequest {
  goal: string;
  voiceInput?: boolean;
}

export interface CreateTaskResponse {
  task: Task;
}

export interface TaskFilterOptions {
  query?: string;
  status?: string;
  tool?: string;
  source?: 'all' | 'manual' | 'scheduled';
  timeHorizon?: 'all' | 'today' | 'week' | 'month';
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface ListTasksResponse {
  tasks: Task[];
  total?: number;
}

export interface CreateScheduleRequest {
  name: string;
  goal: string;
  scheduleType: 'once' | 'recurring';
  frequency?: 'daily' | 'weekdays' | 'weekly' | 'hourly' | 'once' | 'custom';
  time?: string;                       // "HH:mm" e.g. "08:30"
  daysOfWeek?: number[];               // [1,2,3,4,5] for weekdays
  when?: string;                       // Optional natural string for NLP parser
  scheduledAt?: string;                // UTC ISO for one-time run
  cronExpression?: string;
  preApprovedTools?: string[];
  autoApprove?: boolean;
  notificationType?: 'silent' | 'push' | 'push_and_run';
}

export interface UpdateScheduleRequest {
  name?: string;
  goal?: string;
  scheduleType?: 'once' | 'recurring';
  frequency?: 'daily' | 'weekdays' | 'weekly' | 'hourly' | 'once' | 'custom';
  time?: string;
  daysOfWeek?: number[];
  when?: string;
  scheduledAt?: string;
  cronExpression?: string;
  preApprovedTools?: string[];
  autoApprove?: boolean;
  notificationType?: 'silent' | 'push' | 'push_and_run';
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
}

export interface ListSchedulesResponse {
  schedules: import('./task.js').ScheduledRoutine[];
  total?: number;
}

export interface GetTaskResponse {
  task: Task;
  events: TaskEvent[];
}

export interface TaskReplyRequest {
  reply: string;
}

export interface TaskReplyResponse {
  task: Task;
  message?: string;
}

export interface ApprovalDecisionRequest {
  decision: 'approved' | 'denied';
  denialReason?: string;
}

export interface VoiceTranscribeResponse {
  text: string;
  durationSeconds?: number;
}

export interface VoiceFormatRequest {
  text: string;
  maxLength?: number;
}

export interface VoiceFormatResponse {
  spokenText: string;
  fullText: string;
  truncated: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  database: 'in_memory' | 'firestore';
  aiProvider: string;
}

export interface ListConnectionsResponse {
  connections: Connection[];
}

