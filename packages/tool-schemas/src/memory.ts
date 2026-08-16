import { z } from 'zod';

export const memorySaveSchema = z.object({
  category: z.enum(['preference', 'contact_info', 'schedule_rule', 'general']).default('preference'),
  key: z.string().min(1).describe('The key or identifier for this memory item, e.g. "meeting_preference"'),
  value: z.string().min(1).describe('The preference or rule to remember, e.g. "Always schedule meetings in the morning"'),
  source: z.enum(['user_stated', 'inferred']).default('user_stated'),
});
export type MemorySaveInput = z.infer<typeof memorySaveSchema>;

export const memoryGetSchema = z.object({
  category: z.enum(['preference', 'contact_info', 'schedule_rule', 'general']).optional(),
  query: z.string().optional().describe('Optional query string to search for relevant memories'),
});
export type MemoryGetInput = z.infer<typeof memoryGetSchema>;
