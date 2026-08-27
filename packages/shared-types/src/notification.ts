export const NOTIFICATION_CATEGORIES = {
  APPROVAL_ACTIONS: 'APPROVAL_ACTIONS',
} as const;

export const NOTIFICATION_ACTIONS = {
  APPROVE: 'APPROVE_ACTION',
  REJECT: 'REJECT_ACTION',
  VIEW_TASK: 'VIEW_TASK_ACTION',
} as const;

export interface PushNotificationData {
  taskId: string;
  approvalId?: string;
  routineId?: string;
  type: 'approval_request' | 'task_completed' | 'task_failed' | 'routine_started' | 'test';
  toolName?: string;
  goal?: string;
  [key: string]: unknown;
}

export interface RegisterPushTokenRequest {
  pushToken: string;
  timezone?: string;
  devicePlatform?: 'ios' | 'android' | 'web' | 'unknown';
}
