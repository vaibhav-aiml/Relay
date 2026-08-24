export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

/**
 * Sends a push notification to an Expo Push Token via Expo's HTTP API.
 */
export async function sendPushNotification(
  pushToken: string | undefined,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!pushToken || typeof pushToken !== 'string' || !pushToken.startsWith('ExponentPushToken[')) {
    // If no valid Expo push token is registered, log and return gracefully
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
      }),
    });

    if (!response.ok) {
      console.warn(`[PushNotification] Expo push service responded with status ${response.status}`);
      return false;
    }

    const resData = (await response.json()) as any;
    return resData?.data?.status === 'ok';

  } catch (err: any) {
    console.warn(`[PushNotification] Failed to send push notification to token ${pushToken}:`, err.message);
    return false;
  }
}
