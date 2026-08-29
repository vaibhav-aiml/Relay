import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { initializeTools } from '../../src/tools/index.js';
import { Task, User } from '@relay/shared-types';
import { Planner } from '../../src/agent/planner.js';

describe('Multi-Agent Swarm Orchestration End-to-End Integration Test', () => {
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
      id: 'swarm-e2e-user',
      profile: {
        name: 'Vaibhav',
        email: 'vaibhav@example.com',
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

  it('orchestrates 2-stage parallel swarm: Calendar & Food -> Communicator -> Aggregate Report', async () => {
    class MockSwarmScenarioPlanner extends Planner {
      async getNextStep(messages: any[]): Promise<any> {
        const sysMsg = messages.find((m) => m.role === 'system')?.content || '';

        // 1. Goal Decomposer Prompt
        if (sysMsg.includes('Goal Decomposer')) {
          return {
            type: 'final_answer',
            text: JSON.stringify({
              isDecomposed: true,
              strategy: 'swarm_pipeline',
              summary: 'Parallel calendar check and food search followed by WhatsApp invite',
              subtasks: [
                {
                  id: 'sub-cal',
                  name: 'Calendar Availability Check',
                  agentType: 'calendar_negotiator',
                  goal: 'Find 30m free slot with Rahul on Tuesday afternoon',
                  stage: 1,
                  dependencies: [],
                },
                {
                  id: 'sub-food',
                  name: 'Pizza Discovery',
                  agentType: 'food_specialist',
                  goal: 'Find top Italian pizza on Swiggy under ₹500',
                  stage: 1,
                  dependencies: [],
                },
                {
                  id: 'sub-comms',
                  name: 'WhatsApp Dispatch',
                  agentType: 'communicator',
                  goal: 'WhatsApp Rahul with the meeting time and pizza order details',
                  stage: 2,
                  dependencies: ['sub-cal', 'sub-food'],
                },
              ],
            }),
          };
        }

        // 2. Calendar Negotiator
        if (sysMsg.includes('You are the Calendar Negotiator')) {
          const lastTool = messages.find((m) => m.role === 'tool');
          if (!lastTool) {
            return {
              type: 'tool_call',
              toolCalls: [
                {
                  id: 'call-cal-1',
                  name: 'calendar.findAvailability',
                  args: { timeMin: '2026-09-01T14:00:00Z', timeMax: '2026-09-01T18:00:00Z', durationMinutes: 30 },
                },
              ],
            };
          }
          return {
            type: 'final_answer',
            text: 'Found 30m free slot on Tuesday at 3:00 PM UTC.',
          };
        }

        // 3. Food Specialist
        if (sysMsg.includes('You are the Food Specialist')) {
          const lastTool = messages.find((m) => m.role === 'tool');
          if (!lastTool) {
            return {
              type: 'tool_call',
              toolCalls: [
                {
                  id: 'call-food-1',
                  name: 'food.searchOptions',
                  args: { query: 'Italian Pizza', platform: 'swiggy', maxPrice: 500 },
                },
              ],
            };
          }
          return {
            type: 'final_answer',
            text: 'Found Margherita Pizza from Tossin Pizza for ₹399 on Swiggy.',
          };
        }

        // 4. Communicator
        if (sysMsg.includes('You are the Communicator Agent')) {
          const lastTool = messages.find((m) => m.role === 'tool');
          if (!lastTool) {
            return {
              type: 'tool_call',
              toolCalls: [
                {
                  id: 'call-comms-1',
                  name: 'messaging.sendWhatsApp',
                  args: {
                    recipientName: 'Rahul',
                    phoneNumber: '+919876543210',
                    messageBody: 'Hey Rahul, let us meet Tuesday at 3:00 PM. I am ordering Margherita Pizza from Tossin Pizza via Swiggy!',
                  },
                },
              ],
            };
          }
          return {
            type: 'final_answer',
            text: 'WhatsApp message sent to Rahul.',
          };
        }

        // 5. Aggregate Reporter Synthesis
        if (sysMsg.includes('executive AI agent coordinator')) {
          return {
            type: 'final_answer',
            text: 'All set! I verified a 30m slot on Tuesday at 3:00 PM with Rahul, found Margherita Pizza for ₹399 on Swiggy, and sent Rahul the WhatsApp update.',
          };
        }

        return { type: 'final_answer', text: 'Task completed.' };
      }
    }

    const task: Task = {
      id: 'composite-swarm-task-1',
      userId: testUser.id,
      goal: 'Find 30m with Rahul on Tuesday afternoon, find pizza on Swiggy under ₹500, and WhatsApp Rahul the proposed plan',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      pendingApprovals: [],
      iterations: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const planner = new MockSwarmScenarioPlanner(testUser);
    const initialRun = await orchestrator.runTask(task, testUser, planner);

    // Communicator calling messaging.sendWhatsApp requires approval
    expect(initialRun.status).toBe('WAITING_APPROVAL');
    expect(initialRun.isSwarm).toBe(true);
    expect(initialRun.subtasks?.length).toBe(3);

    // Stage 1 workers should already be completed!
    const calSubtask = initialRun.subtasks?.find((s) => s.agentType === 'calendar_negotiator');
    const foodSubtask = initialRun.subtasks?.find((s) => s.agentType === 'food_specialist');
    const commsSubtask = initialRun.subtasks?.find((s) => s.agentType === 'communicator');

    expect(calSubtask?.status).toBe('completed');
    expect(calSubtask?.result).toContain('3:00 PM');
    expect(foodSubtask?.status).toBe('completed');
    expect(foodSubtask?.result).toContain('Margherita Pizza');

    // Stage 2 communicator is waiting for approval on WhatsApp dispatch
    expect(commsSubtask?.status).toBe('waiting_approval');
    expect(initialRun.pendingApprovals.length).toBe(1);
    expect(initialRun.pendingApprovals[0].toolName).toBe('messaging.sendWhatsApp');

    // Approve the WhatsApp message
    const completedTask = await orchestrator.resumeWithApproval(
      task.id,
      initialRun.pendingApprovals[0].id,
      'approved',
      testUser,
      planner
    );

    // Verify entire swarm is now COMPLETED
    expect(completedTask.status).toBe('COMPLETED');
    expect(completedTask.pendingApprovals.length).toBe(0);
    expect(completedTask.subtasks?.every((s) => s.status === 'completed')).toBe(true);
    expect(completedTask.finalAnswer).toContain('Rahul');

    // Verify all swarm events logged in chronological sequence
    const events = await db.getTaskEvents(task.id);
    expect(events.some((e) => e.type === 'subagent_spawned')).toBe(true);
    expect(events.some((e) => e.type === 'subagent_started')).toBe(true);
    expect(events.some((e) => e.type === 'subagent_completed')).toBe(true);
    expect(events.some((e) => e.type === 'swarm_aggregated')).toBe(true);
  });
});
