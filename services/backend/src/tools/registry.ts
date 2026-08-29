import { ToolDefinition, ExecutionContext } from './types.js';
import { validateToolArgs } from '../security/validateArgs.js';
import { PromptInjectionGuard } from '../security/injectionGuard.js';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolDefinition> = new Map();

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  public get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Formats registered tools for OpenAI / Groq / Claude function calling.
   */
  public getToolSchemasForLLM(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.list().map((tool) => {
      // Extract JSON Schema from Zod schema (compatible format)
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: `[Risk: ${tool.riskLevel}] ${tool.description}`,
          parameters: zodToJsonSchemaShim(tool.inputSchema),
        },
      };
    });
  }

  /**
   * Formats a scoped subset of registered tools for specialized worker agents.
   */
  public getScopedSchemas(allowedToolNames: string[]): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    const allowedSet = new Set(allowedToolNames);
    return this.list()
      .filter((tool) => allowedSet.has(tool.name))
      .map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: `[Risk: ${tool.riskLevel}] ${tool.description}`,
          parameters: zodToJsonSchemaShim(tool.inputSchema),
        },
      }));
  }

  /**
   * Executes a tool with Zod schema validation, timeout, retry policy, and post-verification.
   */
  public async executeWithGuards<TInput = any, TOutput = any>(
    toolName: string,
    rawArgs: TInput,
    ctx: ExecutionContext
  ): Promise<{ success: boolean; output?: TOutput; verified: boolean; error?: string }> {
    const tool = this.get(toolName);
    if (!tool) {
      return {
        success: false,
        verified: false,
        error: `Tool '${toolName}' not found in registry.`,
      };
    }

    // Step 1: Strict Zod validation
    const validation = validateToolArgs(tool.inputSchema, rawArgs);
    if (!validation.success) {
      return {
        success: false,
        verified: false,
        error: validation.error,
      };
    }

    const validatedInput = validation.data as TInput;
    let lastError: Error | null = null;
    let attempts = 0;
    const maxRetries = tool.retryPolicy.maxRetries;
    const backoffMs = tool.retryPolicy.backoffMs;

    // Step 2: Retry loop with backoff
    while (attempts <= maxRetries) {
      attempts++;
      try {
        // Execute with timeout
        const output = await this.executeWithTimeout(
          () => tool.execute(validatedInput, ctx),
          tool.timeoutMs
        );

        // Step 3: Tool verification
        let verified = false;
        try {
          verified = await tool.verify(output, ctx);
        } catch (verifErr) {
          ctx.logger?.warn?.(`Verification failed for ${toolName}:`, verifErr);
          verified = false;
        }

        return {
          success: true,
          output,
          verified,
        };
      } catch (err: any) {
        lastError = err;
        ctx.logger?.warn?.(`Attempt ${attempts} failed for tool ${toolName}: ${err.message}`);
        if (attempts <= maxRetries) {
          await new Promise((res) => setTimeout(res, backoffMs * attempts));
        }
      }
    }

    return {
      success: false,
      verified: false,
      error: `Tool execution failed after ${attempts} attempts: ${lastError?.message || 'Unknown error'}`,
    };
  }

  private executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}

/**
 * Lightweight Zod-to-JSON-Schema converter for LLM function parameter definitions.
 */
function zodToJsonSchemaShim(schema: any): Record<string, unknown> {
  const shape = schema?._def?.shape?.() || schema?._def?.shape || {};
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const fieldDef = (value as any)._def;
    const typeName = fieldDef?.typeName;
    const description = fieldDef?.description || (value as any).description;

    let typeStr = 'string';
    if (typeName === 'ZodNumber') typeStr = 'number';
    else if (typeName === 'ZodBoolean') typeStr = 'boolean';
    else if (typeName === 'ZodArray') typeStr = 'array';
    else if (typeName === 'ZodObject') typeStr = 'object';
    else if (typeName === 'ZodEnum') typeStr = 'string';

    const isOptional = typeName === 'ZodOptional' || fieldDef?.innerType?._def?.typeName === 'ZodOptional';

    properties[key] = {
      type: typeStr,
      ...(description ? { description } : {}),
    };

    if (!isOptional && typeName !== 'ZodDefault') {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}
