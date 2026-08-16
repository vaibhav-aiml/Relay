import { memorySaveSchema, memoryGetSchema, MemorySaveInput, MemoryGetInput } from '@relay/tool-schemas';
import { ToolDefinition, ExecutionContext } from '../types.js';

export const memorySaveTool: ToolDefinition<MemorySaveInput> = {
  name: 'memory.save',
  description: 'Save an important user preference, scheduling rule, or contact fact for future reference.',
  inputSchema: memorySaveSchema,
  riskLevel: 'LOW',
  requiredPermission: 'memory.save',
  timeoutMs: 5_000,
  retryPolicy: { maxRetries: 1, backoffMs: 500 },
  execute: async (input: MemorySaveInput, ctx: ExecutionContext) => {
    const memory = await ctx.db.saveMemory({
      userId: ctx.userId,
      category: input.category,
      key: input.key,
      value: input.value,
      source: input.source,
      userApproved: true,
    });
    return {
      memoryId: memory.id,
      key: memory.key,
      saved: true,
    };
  },
  verify: async (output) => Boolean(output && output.saved),
};

export const memoryGetTool: ToolDefinition<MemoryGetInput> = {
  name: 'memory.get',
  description: 'Retrieve user preferences or stored facts.',
  inputSchema: memoryGetSchema,
  riskLevel: 'LOW',
  requiredPermission: 'memory.get',
  timeoutMs: 5_000,
  retryPolicy: { maxRetries: 1, backoffMs: 500 },
  execute: async (input: MemoryGetInput, ctx: ExecutionContext) => {
    const memories = await ctx.db.getMemories(ctx.userId, input.category);
    return {
      memories: memories.map((m) => ({ category: m.category, key: m.key, value: m.value })),
    };
  },
  verify: async (output) => Array.isArray(output.memories),
};
