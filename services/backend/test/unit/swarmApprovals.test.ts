import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { initializeTools } from '../../src/tools/index.js';
import { Task, User, SubAgentTask } from '@relay/shared-types';
import { Planner } from '../../src/agent/planner.js';

describe('Swarm Concurrent Approvals Queue Unit Tests', () => {
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
      id: 'swarm-approval-user',
      profile: {
        name: 'Approval Tester',
        email: 'appr@example.com',
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

  it('captures multiple simultaneous approvals in pendingApprovals array without clobbering', async () => {
    // Custom planner where Food Specialist calls food.prepareOrder and Communicator calls gmail.sendMessage
    class MockDualApprovalPlanner extends Planner {
      async getNextStep(messages: any[]): Promise<any> {
        const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
        if (sysMsg.includes('Food Specialist')) {
          return {
            type: 'tool_call',
            toolCalls: [
              {
                id: 'call-food-appr',
                name: 'food.prepareOrder',
                args: { itemName: 'Cold Coffee', restaurantName: 'Starbucks', platform: 'swiggy', estimatedPrice: 150 },
              },
            ],
          };
        }
        if (sysMsg.includes('Communicator')) {
          return {
            type: 'tool_call',
            toolCalls: [
              {
                id: 'call-email-appr',
                name: 'gmail.sendMessage',
                args: { to: ['team@example.com'], subject: 'Weekly Sync', body: 'Sync details' },
              },
            ],
          };
        }
        return { type: 'final_answer', text: 'Done' };
      }
    }

    const subtasks: SubAgentTask[] = [
      {
        id: 'sub-food-1',
        parentTaskId: 'swarm-task-1',
        agentType: 'food_specialist',
        name: 'Order Coffee',
        goal: 'Order cold coffee',
        stage: 1,
        dependencies: [],
        status: 'pending',
        plan: [],
      },
      {
        id: 'sub-comm-1',
        parentTaskId: 'swarm-task-1',
        agentType: 'communicator',
        name: 'Send Email',
        goal: 'Email team',
        stage: 1, // Concurrent Stage 1!
        dependencies: [],
        status: 'pending',
        plan: [],
      },
    ];

    const task: Task = {
      id: 'swarm-task-1',
      userId: testUser.id,
      goal: 'Order coffee and send team email',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      pendingApprovals: [],
      iterations: 0,
      isSwarm: true,
      subtasks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const planner = new MockDualApprovalPlanner(testUser);
    const result = await orchestrator.runTask(task, testUser, planner);

    // Parent task should be WAITING_APPROVAL
    expect(result.status).toBe('WAITING_APPROVAL');

    // Crucial check: BOTH approvals are captured in pendingApprovals without clobbering!
    expect(result.pendingApprovals.length).toBe(2);

    const foodAppr = result.pendingApprovals.find((a) => a.toolName === 'food.prepareOrder');
    const emailAppr = result.pendingApprovals.find((a) => a.toolName === 'gmail.sendMessage');

    expect(foodAppr).toBeDefined();
    expect(foodAppr?.subTaskId).toBe('sub-food-1');
    expect(foodAppr?.agentType).toBe('food_specialist');

    expect(emailAppr).toBeDefined();
    expect(emailAppr?.subTaskId).toBe('sub-comm-1');
    expect(emailAppr?.agentType).toBe('communicator');
  });

  it('resumes a specific worker subtask when its approval is resolved and retains remaining pending approvals', async () => {
    class MockResumablePlanner extends Planner {
      private foodStep = 0;
      private emailStep = 0;

      async getNextStep(messages: any[]): Promise<any> {
        const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
        if (sysMsg.includes('Food Specialist')) {
          this.foodStep++;
          if (this.foodStep === 1) {
            return {
              type: 'tool_call',
              toolCalls: [
                {
                  id: 'call-food-1',
                  name: 'food.prepareOrder',
                  args: { itemName: 'Cold Coffee', restaurantName: 'Starbucks', platform: 'swiggy', estimatedPrice: 150 },
                },
              ],
            };
          }
          return { type: 'final_answer', text: 'Coffee cart prepared on Swiggy.' };
        }

        if (sysMsg.includes('Communicator')) {
          this.emailStep++;
          if (this.emailStep === 1) {
            return {
              type: 'tool_call',
              toolCalls: [
                {
                  id: 'call-email-1',
                  name: 'gmail.sendMessage',
                  args: { to: ['team@example.com'], subject: 'Weekly Sync', body: 'Sync details' },
                },
              ],
            };
          }
          return { type: 'final_answer', text: 'Email sent to team.' };
        }

        return { type: 'final_answer', text: 'Swarm fully completed.' };
      }
    }

    const subtasks: SubAgentTask[] = [
      {
        id: 'sub-food-2',
        parentTaskId: 'swarm-task-2',
        agentType: 'food_specialist',
        name: 'Order Coffee',
        goal: 'Order cold coffee',
        stage: 1,
        dependencies: [],
        status: 'pending',
        plan: [],
      },
      {
        id: 'sub-comm-2',
        parentTaskId: 'swarm-task-2',
        agentType: 'communicator',
        name: 'Send Email',
        goal: 'Email team',
        stage: 1,
        dependencies: [],
        status: 'pending',
        plan: [],
      },
    ];

    const task: Task = {
      id: 'swarm-task-2',
      userId: testUser.id,
      goal: 'Order coffee and send team email',
      status: 'CREATED',
      plan: [],
      currentStep: 0,
      pendingApprovals: [],
      iterations: 0,
      isSwarm: true,
      subtasks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const planner = new MockResumablePlanner(testUser);
    const initialRun = await orchestrator.runTask(task, testUser, planner);

    expect(initialRun.status).toBe('WAITING_APPROVAL');
    expect(initialRun.pendingApprovals.length).toBe(2);

    const foodApproval = initialRun.pendingApprovals.find((a) => a.toolName === 'food.prepareOrder')!;
    const emailApproval = initialRun.pendingApprovals.find((a) => a.toolName === 'gmail.sendMessage')!;

    // Resolve ONLY the food approval first
    const afterFoodApprove = await orchestrator.resumeWithApproval(
      task.id,
      foodApproval.id,
      'approved',
      testUser,
      planner
    );

    // Food subtask should be completed
    const foodSubtask = afterFoodApprove.subtasks?.find((s) => s.id === 'sub-food-2');
    expect(foodSubtask?.status).toBe('completed');

    // Email approval should still be pending in pendingApprovals
    expect(afterFoodApprove.pendingApprovals.some((a) => a.id === emailApproval.id)).toBe(true);
    expect(afterFoodApprove.status).toBe('WAITING_APPROVAL');

    // Now resolve the email approval
    const finalRun = await orchestrator.resumeWithApproval(
      task.id,
      emailApproval.id,
      'approved',
      testUser,
      planner
    );

    // Swarm should now complete!
    expect(finalRun.status).toBe('COMPLETED');
    expect(finalRun.pendingApprovals.length).toBe(0);
    expect(finalRun.subtasks?.every((s) => s.status === 'completed')).toBe(true);
  });
});
