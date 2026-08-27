import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { Planner } from '../../src/agent/planner.js';
import { Task, User } from '@relay/shared-types';
import { initializeTools } from '../../src/tools/index.js';

describe('AgentOrchestrator Push Notification Triggers', () => {
  let db: InMemoryRepository;
  let orchestrator: AgentOrchestrator;
  let testUser: User;
  let originalFetch: typeof global.fetch;
  let fetchRequests: any[] = [];

  beforeAll(() => {
    initializeTools();
  });

  beforeEach(async () => {
    db = new InMemoryRepository();
    orchestrator = new AgentOrchestrator(db);
    testUser = {
      id: 'test-user-orchestrator-push',
      profile: {
        name: 'Pilot User',
        email: 'pilot@example.com',
        createdAt: new Date().toISOString(),
        timezone: 'UTC',
        pushToken: 'ExponentPushToken[device-test-orchestrator]',
      },
      settings: {
        voiceEnabled: true,
        defaultProvider: 'groq',
        autoApproveLowRisk: true,
      },
    };
    await db.saveUser(testUser);

    fetchRequests = [];
    originalFetch = global.fetch;
    global.fetch = (async (url: any, opts: any) => {
      fetchRequests.push({ url, body: JSON.parse(opts.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 'ok' } }),
      } as any;
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('triggers approval push alert when task hits WAITING_APPROVAL on high-risk tool', async () => {
    class HighRiskPlanner extends Planner {
      async getNextStep(): Promise<any> {
        return {
          type: 'tool_call',
          toolCalls: [
            {
              id: 'call-approval-1',
              name: 'calendar.createEvent',
              args: { title: 'Team Sync', startTime: '2026-09-01T10:00:00Z', endTime: '2026-09-01T11:00:00Z' },
            },
          ],
        };
      }
    }

    const task: Task = {
      id: 'task-push-approval-1',
      userId: testUser.id,
      goal: 'Create team calendar event',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      iterations: 0,
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const finalTask = await orchestrator.runTask(task, testUser, new HighRiskPlanner(testUser));

    expect(finalTask.status).toBe('WAITING_APPROVAL');
    expect(finalTask.pendingApproval).toBeDefined();

    // Verify push notification was dispatched
    expect(fetchRequests.length).toBe(1);
    expect(fetchRequests[0].body.to).toBe('ExponentPushToken[device-test-orchestrator]');
    expect(fetchRequests[0].body.categoryId).toBe('APPROVAL_ACTIONS');
    expect(fetchRequests[0].body.channelId).toBe('relay-approvals');
    expect(fetchRequests[0].body.data.approvalId).toBe(finalTask.pendingApproval?.id);
  });

  it('triggers task completion push alert when scheduled routine completes', async () => {
    class RoutinePlanner extends Planner {
      async getNextStep(): Promise<any> {
        return {
          type: 'final_answer',
          text: 'Morning briefing prepared: No urgent emails and first meeting is at 2pm.',
        };
      }
    }

    const scheduledTask: Task = {
      id: 'task-sched-complete-1',
      userId: testUser.id,
      goal: 'Morning Briefing',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      iterations: 0,
      source: 'scheduled',
      routineId: 'routine-morning-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const finalTask = await orchestrator.runTask(scheduledTask, testUser, new RoutinePlanner(testUser));

    expect(finalTask.status).toBe('COMPLETED');
    expect(fetchRequests.length).toBe(1);
    expect(fetchRequests[0].body.channelId).toBe('relay-updates');
    expect(fetchRequests[0].body.title).toContain('Task Completed');
    expect(fetchRequests[0].body.data.type).toBe('task_completed');
    expect(fetchRequests[0].body.data.routineId).toBe('routine-morning-1');
  });

  it('does NOT trigger task completion push for manual tasks to avoid double-notifying live screens', async () => {
    class ManualTaskPlanner extends Planner {
      async getNextStep(): Promise<any> {
        return {
          type: 'final_answer',
          text: 'Here is the current weather forecast.',
        };
      }
    }

    const manualTask: Task = {
      id: 'task-manual-complete-1',
      userId: testUser.id,
      goal: 'Check today weather',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      iterations: 0,
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const finalTask = await orchestrator.runTask(manualTask, testUser, new ManualTaskPlanner(testUser));

    expect(finalTask.status).toBe('COMPLETED');
    // For manual tasks, live polling handles the UI, so no completion push is dispatched
    expect(fetchRequests.length).toBe(0);
  });
});
