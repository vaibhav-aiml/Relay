import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { Planner } from '../../src/agent/planner.js';
import { Task, User } from '@relay/shared-types';
import { initializeTools } from '../../src/tools/index.js';

describe('AgentOrchestrator Autonomous Routines & Auto-Approval Whitelist', () => {
  let db: InMemoryRepository;
  let orchestrator: AgentOrchestrator;
  let testUser: User;

  beforeAll(() => {
    initializeTools();
  });

  beforeEach(async () => {
    db = new InMemoryRepository();
    orchestrator = new AgentOrchestrator(db);
    testUser = {
      id: 'test-auto-user',
      profile: {
        name: 'Auto User',
        email: 'auto@example.com',
        createdAt: new Date().toISOString(),
        timezone: 'UTC',
      },
      settings: {
        voiceEnabled: true,
        defaultProvider: 'groq',
        autoApproveLowRisk: true,
      },
    };
    await db.saveUser(testUser);
  });

  it('bypasses confirmation and completes when mutating tool is in preApprovedTools', async () => {
    // Mock Planner that calls messaging.sendWhatsApp (normally HIGH risk needing confirmation)
    class MockAutonomousPlanner extends Planner {
      private step = 0;
      async getNextStep(): Promise<any> {
        this.step++;
        if (this.step === 1) {
          return {
            type: 'tool_call',
            toolCalls: [
              {
                id: 'call-1',
                name: 'messaging.sendWhatsApp',
                args: { recipientName: 'Rahul', phoneNumber: '+919876543210', messageBody: 'Good morning' },
              },
            ],
          };
        }
        return {
          type: 'final_answer',
          text: 'WhatsApp sent successfully.',
        };
      }
    }

    const task: Task = {
      id: 'task-auto-1',
      userId: testUser.id,
      goal: 'WhatsApp Rahul good morning',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      pendingApprovals: [],
      iterations: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'scheduled',
      routineId: 'routine-1',
      preApprovedTools: ['messaging.sendWhatsApp'], // Whitelisted!
      autoApproveRoutine: true,
    };

    const planner = new MockAutonomousPlanner(testUser);
    const result = await orchestrator.runTask(task, testUser, planner);

    // Should complete cleanly without pausing at WAITING_APPROVAL
    expect(result.status).toBe('COMPLETED');
    expect(result.finalAnswer).toBe('WhatsApp sent successfully.');
  });

  it('pauses at WAITING_APPROVAL if mutating tool is NOT in preApprovedTools', async () => {
    class MockUnapprovedPlanner extends Planner {
      async getNextStep(): Promise<any> {
        return {
          type: 'tool_call',
          toolCalls: [
            {
              id: 'call-1',
              name: 'calendar.createEvent',
              args: { summary: 'Team Sync', startTime: '2026-08-25T10:00:00Z', endTime: '2026-08-25T10:30:00Z' },
            },
          ],
        };
      }
    }

    const task: Task = {
      id: 'task-unapproved-1',
      userId: testUser.id,
      goal: 'Create meeting',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      pendingApprovals: [],
      iterations: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'scheduled',
      routineId: 'routine-2',
      preApprovedTools: ['gmail.readMessage'], // calendar.createEvent is NOT whitelisted
      autoApproveRoutine: true,
    };

    const planner = new MockUnapprovedPlanner(testUser);
    const result = await orchestrator.runTask(task, testUser, planner);

    // Must pause at WAITING_APPROVAL for user safety
    expect(result.status).toBe('WAITING_APPROVAL');
    expect(result.pendingApprovals.length).toBe(1);
  });
});
