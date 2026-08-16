import Anthropic from '@anthropic-ai/sdk';
import { IAIProvider, ChatMessage, LLMToolSchema, LLMPlanResponse } from './AIProvider.js';

export class ClaudeProvider implements IAIProvider {
  public readonly name = 'claude';
  private client: Anthropic;
  private model: string;

  constructor(apiKey?: string, model: string = 'claude-3-5-sonnet-20241022') {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is not configured in environment variables');
    }
    this.client = new Anthropic({ apiKey: key });
    this.model = model;
  }

  public async generatePlanStep(messages: ChatMessage[], tools: LLMToolSchema[]): Promise<LLMPlanResponse> {
    try {
      const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
      const chatMessages = messages.filter((m) => m.role !== 'system');

      // Convert tools to Anthropic format
      const anthropicTools = tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: {
          type: 'object' as const,
          properties: t.function.parameters.properties as Record<string, unknown>,
          required: (t.function.parameters.required as string[]) || [],
        },
      }));

      // Convert messages to Anthropic format
      const formattedMessages: Anthropic.MessageParam[] = chatMessages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: m.tool_call_id || '',
                content: m.content,
              },
            ],
          };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          const contentBlocks: any[] = [];
          if (m.content) {
            contentBlocks.push({ type: 'text', text: m.content });
          }
          m.tool_calls.forEach((tc) => {
            let parsed = {};
            try {
              parsed = JSON.parse(tc.function.arguments || '{}');
            } catch {
              parsed = {};
            }
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input: parsed,
            });
          });
          return {
            role: 'assistant',
            content: contentBlocks,
          };
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      });

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        system: systemMessage,
        messages: formattedMessages,
        tools: anthropicTools.length > 0 ? (anthropicTools as any) : undefined,
        temperature: 0.1,
      });

      const toolUses = response.content.filter((c) => c.type === 'tool_use');
      const textBlock = response.content.find((c) => c.type === 'text');

      if (toolUses.length > 0) {
        return {
          type: 'tool_call',
          toolCalls: toolUses.map((tu: any) => ({
            id: tu.id,
            name: tu.name,
            args: tu.input,
          })),
          text: textBlock ? (textBlock as any).text : undefined,
          usage: {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          },
        };
      }

      return {
        type: 'final_answer',
        text: textBlock ? (textBlock as any).text : '',
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error: any) {
      throw new Error(`ClaudeProvider execution failed: ${error.message}`);
    }
  }
}
