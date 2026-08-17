import { Approval } from './approval.js';

export type TaskStatus =
  | 'CREATED'
  | 'UNDERSTANDING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'WAITING_APPROVAL'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface PlanStep {
  id: string;
  stepNumber: number;
  description: string;
  toolName?: string;
  args?: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'needs_approval';
  result?: any;
  verified?: boolean;
}

export interface TaskEvent {
  id: string;
  taskId: string;
  type: 'tool_call' | 'approval_request' | 'approval_decision' | 'error' | 'status_change';
  tool?: string;
  action?: string;
  status: 'started' | 'succeeded' | 'failed' | 'verified';
  timestamp: string;
  message?: string;
  safeMetadata: Record<string, unknown>; // Never contains full raw bodies or tokens
}

export interface Task {
  id: string;
  userId: string;
  goal: string;
  status: TaskStatus;
  plan: PlanStep[];
  currentStep: number;
  pendingApproval?: Approval;
  finalAnswer?: string;
  error?: string;
  iterations: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
