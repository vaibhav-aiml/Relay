import { v4 as uuidv4 } from 'uuid';
import { User, SubAgentTask, CoordinatorPlan, WorkerAgentType } from '@relay/shared-types';
import { AGENT_CONFIG } from '@relay/config';
import { Planner } from '../planner.js';
import { ChatMessage } from '../providers/AIProvider.js';

export interface DecomposedOutput {
  isDecomposed: boolean;
  strategy: 'single_agent' | 'swarm_pipeline';
  summary: string;
  subtasks: Array<{
    id?: string;
    name: string;
    agentType: WorkerAgentType;
    goal: string;
    stage: number;
    dependencies?: string[];
  }>;
}

export class GoalDecomposer {
  /**
   * Decomposes a user goal into a topological swarm plan or single-agent strategy.
   */
  public static async decompose(
    goal: string,
    user: User,
    planner: Planner
  ): Promise<CoordinatorPlan> {
    const trimmedGoal = goal.trim();

    // Fast check: single-clause or single-domain goals don't need LLM decomposition overhead
    if (this.isObviouslySingleGoal(trimmedGoal)) {
      return {
        isDecomposed: false,
        strategy: 'single_agent',
        summary: trimmedGoal,
        totalStages: 1,
        subtasks: [],
      };
    }

    const systemPrompt = `You are the Relay Goal Decomposer and Swarm Coordinator.
Analyze the user's high-level goal and determine if it is a SIMPLE single-domain task or a COMPOSITE multi-domain mission requiring specialized parallel sub-agents.

Available Worker Archetypes:
- "researcher": Web search, reading pages, Gmail searching/reading, information gathering.
- "calendar_negotiator": Finding free availability, listing/creating/updating calendar meetings.
- "food_specialist": Restaurant discovery (Zomato/Swiggy/Blinkit/Zepto), price comparisons, cart order preparation.
- "communicator": WhatsApp, SMS, composing/sending emails, contacts search, phone calls.
- "general_worker": Any other bespoke task.

Decomposition Rules:
1. If the goal can be cleanly handled by a single agent with 1-2 standard actions (e.g. "What's on my calendar?", "Order cold coffee from Zomato", "Search the web for news"), set "isDecomposed": false.
2. If the goal combines multiple distinct domains (e.g. "Check free time with Rahul, find Italian restaurants, draft an invite, and WhatsApp him the plan"), set "isDecomposed": true.
3. Max subtasks: ${AGENT_CONFIG.MAX_SUBAGENTS_PER_TASK}. Max stages: ${AGENT_CONFIG.MAX_SWARM_STAGES}.
4. Stage 1 subtasks MUST have no dependencies (dependencies: []). Stage 2+ subtasks can depend on Stage 1 subtask IDs.
5. Independent subtasks should be placed in Stage 1 to execute in PARALLEL. Downstream subtasks (like sending the final message with the results) should be in Stage 2.

Respond STRICTLY with valid JSON matching this schema:
{
  "isDecomposed": boolean,
  "strategy": "single_agent" | "swarm_pipeline",
  "summary": "Brief explanation of the strategy",
  "subtasks": [
    {
      "id": "subtask-1",
      "name": "Friendly Subtask Name",
      "agentType": "researcher" | "calendar_negotiator" | "food_specialist" | "communicator" | "general_worker",
      "goal": "Specific objective for this worker agent",
      "stage": 1,
      "dependencies": []
    }
  ]
}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Goal: "${trimmedGoal}"` },
    ];

    try {
      const response = await planner.getNextStep(messages);
      const text = response.text || '';
      const parsed = this.extractJson<DecomposedOutput>(text);

      if (parsed && parsed.isDecomposed && Array.isArray(parsed.subtasks) && parsed.subtasks.length > 1) {
        return this.normalizeAndValidatePlan(parsed, trimmedGoal);
      }
    } catch (err: any) {
      console.warn(`[GoalDecomposer] LLM decomposition failed or returned non-JSON (${err.message}), falling back to heuristic:`, err);
    }

    // Heuristic fallback for composite goals
    return this.heuristicDecompose(trimmedGoal);
  }

  private static isObviouslySingleGoal(goal: string): boolean {
    const lower = goal.toLowerCase();
    const hasMultipleConjunctions = (lower.match(/\band\b/g) || []).length >= 2 || lower.includes('then') || lower.includes('also');
    if (hasMultipleConjunctions) return false;

    // Check if it clearly hits multiple domains
    const domains = [
      lower.includes('meet') || lower.includes('calendar') || lower.includes('schedule'),
      lower.includes('order') || lower.includes('food') || lower.includes('coffee') || lower.includes('pizza') || lower.includes('zomato') || lower.includes('swiggy'),
      lower.includes('whatsapp') || lower.includes('sms') || lower.includes('email') || lower.includes('call') || lower.includes('message'),
      lower.includes('research') || lower.includes('search the web') || lower.includes('news'),
    ].filter(Boolean).length;

    return domains <= 1;
  }

  private static normalizeAndValidatePlan(parsed: DecomposedOutput, originalGoal: string): CoordinatorPlan {
    const rawSubtasks = parsed.subtasks.slice(0, AGENT_CONFIG.MAX_SUBAGENTS_PER_TASK);
    const idMap = new Map<string, string>(); // oldId -> new uuid

    // Generate valid UUIDs
    rawSubtasks.forEach((st, idx) => {
      const originalId = st.id || `subtask-${idx + 1}`;
      idMap.set(originalId, uuidv4());
    });

    const normalizedSubtasks: SubAgentTask[] = rawSubtasks.map((st, idx) => {
      const originalId = st.id || `subtask-${idx + 1}`;
      const newId = idMap.get(originalId) || uuidv4();
      const stage = Math.min(Math.max(Number(st.stage) || 1, 1), AGENT_CONFIG.MAX_SWARM_STAGES);
      const validDeps = (st.dependencies || [])
        .map((d) => idMap.get(d) || d)
        .filter((d) => idMap.has(d) || Array.from(idMap.values()).includes(d));

      const validArchetypes: WorkerAgentType[] = [
        'researcher',
        'calendar_negotiator',
        'food_specialist',
        'communicator',
        'general_worker',
      ];
      const agentType = validArchetypes.includes(st.agentType) ? st.agentType : 'general_worker';

      return {
        id: newId,
        parentTaskId: '', // will be filled by caller
        agentType,
        name: st.name || `${agentType} task`,
        goal: st.goal || originalGoal,
        stage,
        dependencies: stage === 1 ? [] : validDeps,
        status: 'pending',
        plan: [],
      };
    });

    const maxStage = Math.max(...normalizedSubtasks.map((s) => s.stage), 1);

    return {
      isDecomposed: true,
      strategy: 'swarm_pipeline',
      summary: parsed.summary || `Decomposed into ${normalizedSubtasks.length} specialized sub-agents across ${maxStage} stages.`,
      totalStages: maxStage,
      subtasks: normalizedSubtasks,
    };
  }

  public static heuristicDecompose(goal: string): CoordinatorPlan {
    const lower = goal.toLowerCase();
    const subtasks: SubAgentTask[] = [];

    // 1. Calendar intent
    if (
      lower.includes('meeting') ||
      lower.includes('calendar') ||
      lower.includes('schedule') ||
      lower.includes('availability') ||
      lower.includes('slot') ||
      /\b\d+\s*(m|min|mins|minute|minutes|hour|hours)\b/.test(lower) ||
      lower.includes('tuesday') ||
      lower.includes('monday') ||
      lower.includes('wednesday') ||
      lower.includes('thursday') ||
      lower.includes('friday')
    ) {
      subtasks.push({
        id: uuidv4(),
        parentTaskId: '',
        agentType: 'calendar_negotiator',
        name: 'Calendar & Schedule Discovery',
        goal: `Inspect schedule and availability for: ${goal}`,
        stage: 1,
        dependencies: [],
        status: 'pending',
        plan: [],
      });
    }

    // 2. Food intent
    if (lower.includes('order') || lower.includes('food') || lower.includes('coffee') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('pizza')) {
      subtasks.push({
        id: uuidv4(),
        parentTaskId: '',
        agentType: 'food_specialist',
        name: 'Food & Dining Discovery',
        goal: `Find best food/dining options and prepare cart for: ${goal}`,
        stage: 1,
        dependencies: [],
        status: 'pending',
        plan: [],
      });
    }

    // 3. Research intent
    if (lower.includes('research') || lower.includes('search') || lower.includes('find out') || lower.includes('latest news')) {
      subtasks.push({
        id: uuidv4(),
        parentTaskId: '',
        agentType: 'researcher',
        name: 'Information & Web Research',
        goal: `Research relevant information and summarize findings for: ${goal}`,
        stage: 1,
        dependencies: [],
        status: 'pending',
        plan: [],
      });
    }

    // 4. Communication intent (dependent on Stage 1 if others exist)
    if (lower.includes('whatsapp') || lower.includes('email') || lower.includes('sms') || lower.includes('message') || lower.includes('tell') || lower.includes('invite')) {
      const stage1Ids = subtasks.map((s) => s.id);
      subtasks.push({
        id: uuidv4(),
        parentTaskId: '',
        agentType: 'communicator',
        name: 'Dispatch & Messaging',
        goal: `Compose and send communication based on findings for: ${goal}`,
        stage: stage1Ids.length > 0 ? 2 : 1,
        dependencies: stage1Ids,
        status: 'pending',
        plan: [],
      });
    }

    if (subtasks.length > 1) {
      const maxStage = Math.max(...subtasks.map((s) => s.stage), 1);
      return {
        isDecomposed: true,
        strategy: 'swarm_pipeline',
        summary: `Heuristically decomposed goal into ${subtasks.length} worker agents.`,
        totalStages: maxStage,
        subtasks,
      };
    }

    return {
      isDecomposed: false,
      strategy: 'single_agent',
      summary: goal,
      totalStages: 1,
      subtasks: [],
    };
  }

  private static extractJson<T>(text: string): T | null {
    try {
      const trimmed = text.trim();
      // Handle markdown code blocks
      const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, trimmed];
      const jsonStr = jsonMatch[1] ? jsonMatch[1].trim() : trimmed;
      return JSON.parse(jsonStr) as T;
    } catch {
      return null;
    }
  }
}
