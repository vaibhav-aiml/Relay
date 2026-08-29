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

export type WorkerAgentType =
  | 'researcher'
  | 'calendar_negotiator'
  | 'food_specialist'
  | 'communicator'
  | 'general_worker';

export type SubAgentStatus =
  | 'pending'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'skipped';

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

export interface SubAgentTask {
  id: string;
  parentTaskId: string;
  agentType: WorkerAgentType;
  name: string;
  goal: string;
  stage: number;
  dependencies: string[];
  status: SubAgentStatus;
  plan: PlanStep[];
  pendingApproval?: Approval;
  result?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CoordinatorPlan {
  isDecomposed: boolean;
  strategy: 'single_agent' | 'swarm_pipeline';
  summary: string;
  totalStages: number;
  subtasks: SubAgentTask[];
}

export interface TaskEvent {
  id: string;
  taskId: string;
  subAgentId?: string;
  subAgentType?: WorkerAgentType;
  type:
    | 'tool_call'
    | 'approval_request'
    | 'approval_decision'
    | 'error'
    | 'status_change'
    | 'subagent_spawned'
    | 'subagent_started'
    | 'subagent_completed'
    | 'subagent_failed'
    | 'swarm_aggregated';
  tool?: string;
  action?: string;
  status: 'started' | 'succeeded' | 'failed' | 'verified';
  timestamp: string;
  message?: string;
  safeMetadata: Record<string, unknown>; // Never contains full raw bodies or tokens
}

export interface TaskMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

export type ScheduleType = 'once' | 'recurring';
export type ScheduleStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type RoutineNotificationType = 'silent' | 'push' | 'push_and_run';

export interface ScheduledRoutine {
  id: string;
  userId: string;
  name: string;
  goal: string;
  scheduleType: ScheduleType;
  cronExpression?: string;             // in user local timezone (e.g. "30 8 * * 1-5")
  humanSchedule: string;               // e.g. "Every weekday at 8:30 AM"
  scheduledAt?: string;                // UTC ISO for one-time future executions
  nextRunAt: string;                   // UTC ISO for next trigger
  lastRunAt?: string;                  // UTC ISO of previous execution
  lastTaskId?: string;                 // ID of task spawned by last run
  lastStatus?: 'success' | 'failed' | 'running';
  consecutiveFailures?: number;
  status: ScheduleStatus;
  totalRuns: number;
  preApprovedTools: string[];          // Whitelist of tools allowed to run autonomously
  autoApprove: boolean;
  notificationType: RoutineNotificationType;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  goal: string;
  status: TaskStatus;
  plan: PlanStep[];
  currentStep: number;
  pendingApprovals: Approval[];
  finalAnswer?: string;
  error?: string;
  iterations: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  followUpHistory?: TaskMessage[];
  source?: 'manual' | 'scheduled';
  routineId?: string;
  preApprovedTools?: string[];
  autoApproveRoutine?: boolean;
  isSwarm?: boolean;
  coordinatorPlan?: CoordinatorPlan;
  subtasks?: SubAgentTask[];
}


