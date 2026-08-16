import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { Planner } from '../../src/agent/planner.js';
import { MockProvider } from '../../src/agent/providers/MockProvider.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { initializeTools } from '../../src/tools/index.js';
import { Task, User } from '@relay/shared-types';

describe('Rahul Meeting E2E Scenario Test', () => {
  let db: InMemoryRepository;
  let orchestrator: AgentOrchestrator;

  const mockUser: User = {
    id: 'pilot-user-1',
    profile: { name: 'Chandra Shekhar', email: 'chandra@example.com', createdAt: new Date().toISOString() },
    settings: { voiceEnabled: true, defaultProvider: 'groq', autoApproveLowRisk: true },
  };

  beforeAll(() => {
    initializeTools();
  });

  beforeEach(() => {
    db = new InMemoryRepository();
    orchestrator = new AgentOrchestrator(db);
  });

  test('Runs end-to-end: Contact Lookup -> Availability Check -> Event Creation -> User Approval -> Final Verification', async () => {
    const multiStepMockProvider = new MockProvider([
      // Step 1: Search contact for Rahul
      {
        type: 'tool_call',
        toolCalls: [
          {
            id: 'step-1-contact',
            name: 'contacts.search',
            args: { query: 'Rahul', maxResults: 1 },
          },
        ],
        text: 'Looking up Rahul contact information.',
      },
      // Step 2: Check calendar availability for Tuesday afternoon
      {
        type: 'tool_call',
        toolCalls: [
          {
            id: 'step-2-avail',
            name: 'calendar.findAvailability',
            args: {
              timeMin: '2026-08-18T12:00:00+05:30',
              timeMax: '2026-08-18T18:00:00+05:30',
              durationMinutes: 30,
              attendeeEmails: ['rahul@example.com'],
            },
          },
        ],
        text: 'Checking available meeting slots on Tuesday afternoon.',
      },
      // Step 3: Propose creating calendar event at 3:00 PM (Requires Approval)
      {
        type: 'tool_call',
        toolCalls: [
          {
            id: 'step-3-create',
            name: 'calendar.createEvent',
            args: {
              summary: 'Sync: Project Roadmap with Rahul',
              description: 'Catchup on project roadmap and sprint planning',
              startTime: '2026-08-18T15:00:00+05:30',
              endTime: '2026-08-18T15:30:00+05:30',
              attendees: ['rahul@example.com'],
              idempotencyKey: 'idemp-rahul-meeting-20260818',
            },
          },
        ],
        text: 'Found open slot at 3:00 PM. Requesting confirmation to create calendar invite.',
      },
      // Step 4: Final answer post-approval
      {
        type: 'final_answer',
        text: 'I found Rahul (rahul@example.com), confirmed you are both free at 3:00 PM on Tuesday, August 18, and scheduled the meeting "Sync: Project Roadmap with Rahul". The invite has been sent and verified.',
      },
    ]);

    const customPlanner = new Planner(mockUser, multiStepMockProvider);

    const task: Task = {
      id: 'task-rahul-e2e',
      userId: mockUser.id,
      goal: 'Find time with Rahul on Tuesday afternoon and book a 30-minute sync',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      iterations: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveTask(task);

    // Initial run executes Step 1 (contacts.search) and Step 2 (calendar.findAvailability), then hits Step 3 and pauses
    const pausedTask = await orchestrator.runTask(task, mockUser, customPlanner);

    expect(pausedTask.status).toBe('WAITING_APPROVAL');
    expect(pausedTask.pendingApproval).toBeDefined();
    expect(pausedTask.pendingApproval?.action).toBe('calendar.createEvent');
    expect(pausedTask.pendingApproval?.args.attendees).toContain('rahul@example.com');

    // Verify events logged up to this point
    const eventsBeforeApproval = await db.getTaskEvents(task.id);
    expect(eventsBeforeApproval.some((e) => e.type === 'approval_request')).toBe(true);

    // User approves via Approval Card UI
    const completedTask = await orchestrator.resumeWithApproval(
      pausedTask.id,
      pausedTask.pendingApproval!.id,
      'approved',
      mockUser,
      customPlanner
    );

    expect(completedTask.status).toBe('COMPLETED');
    expect(completedTask.finalAnswer).toContain('scheduled the meeting "Sync: Project Roadmap with Rahul"');

    // Verify all steps succeeded and were verified
    const finalEvents = await db.getTaskEvents(task.id);
    const verifiedToolEvents = finalEvents.filter((e) => e.status === 'verified' || e.status === 'succeeded');
    expect(verifiedToolEvents.length).toBeGreaterThanOrEqual(3);
  });
});
