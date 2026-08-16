import { GoogleGenerativeAI, FunctionDeclaration, SchemaType, Tool } from '@google/generative-ai';
import { IAIProvider, ChatMessage, LLMToolSchema, LLMPlanResponse } from './AIProvider.js';

export class GeminiProvider implements IAIProvider {
  public readonly name = 'gemini';
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  private candidateModels: string[];

  constructor(apiKey?: string, modelName?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(key);
    this.modelName = modelName || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    this.candidateModels = [
      this.modelName,
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
    ].filter((v, i, a) => a.indexOf(v) === i);
  }

  public async generatePlanStep(messages: ChatMessage[], tools: LLMToolSchema[]): Promise<LLMPlanResponse> {
    const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
    const chatMessages = messages.filter((m) => m.role !== 'system');

    // Convert tool schemas to Gemini FunctionDeclarations
    const functionDeclarations: FunctionDeclaration[] = tools.map((t) => ({
      name: t.function.name.replace(/\./g, '_'), // Gemini function names must be valid identifiers
      description: t.function.description,
      parameters: this.convertParametersToGeminiSchema(t.function.parameters),
    }));

    const geminiTools: Tool[] = functionDeclarations.length > 0 ? [{ functionDeclarations }] : [];

    let lastError: Error | null = null;

    for (const targetModel of this.candidateModels) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: targetModel,
          systemInstruction: systemMessage || undefined,
          tools: geminiTools.length > 0 ? geminiTools : undefined,
          generationConfig: {
            temperature: 0.1,
          },
        });

        // Format conversation contents for Gemini
        const contents = chatMessages.map((m) => {
          if (m.role === 'tool') {
            const rawName = m.name || 'tool_response';
            const textContent = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
            return {
              role: 'user',
              parts: [{ text: `[Tool Result for ${rawName}]:\n${textContent}` }],
            };
          }

          if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
            const callsSummary = m.tool_calls
              .map((tc) => `Invoked tool ${tc.function.name}(${tc.function.arguments})`)
              .join('\n');
            const fullText = m.content ? `${m.content}\n${callsSummary}` : callsSummary;
            return {
              role: 'model',
              parts: [{ text: fullText }],
            };
          }

          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content || '' }],
          };
        });

        const genResult = await model.generateContent({
          contents: contents as any,
        });

        const firstCandidate = genResult.response.candidates?.[0];
        const parts = firstCandidate?.content?.parts || [];

        // Check for function calls
        const functionCalls = parts.filter((p: any) => Boolean(p.functionCall));

        if (functionCalls.length > 0) {
          const toolCalls = functionCalls.map((fc: any, idx: number) => {
            const geminiName = fc.functionCall.name;
            // Restore original dot-notation tool name (e.g. calendar_findAvailability -> calendar.findAvailability)
            const matchedTool = tools.find((t) => t.function.name.replace(/\./g, '_') === geminiName);
            const toolName = matchedTool ? matchedTool.function.name : geminiName.replace('_', '.');

            return {
              id: `gemini-call-${Date.now()}-${idx}`,
              name: toolName,
              args: (fc.functionCall.args as Record<string, unknown>) || {},
            };
          });

          const textPart = parts.find((p: any) => Boolean(p.text));

          return {
            type: 'tool_call',
            toolCalls,
            text: textPart?.text || undefined,
            usage: genResult.response.usageMetadata
              ? {
                  promptTokens: genResult.response.usageMetadata.promptTokenCount || 0,
                  completionTokens: genResult.response.usageMetadata.candidatesTokenCount || 0,
                  totalTokens: genResult.response.usageMetadata.totalTokenCount || 0,
                }
              : undefined,
          };
        }

        const text = genResult.response.text();
        return {
          type: 'final_answer',
          text: text || '',
          usage: genResult.response.usageMetadata
            ? {
                promptTokens: genResult.response.usageMetadata.promptTokenCount || 0,
                completionTokens: genResult.response.usageMetadata.candidatesTokenCount || 0,
                totalTokens: genResult.response.usageMetadata.totalTokenCount || 0,
              }
            : undefined,
        };
      } catch (error: any) {
        lastError = error;
        const isRecoverable = error.message?.includes('503') || error.message?.includes('404') || error.message?.includes('high demand');
        if (!isRecoverable && this.candidateModels.indexOf(targetModel) === this.candidateModels.length - 1) {
          throw new Error(`GeminiProvider execution failed: ${error.message}`);
        }
      }
    }

    throw new Error(`GeminiProvider execution failed after trying models [${this.candidateModels.join(', ')}]: ${lastError?.message || 'Unknown error'}`);
  }

  private convertParametersToGeminiSchema(params: Record<string, unknown>): any {
    const properties: Record<string, any> = {};
    const rawProps = (params.properties as Record<string, any>) || {};

    for (const [key, propDef] of Object.entries(rawProps)) {
      properties[key] = this.convertPropToGemini(propDef);
    }

    return {
      type: SchemaType.OBJECT,
      properties,
      required: (params.required as string[]) || [],
    };
  }

  private convertPropToGemini(propDef: any): any {
    if (!propDef) return { type: SchemaType.STRING };

    if (propDef.type === 'number' || propDef.type === 'integer') {
      return { type: SchemaType.NUMBER, description: propDef.description || '' };
    }
    if (propDef.type === 'boolean') {
      return { type: SchemaType.BOOLEAN, description: propDef.description || '' };
    }
    if (propDef.type === 'array') {
      const items = propDef.items ? this.convertPropToGemini(propDef.items) : { type: SchemaType.STRING };
      return {
        type: SchemaType.ARRAY,
        description: propDef.description || '',
        items,
      };
    }
    if (propDef.type === 'object') {
      const nested = propDef.properties ? this.convertParametersToGeminiSchema(propDef) : undefined;
      return {
        type: SchemaType.OBJECT,
        description: propDef.description || '',
        properties: nested?.properties,
        required: nested?.required,
      };
    }

    return {
      type: SchemaType.STRING,
      description: propDef.description || '',
    };
  }
}
