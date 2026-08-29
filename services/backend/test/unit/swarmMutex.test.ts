import { TaskExecutionMutex } from '../../src/agent/swarm/TaskExecutionMutex.js';
import { AgentOrchestrator } from '../../src/agent/orchestrator.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { initializeTools } from '../../src/tools/index.js';
import { Task, User, SubAgentTask } from '@relay/shared-types';
import { Planner } from '../../src/agent/planner.js';

describe('TaskExecutionMutex & Serialization Unit Tests', () => {
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
      id: 'mutex-test-user',
      profile: {
        name: 'Mutex Tester',
        email: 'mutex@example.com',
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

  it('serializes concurrent executions for the same taskId in strict FIFO order', async () => {
    const mutex = TaskExecutionMutex.getInstance();
    const taskId = 'test-concurrent-task-1';
    const executionOrder: number[] = [];

    const op1 = mutex.runExclusive(taskId, async () => {
      await new Promise((res) => setTimeout(res, 50));
      executionOrder.push(1);
      return 'op1';
    });

    const op2 = mutex.runExclusive(taskId, async () => {
      await new Promise((res) => setTimeout(res, 10));
      executionOrder.push(2);
      return 'op2';
    });

    const op3 = mutex.runExclusive(taskId, async () => {
      executionOrder.push(3);
      return 'op3';
    });

    const results = await Promise.all([op1, op2, op3]);

    expect(results).toEqual(['op1', 'op2', 'op3']);
    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it('safely handles concurrent resumeWithApproval dispatches for the same task without lost updates', async () => {
    class MockFastPlanner extends Planner {
      private fStep = 0;
      private eStep = 0;

      async getNextStep(messages: any[]): Promise<any> {
        const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
        if (sysMsg.includes('Food Specialist')) {
          this.fStep++;
          if (this.fStep === 1) {
            return {
              type: 'tool_call',
              toolCalls: [
                {
                  id: 'call-f',
                  name: 'food.prepareOrder',
                  args: { itemName: 'Pasta', restaurantName: 'Italiano', platform: 'zomato', estimatedPrice: 200 },
                },
              ],
            };
          }
          return { type: 'final_answer', text: 'Pasta ordered.' };
        }

        if (sysMsg.includes('Communicator')) {
          this.eStep++;
          if (this.eStep === 1) {
            return {
              type: 'tool_call',
              toolCalls: [
                {
                  id: 'call-e',
                  name: 'gmail.sendMessage',
                  args: { to: ['test@example.com'], subject: 'Dinner', body: 'Dinner ready' },
                },
              ],
            };
          }
          return { type: 'final_answer', text: 'Message sent.' };
        }

        return { type: 'final_answer', text: 'Mission complete.' };
      }
    }

    const subtasks: SubAgentTask[] = [
      {
        id: 'sub-f-1',
        parentTaskId: 'task-mutex-test',
        agentType: 'food_specialist',
        name: 'Order Food',
        goal: 'Order pasta',
        stage: 1,
        dependencies: [],
        status: 'pending',
        plan: [],
      },
      {
        id: 'sub-e-1',
        parentTaskId: 'task-mutex-test',
        agentType: 'communicator',
        name: 'Send Msg',
        goal: 'Send dinner notification',
        stage: 1,
        dependencies: [],
        status: 'pending',
        plan: [],
      },
    ];

    const task: Task = {
      id: 'task-mutex-test',
      userId: testUser.id,
      goal: 'Order food and notify',
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

    const planner = new MockFastPlanner(testUser);
    const initialRun = await orchestrator.runTask(task, testUser, planner);

    expect(initialRun.pendingApprovals.length).toBe(2);
    const [appr1, appr2] = initialRun.pendingApprovals;

    // Fire BOTH resumeWithApproval calls concurrently!
    const [res1, res2] = await Promise.all([
      orchestrator.resumeWithApproval(task.id, appr1.id, 'approved', testUser, planner),
      orchestrator.resumeWithApproval(task.id, appr2.id, 'approved', testUser, planner),
    ]);

    // The final state persisted in DB must have BOTH completed subtasks and COMPLETED status
    const finalDbTask = await db.getTask(testUser.id, task.id);
    expect(finalDbTask).toBeDefined();
    expect(finalDbTask?.status).toBe('COMPLETED');
    expect(finalDbTask?.pendingApprovals.length).toBe(0);
    expect(finalDbTask?.subtasks?.every((s) => s.status === 'completed')).toBe(true);
  });
});
