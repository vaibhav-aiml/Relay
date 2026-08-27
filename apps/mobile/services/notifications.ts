import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_ACTIONS, PushNotificationData } from '@relay/shared-types';
import { ApiService } from './api';

// 1. Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export class MobileNotificationService {
  private static isInitialized = false;

  /**
   * Sets up Android notification channels and interactive categories on iOS/Android.
   */
  public static async setupChannelsAndCategories(): Promise<void> {
    if (this.isInitialized) return;
    if (Platform.OS === 'web') {
      this.isInitialized = true;
      return;
    }

    // 1. Setup Android Channels
    if (Platform.OS === 'android') {
      // High importance channel for approval sign-offs (heads-up banners, vibration, sound)
      await Notifications.setNotificationChannelAsync('relay-approvals', {
        name: 'Approval Requests',
        description: 'Urgent action sign-offs and security approvals',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
        enableVibrate: true,
        enableLights: true,
        sound: 'default',
      });

      // Default channel for routine updates and completion alerts
      await Notifications.setNotificationChannelAsync('relay-updates', {
        name: 'Routine & Task Updates',
        description: 'Notifications when scheduled routines start or finish',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    // 2. Setup Interactive Action Categories (opensAppToForeground: true for 100% reliable execution)
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.APPROVAL_ACTIONS, [
      {
        identifier: NOTIFICATION_ACTIONS.APPROVE,
        buttonTitle: 'Approve',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: NOTIFICATION_ACTIONS.REJECT,
        buttonTitle: 'Reject',
        options: {
          opensAppToForeground: true,
          isDestructive: true,
        },
      },
      {
        identifier: NOTIFICATION_ACTIONS.VIEW_TASK,
        buttonTitle: 'View Task',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);

    this.isInitialized = true;
  }

  /**
   * Silently checks the current push notification permission status.
   */
  public static async checkPermissionStatus(): Promise<Notifications.PermissionStatus> {
    if (Platform.OS === 'web') {
      return Notifications.PermissionStatus.GRANTED;
    }
    const settings = await Notifications.getPermissionsAsync();
    return settings.status;
  }

  /**
   * Prompts the user for push notification permissions and registers the Expo push token with Relay backend.
   */
  public static async registerForPushNotifications(): Promise<{
    success: boolean;
    token?: string;
    status: string;
    error?: string;
  }> {
    try {
      await this.setupChannelsAndCategories();

      if (Platform.OS === 'web') {
        const webToken = 'ExponentPushToken[web-preview-active]';
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        await ApiService.registerPushToken(webToken, timezone);
        return {
          success: true,
          token: webToken,
          status: 'granted',
        };
      }

      // Check current permissions
      const existingStatus = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus.status;

      // If not determined or denied, request permissions
      if (existingStatus.status !== 'granted') {
        const requestRes = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = requestRes.status;
      }

      if (finalStatus !== 'granted') {
        return {
          success: false,
          status: finalStatus,
          error: 'Push notification permission was denied',
        };
      }

      // Check for physical device
      const isPhysicalDevice = Device.isDevice;
      let token: string | undefined;

      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ||
          Constants.easConfig?.projectId ||
          'relay-pilot-project';

        const tokenRes = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        token = tokenRes.data;
      } catch (tokenErr: any) {
        console.warn('[MobileNotificationService] getExpoPushTokenAsync warning:', tokenErr.message);

        // In simulator / development environments where remote APNs/FCM tokens are unavailable,
        // generate a local dev fallback token so the UI and backend flows can still be tested.
        if (!isPhysicalDevice) {
          token = `ExponentPushToken[dev-simulator-${Platform.OS}]`;
        }
      }

      if (token) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        await ApiService.registerPushToken(token, timezone);
        return {
          success: true,
          token,
          status: 'granted',
        };
      }

      return {
        success: false,
        status: finalStatus,
        error: 'Unable to obtain push token from device',
      };
    } catch (err: any) {
      console.warn('[MobileNotificationService] register error:', err);
      return {
        success: false,
        status: 'error',
        error: err.message,
      };
    }
  }

  /**
   * Dispatches a rich local test notification with [Approve] / [Reject] buttons for instant testing.
   */
  public static async sendLocalTestNotification(): Promise<void> {
    await this.setupChannelsAndCategories();

    if (Platform.OS === 'web') {
      Alert.alert(
        'Sign-off Required: calendar.createEvent',
        'Create event "Lunch Meeting with Rahul" on Google Calendar tomorrow at 1:00 PM.\n[Approve] or [Reject] action simulated.'
      );
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Sign-off Required: calendar.createEvent',
        body: 'Create event "Lunch Meeting with Rahul" on Google Calendar tomorrow at 1:00 PM.\nTap to approve or reject.',
        data: {
          taskId: 'test-task-local',
          approvalId: 'test-approval-local',
          type: 'approval_request',
          toolName: 'calendar.createEvent',
          goal: 'Schedule lunch meeting with Rahul',
        } as PushNotificationData,
        sound: 'default',
        categoryIdentifier: NOTIFICATION_CATEGORIES.APPROVAL_ACTIONS,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // deliver immediately
    });
  }

  /**
   * Central handler for notification taps and action button clicks.
   */
  public static async handleNotificationResponse(
    response: Notifications.NotificationResponse,
    router: any,
    onApprovalSubmit?: (approvalId: string, decision: 'approved' | 'denied') => Promise<void>
  ): Promise<void> {
    const actionId = response.actionIdentifier;
    const data = response.notification.request.content.data as unknown as (PushNotificationData | undefined);

    if (!data) return;

    const { taskId, approvalId } = data;

    // 1. User tapped the "Approve" quick button
    if (actionId === NOTIFICATION_ACTIONS.APPROVE && approvalId) {
      try {
        if (onApprovalSubmit) {
          await onApprovalSubmit(approvalId, 'approved');
        } else {
          await ApiService.submitApprovalDecision(approvalId, 'approved');
        }
      } catch (err) {
        console.warn('[MobileNotificationService] Quick approve error:', err);
      }

      if (taskId && taskId !== 'test-task-local') {
        router.push(`/task/${taskId}`);
      } else {
        Alert.alert('Approved', 'Action was approved successfully.');
      }
      return;
    }

    // 2. User tapped the "Reject" quick button
    if (actionId === NOTIFICATION_ACTIONS.REJECT && approvalId) {
      try {
        if (onApprovalSubmit) {
          await onApprovalSubmit(approvalId, 'denied');
        } else {
          await ApiService.submitApprovalDecision(approvalId, 'denied');
        }
      } catch (err) {
        console.warn('[MobileNotificationService] Quick reject error:', err);
      }

      if (taskId && taskId !== 'test-task-local') {
        router.push(`/task/${taskId}`);
      } else {
        Alert.alert('Rejected', 'Action was denied.');
      }
      return;
    }

    // 3. User tapped notification body or "View Task"
    if (taskId && taskId !== 'test-task-local') {
      router.push(`/task/${taskId}`);
    }
  }
}
