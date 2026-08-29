import { jest } from '@jest/globals';
import { WorkerAgent } from '../../src/agent/swarm/WorkerAgent.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { initializeTools } from '../../src/tools/index.js';
import { SubAgentTask, User } from '@relay/shared-types';
import { Planner } from '../../src/agent/planner.js';

describe('WorkerAgent Unit Tests', () => {
  let db: InMemoryRepository;
  let testUser: User;

  beforeAll(() => {
    initializeTools();
  });

  beforeEach(async () => {
    db = new InMemoryRepository();
    testUser = {
      id: 'worker-test-user',
      profile: {
        name: 'Worker Tester',
        email: 'worker@example.com',
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

  it('executes scoped tools within archetype and completes without calling db.saveTask', async () => {
    const saveTaskSpy = jest.spyOn(db, 'saveTask');

    class MockResearcherPlanner extends Planner {
      private step = 0;
      async getNextStep(): Promise<any> {
        this.step++;
        if (this.step === 1) {
          return {
            type: 'tool_call',
            toolCalls: [
              {
                id: 'call-web-1',
                name: 'web.search',
                args: { query: 'TypeScript 5.8 features' },
              },
            ],
            text: 'Searching web for TypeScript 5.8',
          };
        }
        return {
          type: 'final_answer',
          text: 'Found 3 major features in TypeScript 5.8.',
        };
      }
    }

    const subtask: SubAgentTask = {
      id: 'sub-research-1',
      parentTaskId: 'parent-task-1',
      agentType: 'researcher',
      name: 'TypeScript Research',
      goal: 'Research TypeScript 5.8 features',
      stage: 1,
      dependencies: [],
      status: 'pending',
      plan: [],
    };

    const mockParentTask: any = {
      id: 'parent-task-1',
      userId: testUser.id,
      goal: 'Research TypeScript 5.8 features',
      status: 'EXECUTING',
      plan: [],
      pendingApprovals: [],
    };

    const planner = new MockResearcherPlanner(testUser);
    const result = await WorkerAgent.execute(subtask, {
      parentTask: mockParentTask,
      user: testUser,
      db,
      planner,
    });

    // Invariant: WorkerAgent must never call saveTask
    expect(saveTaskSpy).not.toHaveBeenCalled();

    // Result should be completed
    expect(result.status).toBe('completed');
    expect(result.result).toBe('Found 3 major features in TypeScript 5.8.');
    expect(result.plan.length).toBe(1);
    expect(result.plan[0].status).toBe('completed');

    // Events should be logged
    const events = await db.getTaskEvents('parent-task-1');
    expect(events.some((e) => e.type === 'subagent_started')).toBe(true);
    expect(events.some((e) => e.type === 'subagent_completed')).toBe(true);
  });

  it('rejects tool calls that fall outside the archetype whitelist', async () => {
    // Researcher trying to call food.prepareOrder (not in researcher whitelist)
    class MockIllegalPlanner extends Planner {
      async getNextStep(): Promise<any> {
        return {
          type: 'tool_call',
          toolCalls: [
            {
              id: 'call-illegal-1',
              name: 'food.prepareOrder',
              args: { itemName: 'Burger', restaurantName: 'Diner', platform: 'swiggy' },
            },
          ],
        };
      }
    }

    const subtask: SubAgentTask = {
      id: 'sub-illegal-1',
      parentTaskId: 'parent-task-1',
      agentType: 'researcher', // Researcher cannot order food!
      name: 'Illegal Action',
      goal: 'Order burger',
      stage: 1,
      dependencies: [],
      status: 'pending',
      plan: [],
    };

    const mockParentTask: any = {
      id: 'parent-task-1',
      userId: testUser.id,
      goal: 'Illegal Order Mission',
      status: 'EXECUTING',
      plan: [],
      pendingApprovals: [],
    };

    const planner = new MockIllegalPlanner(testUser);
    const result = await WorkerAgent.execute(subtask, {
      parentTask: mockParentTask,
      user: testUser,
      db,
      planner,
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('outside the authorized scope for Researcher Agent');
  });

  it('pauses at waiting_approval and tags Approval with subTaskId and agentType for high-risk actions', async () => {
    class MockApprovalPlanner extends Planner {
      async getNextStep(): Promise<any> {
        return {
          type: 'tool_call',
          toolCalls: [
            {
              id: 'call-order-1',
              name: 'food.prepareOrder',
              args: { itemName: 'Cold Coffee', restaurantName: 'Starbucks', platform: 'zomato', estimatedPrice: 140 },
            },
          ],
        };
      }
    }

    const subtask: SubAgentTask = {
      id: 'sub-food-1',
      parentTaskId: 'parent-task-1',
      agentType: 'food_specialist',
      name: 'Order Coffee',
      goal: 'Order cold coffee',
      stage: 1,
      dependencies: [],
      status: 'pending',
      plan: [],
    };

    const mockParentTask: any = {
      id: 'parent-task-1',
      userId: testUser.id,
      goal: 'Order Cold Coffee on Zomato',
      status: 'EXECUTING',
      plan: [],
      pendingApprovals: [],
    };

    const planner = new MockApprovalPlanner(testUser);
    const result = await WorkerAgent.execute(subtask, {
      parentTask: mockParentTask,
      user: testUser,
      db,
      planner,
    });

    expect(result.status).toBe('waiting_approval');
    expect(result.pendingApproval).toBeDefined();
    expect(result.pendingApproval?.subTaskId).toBe('sub-food-1');
    expect(result.pendingApproval?.agentType).toBe('food_specialist');
    expect(result.pendingApproval?.toolName).toBe('food.prepareOrder');

    // DB approval record check
    const dbApproval = await db.getApproval(result.pendingApproval!.id);
    expect(dbApproval).toBeDefined();
    expect(dbApproval?.subTaskId).toBe('sub-food-1');
  });
});
