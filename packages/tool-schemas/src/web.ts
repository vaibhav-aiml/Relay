import { z } from 'zod';

export const webSearchSchema = z.object({
  query: z.string().min(1).describe('The search query for web search'),
  maxResults: z.coerce.number().int().min(1).max(10).default(5).describe('Number of web search results to return'),
});
export type WebSearchInput = z.infer<typeof webSearchSchema>;

export const webOpenSchema = z.object({
  url: z.string().url().describe('The absolute HTTP/HTTPS URL to fetch and summarize'),
});
export type WebOpenInput = z.infer<typeof webOpenSchema>;
