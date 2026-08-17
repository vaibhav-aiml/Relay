import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { Planner } from '../../src/agent/planner.js';
import { MockProvider } from '../../src/agent/providers/MockProvider.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { initializeTools } from '../../src/tools/index.js';
import { Task, User } from '@relay/shared-types';

describe('Agent Orchestrator Integration Tests', () => {
  let db: InMemoryRepository;
  let orchestrator: AgentOrchestrator;
  const mockUser: User = {
    id: 'user-123',
    profile: { name: 'Chandra', email: 'chandra@example.com', createdAt: new Date().toISOString() },
    settings: { voiceEnabled: true, defaultProvider: 'groq', autoApproveLowRisk: true },
  };

  beforeAll(() => {
    initializeTools();
  });

  beforeEach(() => {
    db = new InMemoryRepository();
    orchestrator = new AgentOrchestrator(db);
  });

  test('executes low-risk plan and reaches COMPLETED state', async () => {
    const mockProvider = new MockProvider([
      {
        type: 'tool_call',
        toolCalls: [{ id: 'call-1', name: 'web.search', args: { query: 'Weather today', maxResults: 1 } }],
        text: 'Searching for today weather.',
      },
      {
        type: 'final_answer',
        text: 'The weather today is pleasant with clear skies.',
      },
    ]);

    const customPlanner = new Planner(mockUser, mockProvider);

    const task: Task = {
      id: 'task-low-risk',
      userId: mockUser.id,
      goal: 'Check the weather today',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      iterations: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveTask(task);
    const result = await orchestrator.runTask(task, mockUser, customPlanner);

    expect(result.status).toBe('COMPLETED');
    expect(result.finalAnswer).toContain('weather today is pleasant');
    expect(result.plan.length).toBe(1);
    expect(result.plan[0].toolName).toBe('web.search');
    expect(result.plan[0].status).toBe('completed');
  });

  test('pauses at WAITING_APPROVAL on high-risk calendar.createEvent and resumes upon approval', async () => {
    const mockProvider = new MockProvider([
      {
        type: 'tool_call',
        toolCalls: [
          {
            id: 'call-cal-1',
            name: 'calendar.createEvent',
            args: {
              summary: 'Sync with Rahul',
              startTime: '2026-08-18T15:00:00+05:30',
              endTime: '2026-08-18T15:30:00+05:30',
              attendees: ['rahul@example.com'],
              idempotencyKey: 'idemp-key-test-1234',
            },
          },
        ],
        text: 'Proposing to create calendar meeting with Rahul.',
      },
      {
        type: 'final_answer',
        text: 'Meeting with Rahul has been successfully scheduled and verified in your calendar.',
      },
    ]);

    const customPlanner = new Planner(mockUser, mockProvider);

    const task: Task = {
      id: 'task-high-risk',
      userId: mockUser.id,
      goal: 'Schedule a meeting with Rahul on Tuesday at 3 PM',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      iterations: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveTask(task);

    // Initial run should pause at WAITING_APPROVAL
    const pausedTask = await orchestrator.runTask(task, mockUser, customPlanner);

    expect(pausedTask.status).toBe('WAITING_APPROVAL');
    expect(pausedTask.pendingApproval).toBeDefined();
    expect(pausedTask.pendingApproval?.toolName).toBe('calendar.createEvent');
    expect(pausedTask.pendingApproval?.riskLevel).toBe('HIGH');

    // Simulate user approving the action via UI
    const resumedTask = await orchestrator.resumeWithApproval(
      pausedTask.id,
      pausedTask.pendingApproval!.id,
      'approved',
      mockUser,
      customPlanner
    );

    expect(resumedTask.status).toBe('COMPLETED');
    expect(resumedTask.finalAnswer).toContain('Meeting with Rahul has been successfully scheduled');
  });

  test('pauses at WAITING_APPROVAL on telephony.makeCall and prepares dialerUrl upon approval', async () => {
    const mockProvider = new MockProvider([
      {
        type: 'tool_call',
        toolCalls: [
          {
            id: 'call-contact-search-1',
            name: 'contacts.search',
            args: { query: 'Rahul', maxResults: 1 },
          },
        ],
        text: 'Searching for Rahul in contacts.',
      },
      {
        type: 'tool_call',
        toolCalls: [
          {
            id: 'call-phone-1',
            name: 'telephony.makeCall',
            args: {
              recipientName: 'Rahul',
              phoneNumber: '+91 98765 43210',
              reason: 'Discuss project roadmap',
            },
          },
        ],
        text: 'Found Rahul (+91 98765 43210). Requesting confirmation to place phone call.',
      },
      {
        type: 'final_answer',
        text: 'Phone dialer has been prepared with Rahul (+91 98765 43210).',
      },
    ]);

    const customPlanner = new Planner(mockUser, mockProvider);

    const task: Task = {
      id: 'task-phone-call',
      userId: mockUser.id,
      goal: 'Call Rahul to discuss project roadmap',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      iterations: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveTask(task);

    // Initial run executes contacts.search (LOW risk) then pauses on telephony.makeCall (HIGH risk)
    const pausedTask = await orchestrator.runTask(task, mockUser, customPlanner);

    expect(pausedTask.status).toBe('WAITING_APPROVAL');
    expect(pausedTask.pendingApproval).toBeDefined();
    expect(pausedTask.pendingApproval?.toolName).toBe('telephony.makeCall');
    expect(pausedTask.pendingApproval?.riskLevel).toBe('HIGH');
    expect(pausedTask.pendingApproval?.description).toContain('Call Rahul at +91 98765 43210');

    // Simulate user approving via UI
    const resumedTask = await orchestrator.resumeWithApproval(
      pausedTask.id,
      pausedTask.pendingApproval!.id,
      'approved',
      mockUser,
      customPlanner
    );

    expect(resumedTask.status).toBe('COMPLETED');
    expect(resumedTask.finalAnswer).toContain('Phone dialer has been prepared with Rahul');
    const callStep = resumedTask.plan.find((s) => s.toolName === 'telephony.makeCall');
    expect(callStep).toBeDefined();
    expect(callStep?.status).toBe('completed');
    expect((callStep?.result as Record<string, any> | undefined)?.dialerUrl).toBe('tel:+919876543210');
  });
});
