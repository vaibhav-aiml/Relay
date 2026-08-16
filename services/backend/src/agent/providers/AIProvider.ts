export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ToolCallDecision {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LLMPlanResponse {
  type: 'tool_call' | 'final_answer';
  toolCalls?: ToolCallDecision[];
  text?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface IAIProvider {
  readonly name: string;
  generatePlanStep(messages: ChatMessage[], tools: LLMToolSchema[]): Promise<LLMPlanResponse>;
}
