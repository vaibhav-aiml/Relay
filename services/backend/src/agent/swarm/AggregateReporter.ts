import { Task, SubAgentTask, User } from '@relay/shared-types';
import { Planner } from '../planner.js';
import { ChatMessage } from '../providers/AIProvider.js';
import { ARCHETYPES } from './archetypes.js';

export class AggregateReporter {
  /**
   * Synthesizes all sub-agent deliverables and tool results into a cohesive final briefing.
   */
  public static async generateReport(
    task: Task,
    subtasks: SubAgentTask[],
    user: User,
    planner: Planner
  ): Promise<string> {
    const subtaskSummaries = subtasks.map((st, idx) => {
      const arch = ARCHETYPES[st.agentType] || ARCHETYPES.general_worker;
      const statusIcon = st.status === 'completed' ? '✅' : st.status === 'waiting_approval' ? '⏳' : '❌';
      const stepsExecuted = (st.plan || []).map((p) => `- ${p.description} (${p.status})`).join('\n');
      const output = typeof st.result === 'object' ? JSON.stringify(st.result) : (st.result || st.error || 'No output');
      return `### ${statusIcon} [${arch.displayName}] ${st.name}
**Goal**: ${st.goal}
**Status**: ${st.status}
**Execution Steps**:
${stepsExecuted || '- None'}
**Result / Deliverable**:
${output}`;
    }).join('\n\n');

    const systemPrompt = `You are Relay, the executive AI agent coordinator.
Your multi-agent worker swarm has executed a complex composite goal on behalf of ${user.profile.name}.
Your job is to synthesize all worker findings, actions taken, and deliverables into a polished, crisp, natural English executive summary for the user.

Guidelines:
- Address the user directly in a helpful, conversational tone.
- Clearly summarize key verified outcomes from each worker (meetings scheduled, food carts prepared, messages dispatched, research findings).
- If any action requires approval or manual app checkout (e.g. food delivery app), highlight that clearly.
- Avoid redundant technical jargon; keep it natural and actionable.`;

    const userMessage = `User Goal: "${task.goal}"

Worker Swarm Deliverables:
${subtaskSummaries}

Please provide the final unified executive response for the user.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await planner.getNextStep(messages);
      if (response.text && response.text.trim()) {
        return response.text.trim();
      }
    } catch (err: any) {
      console.warn(`[AggregateReporter] LLM synthesis failed (${err.message}), formulating fallback summary:`, err);
    }

    // Heuristic fallback report
    const bullets = subtasks.map((st) => {
      const arch = ARCHETYPES[st.agentType] || ARCHETYPES.general_worker;
      const res = typeof st.result === 'string' ? st.result : st.error || st.status;
      return `• **${arch.displayName}**: ${res}`;
    });

    return `Here is the summary of your completed mission:\n\n${bullets.join('\n\n')}`;
  }
}
