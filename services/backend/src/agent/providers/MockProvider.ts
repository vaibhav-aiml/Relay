import { IAIProvider, ChatMessage, LLMToolSchema, LLMPlanResponse } from './AIProvider.js';

export class MockProvider implements IAIProvider {
  public readonly name = 'mock';
  private stepIndex = 0;
  private scenarioSteps?: LLMPlanResponse[];

  constructor(customScenario?: LLMPlanResponse[]) {
    this.scenarioSteps = customScenario;
  }

  public setScenario(scenario: LLMPlanResponse[]): void {
    this.scenarioSteps = scenario;
    this.stepIndex = 0;
  }

  public reset(): void {
    this.stepIndex = 0;
  }

  public async generatePlanStep(messages: ChatMessage[], _tools: LLMToolSchema[]): Promise<LLMPlanResponse> {
    if (this.scenarioSteps && this.scenarioSteps.length > 0) {
      const step = this.scenarioSteps[Math.min(this.stepIndex, this.scenarioSteps.length - 1)];
      this.stepIndex++;
      return step;
    }

    // Default dynamic mock behavior based on conversation history
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role === 'tool') {
      // If we just got a tool response, produce a final answer or next step
      return {
        type: 'final_answer',
        text: `Task successfully verified and completed based on tool output: ${lastMessage.content.slice(0, 100)}...`,
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      };
    }

    const userGoal = messages.find((m) => m.role === 'user')?.content || '';

    if (userGoal.toLowerCase().includes('rahul') || userGoal.toLowerCase().includes('meeting') || userGoal.toLowerCase().includes('schedule')) {
      return {
        type: 'tool_call',
        toolCalls: [
          {
            id: 'mock-call-1',
            name: 'calendar.findAvailability',
            args: {
              timeMin: '2026-08-18T09:00:00Z',
              timeMax: '2026-08-18T18:00:00Z',
              durationMinutes: 30,
              attendeeEmails: ['rahul@example.com'],
            },
          },
        ],
        text: 'Checking calendar availability for meeting with Rahul.',
      };
    }

    if (userGoal.toLowerCase().includes('search') || userGoal.toLowerCase().includes('web')) {
      return {
        type: 'tool_call',
        toolCalls: [
          {
            id: 'mock-call-2',
            name: 'web.search',
            args: {
              query: userGoal,
              maxResults: 3,
            },
          },
        ],
        text: 'Searching the web for requested information.',
      };
    }

    return {
      type: 'final_answer',
      text: `Completed plan for goal: "${userGoal}". All systems operational.`,
      usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 },
    };
  }
}
