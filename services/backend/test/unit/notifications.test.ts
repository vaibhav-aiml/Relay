import { sendPushNotification, dispatchApprovalAlert, dispatchTaskCompletionAlert, dispatchTaskFailureAlert } from '../../src/scheduler/notifications.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { User, Task, Approval, NOTIFICATION_CATEGORIES } from '@relay/shared-types';

describe('Backend Push Notifications & Dispatcher Unit Tests', () => {
  let db: InMemoryRepository;
  let mockUser: User;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    db = new InMemoryRepository();
    mockUser = {
      id: 'test-user-push',
      profile: {
        name: 'Test Pilot',
        email: 'pilot@example.com',
        createdAt: new Date().toISOString(),
        pushToken: 'ExponentPushToken[mock-device-token-123]',
      },
      settings: {
        voiceEnabled: true,
        defaultProvider: 'groq',
        autoApproveLowRisk: true,
      },
    };
    await db.saveUser(mockUser);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects invalid or missing push tokens without calling fetch', async () => {
    let fetchCalled = false;
    global.fetch = (async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({ data: { status: 'ok' } }) } as any;
    }) as any;

    const res1 = await sendPushNotification(db, mockUser.id, undefined, { title: 'T', body: 'B' });
    const res2 = await sendPushNotification(db, mockUser.id, 'invalid-non-expo-token', { title: 'T', body: 'B' });

    expect(res1).toBe(false);
    expect(res2).toBe(false);
    expect(fetchCalled).toBe(false);
  });

  it('sends push notification with category and channel to Expo push API', async () => {
    let capturedBody: any = null;

    global.fetch = (async (url: any, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 'ok', id: 'ticket-1' } }),
      } as any;
    }) as any;

    const approval: Approval = {
      id: 'appr-123',
      taskId: 'task-456',
      userId: mockUser.id,
      toolName: 'calendar.createEvent',
      action: 'CALENDAR_WRITE',
      description: 'Create event "Lunch Meeting"',
      riskLevel: 'HIGH',
      args: { title: 'Lunch Meeting' },
      requestedAt: new Date().toISOString(),
    };

    const task: Task = {
      id: 'task-456',
      userId: mockUser.id,
      goal: 'Schedule lunch with Rahul',
      status: 'WAITING_APPROVAL',
      plan: [],
      currentStep: 1,
      iterations: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const success = await dispatchApprovalAlert(db, mockUser, task, approval);

    expect(success).toBe(true);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody.to).toBe('ExponentPushToken[mock-device-token-123]');
    expect(capturedBody.categoryId).toBe(NOTIFICATION_CATEGORIES.APPROVAL_ACTIONS);
    expect(capturedBody.channelId).toBe('relay-approvals');
    expect(capturedBody.priority).toBe('high');
    expect(capturedBody.interruptionLevel).toBe('timeSensitive');
    expect(capturedBody.data.taskId).toBe('task-456');
    expect(capturedBody.data.approvalId).toBe('appr-123');
  });

  it('purges dead push token when Expo returns DeviceNotRegistered error ticket', async () => {
    global.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            status: 'error',
            message: 'The recipient device is not registered with FCM/APNs',
            details: { error: 'DeviceNotRegistered' },
          },
        }),
      } as any;
    }) as any;

    const success = await sendPushNotification(
      db,
      mockUser.id,
      mockUser.profile.pushToken,
      { title: 'Test', body: 'Checking ticket' }
    );

    expect(success).toBe(false);

    // Verify token was cleared from user profile
    const updatedUser = await db.getUser(mockUser.id);
    expect(updatedUser?.profile.pushToken).toBe('');
  });

  it('dispatches task completion alert for scheduled routines', async () => {
    let capturedBody: any = null;

    global.fetch = (async (url: any, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ status: 'ok' }] }),
      } as any;
    }) as any;

    const task: Task = {
      id: 'task-sched-1',
      userId: mockUser.id,
      goal: 'Morning stock briefing',
      finalAnswer: 'Nifty is up 0.8% and tech stocks rallied.',
      status: 'COMPLETED',
      source: 'scheduled',
      routineId: 'routine-morning',
      plan: [],
      currentStep: 2,
      iterations: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const success = await dispatchTaskCompletionAlert(db, mockUser, task);

    expect(success).toBe(true);
    expect(capturedBody.channelId).toBe('relay-updates');
    expect(capturedBody.title).toContain('Task Completed');
    expect(capturedBody.body).toContain('Nifty is up 0.8%');
    expect(capturedBody.data.type).toBe('task_completed');
  });

  it('dispatches task failure alert for scheduled routines', async () => {
    let capturedBody: any = null;

    global.fetch = (async (url: any, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ status: 'ok' }] }),
      } as any;
    }) as any;

    const task: Task = {
      id: 'task-sched-2',
      userId: mockUser.id,
      goal: 'Check server logs',
      error: 'Google API quota exceeded (HTTP 429)',
      status: 'FAILED',
      source: 'scheduled',
      routineId: 'routine-audit',
      plan: [],
      currentStep: 1,
      iterations: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const success = await dispatchTaskFailureAlert(db, mockUser, task);

    expect(success).toBe(true);
    expect(capturedBody.channelId).toBe('relay-updates');
    expect(capturedBody.title).toContain('Failed');
    expect(capturedBody.body).toContain('Google API quota exceeded');
    expect(capturedBody.data.type).toBe('task_failed');
  });
});
