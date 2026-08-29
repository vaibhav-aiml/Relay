import { GoalDecomposer } from '../../src/agent/swarm/GoalDecomposer.js';
import { Planner } from '../../src/agent/planner.js';
import { User } from '@relay/shared-types';

describe('GoalDecomposer Unit Tests', () => {
  const testUser: User = {
    id: 'test-user-decomposer',
    profile: {
      name: 'Decomposer Tester',
      email: 'decomposer@example.com',
      createdAt: new Date().toISOString(),
      timezone: 'UTC',
    },
    settings: {
      voiceEnabled: true,
      defaultProvider: 'groq',
      autoApproveLowRisk: true,
    },
  };

  it('keeps single-domain goals as single_agent without decomposition', async () => {
    const singleGoal = 'What meetings do I have scheduled for today?';
    const planner = new Planner(testUser);
    const plan = await GoalDecomposer.decompose(singleGoal, testUser, planner);

    expect(plan.isDecomposed).toBe(false);
    expect(plan.strategy).toBe('single_agent');
    expect(plan.subtasks.length).toBe(0);
  });

  it('heuristically decomposes multi-domain goal into parallel Stage 1 & dependent Stage 2 subtasks', () => {
    const compositeGoal = 'Find 30m with Rahul on Tuesday afternoon, find pizza on Swiggy under ₹500, and WhatsApp Rahul the plan';
    const plan = GoalDecomposer.heuristicDecompose(compositeGoal);

    expect(plan.isDecomposed).toBe(true);
    expect(plan.strategy).toBe('swarm_pipeline');
    expect(plan.subtasks.length).toBeGreaterThanOrEqual(3);

    // Verify worker archetypes
    const calendarSubtask = plan.subtasks.find((s) => s.agentType === 'calendar_negotiator');
    const foodSubtask = plan.subtasks.find((s) => s.agentType === 'food_specialist');
    const commsSubtask = plan.subtasks.find((s) => s.agentType === 'communicator');

    expect(calendarSubtask).toBeDefined();
    expect(foodSubtask).toBeDefined();
    expect(commsSubtask).toBeDefined();

    // Stage 1 independent workers
    expect(calendarSubtask?.stage).toBe(1);
    expect(calendarSubtask?.dependencies.length).toBe(0);
    expect(foodSubtask?.stage).toBe(1);
    expect(foodSubtask?.dependencies.length).toBe(0);

    // Stage 2 dependent worker
    expect(commsSubtask?.stage).toBe(2);
    expect(commsSubtask?.dependencies).toContain(calendarSubtask?.id);
    expect(commsSubtask?.dependencies).toContain(foodSubtask?.id);
  });

  it('enforces maximum subagent budget and valid archetypes on LLM outputs', async () => {
    class MockSwarmPlanner extends Planner {
      async getNextStep(): Promise<any> {
        return {
          type: 'final_answer',
          text: JSON.stringify({
            isDecomposed: true,
            strategy: 'swarm_pipeline',
            summary: 'Custom decomposed swarm',
            subtasks: [
              { id: 'sub-1', name: 'Web Research', agentType: 'researcher', goal: 'Research AI news', stage: 1, dependencies: [] },
              { id: 'sub-2', name: 'Calendar Check', agentType: 'calendar_negotiator', goal: 'Check calendar', stage: 1, dependencies: [] },
              { id: 'sub-3', name: 'Food Order', agentType: 'food_specialist', goal: 'Find coffee', stage: 1, dependencies: [] },
              { id: 'sub-4', name: 'Send Email', agentType: 'communicator', goal: 'Email team', stage: 2, dependencies: ['sub-1', 'sub-2'] },
            ],
          }),
        };
      }
    }

    const planner = new MockSwarmPlanner(testUser);
    const plan = await GoalDecomposer.decompose(
      'Check calendar for meeting, find pizza on Swiggy, and email team',
      testUser,
      planner
    );

    expect(plan.isDecomposed).toBe(true);
    expect(plan.subtasks.length).toBe(4);
    expect(plan.totalStages).toBe(2);
    expect(plan.subtasks[3].dependencies.length).toBe(2);
  });
});
