import { IAIProvider, ChatMessage, LLMPlanResponse } from './providers/AIProvider.js';
import { GroqProvider } from './providers/GroqProvider.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { ClaudeProvider } from './providers/ClaudeProvider.js';
import { MockProvider } from './providers/MockProvider.js';
import { ToolRegistry } from '../tools/registry.js';
import { User } from '@relay/shared-types';

export class Planner {
  private primaryProvider: IAIProvider;
  private fallbackProvider?: IAIProvider;

  constructor(user?: User, customProvider?: IAIProvider) {
    if (customProvider) {
      this.primaryProvider = customProvider;
      return;
    }

    const preferred = user?.settings?.defaultProvider || 'groq';

    if (preferred === 'groq' && process.env.GROQ_API_KEY) {
      this.primaryProvider = new GroqProvider();
      if (process.env.GEMINI_API_KEY) {
        this.fallbackProvider = new GeminiProvider();
      } else if (process.env.ANTHROPIC_API_KEY) {
        this.fallbackProvider = new ClaudeProvider();
      }
    } else if (preferred === 'gemini' && process.env.GEMINI_API_KEY) {
      this.primaryProvider = new GeminiProvider();
      if (process.env.GROQ_API_KEY) {
        this.fallbackProvider = new GroqProvider();
      }
    } else if (preferred === 'claude' && process.env.ANTHROPIC_API_KEY) {
      this.primaryProvider = new ClaudeProvider();
      if (process.env.GEMINI_API_KEY) {
        this.fallbackProvider = new GeminiProvider();
      } else if (process.env.GROQ_API_KEY) {
        this.fallbackProvider = new GroqProvider();
      }
    } else if (process.env.GROQ_API_KEY) {
      this.primaryProvider = new GroqProvider();
      if (process.env.GEMINI_API_KEY) {
        this.fallbackProvider = new GeminiProvider();
      } else if (process.env.ANTHROPIC_API_KEY) {
        this.fallbackProvider = new ClaudeProvider();
      }
    } else if (process.env.GEMINI_API_KEY) {
      this.primaryProvider = new GeminiProvider();
      if (process.env.ANTHROPIC_API_KEY) {
        this.fallbackProvider = new ClaudeProvider();
      }
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.primaryProvider = new ClaudeProvider();
    } else {
      // Fallback for Phase 0/1 testing or when no keys configured
      this.primaryProvider = new MockProvider();
    }
  }

  public getActiveProviderName(): string {
    return this.primaryProvider.name;
  }

  public async getNextStep(messages: ChatMessage[]): Promise<LLMPlanResponse> {
    const registry = ToolRegistry.getInstance();
    const tools = registry.getToolSchemasForLLM();

    try {
      return await this.primaryProvider.generatePlanStep(messages, tools);
    } catch (primaryErr: any) {
      if (this.fallbackProvider) {
        console.warn(`[Planner] Primary provider (${this.primaryProvider.name}) failed, attempting fallback (${this.fallbackProvider.name}):`, primaryErr.message);
        return await this.fallbackProvider.generatePlanStep(messages, tools);
      }
      throw primaryErr;
    }
  }
}
