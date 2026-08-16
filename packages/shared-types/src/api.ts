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

export interface GetTaskResponse {
  task: Task;
  events: TaskEvent[];
}

export interface ApprovalDecisionRequest {
  decision: 'approved' | 'denied';
  denialReason?: string;
}

export interface VoiceTranscribeResponse {
  text: string;
  durationSeconds?: number;
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
