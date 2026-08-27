import { User, Task, Approval, NOTIFICATION_CATEGORIES, PushNotificationData } from '@relay/shared-types';
import { IDatabaseRepository } from '../database/types.js';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: PushNotificationData | Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: 'relay-approvals' | 'relay-updates' | string;
  categoryId?: string;
  interruptionLevel?: 'timeSensitive' | 'active' | 'passive';
  badge?: number;
}

/**
 * Sends a push notification to an Expo Push Token via Expo's HTTP API.
 * Inspects ticket responses and automatically purges dead/unregistered tokens.
 */
export async function sendPushNotification(
  db?: IDatabaseRepository,
  userId?: string,
  pushToken?: string,
  payload?: PushNotificationPayload
): Promise<boolean> {
  if (!pushToken || typeof pushToken !== 'string' || !pushToken.startsWith('ExponentPushToken[')) {
    // If no valid Expo push token is registered, log and return gracefully
    return false;
  }

  if (!payload) {
    return false;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        sound: payload.sound || 'default',
        priority: payload.priority || 'high',
        channelId: payload.channelId,
        categoryId: payload.categoryId,
        _displayInForeground: true,
        interruptionLevel: payload.interruptionLevel,
        badge: payload.badge,
      }),
    });

    if (!response.ok) {
      console.warn(`[PushNotification] Expo push service HTTP status ${response.status}`);
      return false;
    }

    const resData = (await response.json()) as any;
    const tickets = Array.isArray(resData?.data) ? resData.data : [resData?.data];
    let allOk = true;

    for (const ticket of tickets) {
      if (ticket?.status === 'error') {
        allOk = false;
        if (ticket?.details?.error === 'DeviceNotRegistered' && db && userId) {
          console.warn(`[PushNotification] Purging dead/unregistered push token for user ${userId}`);
          if (db.updateUserPushToken) {
            await db.updateUserPushToken(userId, '');
          }
        } else {
          console.warn(`[PushNotification] Expo push ticket error: ${ticket?.message || ticket?.details?.error}`);
        }
      }
    }

    return allOk && resData?.data?.status !== 'error';
  } catch (err: any) {
    console.warn(`[PushNotification] Failed to send push notification to token ${pushToken}:`, err.message);
    return false;
  }
}

/**
 * Dispatches an urgent, actionable push notification when a task requires user sign-off.
 */
export async function dispatchApprovalAlert(
  db: IDatabaseRepository,
  user: User,
  task: Task,
  approval: Approval
): Promise<boolean> {
  const token = user.profile?.pushToken;
  if (!token) return false;

  const toolDisplay = approval.toolName.split('.')[1] || approval.toolName;
  const title = `Sign-off Required: ${toolDisplay}`;
  const body = `${approval.description}\nTap to approve or reject.`;

  const payload: PushNotificationPayload = {
    title,
    body,
    sound: 'default',
    priority: 'high',
    channelId: 'relay-approvals',
    categoryId: NOTIFICATION_CATEGORIES.APPROVAL_ACTIONS,
    interruptionLevel: 'timeSensitive',
    data: {
      taskId: task.id,
      approvalId: approval.id,
      routineId: task.routineId,
      type: 'approval_request',
      toolName: approval.toolName,
      goal: task.goal,
    },
  };

  return sendPushNotification(db, user.id, token, payload);
}

/**
 * Dispatches a completion notification when an unattended scheduled routine finishes.
 */
export async function dispatchTaskCompletionAlert(
  db: IDatabaseRepository,
  user: User,
  task: Task
): Promise<boolean> {
  const token = user.profile?.pushToken;
  if (!token) return false;

  const title = `Task Completed`;
  const snippet = task.finalAnswer
    ? task.finalAnswer.slice(0, 120)
    : `Finished: "${task.goal.slice(0, 80)}"`;

  const payload: PushNotificationPayload = {
    title,
    body: snippet,
    sound: 'default',
    priority: 'default',
    channelId: 'relay-updates',
    data: {
      taskId: task.id,
      routineId: task.routineId,
      type: 'task_completed',
      goal: task.goal,
    },
  };

  return sendPushNotification(db, user.id, token, payload);
}

/**
 * Dispatches a failure notification when an unattended scheduled routine encounters an error.
 */
export async function dispatchTaskFailureAlert(
  db: IDatabaseRepository,
  user: User,
  task: Task
): Promise<boolean> {
  const token = user.profile?.pushToken;
  if (!token) return false;

  const title = `Task Execution Failed`;
  const snippet = task.error
    ? task.error.slice(0, 120)
    : `Failed executing: "${task.goal.slice(0, 80)}"`;

  const payload: PushNotificationPayload = {
    title,
    body: snippet,
    sound: 'default',
    priority: 'default',
    channelId: 'relay-updates',
    data: {
      taskId: task.id,
      routineId: task.routineId,
      type: 'task_failed',
      goal: task.goal,
    },
  };

  return sendPushNotification(db, user.id, token, payload);
}
