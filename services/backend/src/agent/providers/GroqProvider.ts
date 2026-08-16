import Groq from 'groq-sdk';
import { IAIProvider, ChatMessage, LLMToolSchema, LLMPlanResponse } from './AIProvider.js';

export class GroqProvider implements IAIProvider {
  public readonly name = 'groq';
  private client: Groq;
  private model: string;

  constructor(apiKey?: string, model: string = 'llama-3.3-70b-versatile') {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error('GROQ_API_KEY is not configured in environment variables');
    }
    this.client = new Groq({ apiKey: key });
    this.model = model;
  }

  public async generatePlanStep(messages: ChatMessage[], tools: LLMToolSchema[]): Promise<LLMPlanResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map((m) => {
          if (m.role === 'tool') {
            return {
              role: 'tool',
              content: m.content,
              tool_call_id: m.tool_call_id || '',
            };
          }
          if (m.role === 'assistant' && m.tool_calls) {
            return {
              role: 'assistant',
              content: m.content || '',
              tool_calls: m.tool_calls,
            };
          }
          return {
            role: m.role,
            content: m.content,
          };
        }) as any,
        tools: tools.length > 0 ? (tools as any) : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        temperature: 0.1, // Deterministic planning
      });

      const choice = response.choices[0];
      const message = choice.message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCalls = message.tool_calls.map((tc) => {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            parsedArgs = {};
          }
          return {
            id: tc.id,
            name: tc.function.name,
            args: parsedArgs,
          };
        });

        return {
          type: 'tool_call',
          toolCalls,
          text: message.content || undefined,
          usage: response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
              }
            : undefined,
        };
      }

      return {
        type: 'final_answer',
        text: message.content || '',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      throw new Error(`GroqProvider execution failed: ${error.message}`);
    }
  }
}
