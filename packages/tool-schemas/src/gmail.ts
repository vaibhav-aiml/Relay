import { z } from 'zod';

const sanitizeEmailList = (val: unknown): string[] => {
  if (!val) return [];
  if (typeof val === 'string') {
    return val
      .split(/[,;]/)
      .map((s) => s.trim().replace(/^<|>$/g, ''))
      .filter(Boolean);
  }
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === 'string') return item.trim().replace(/^<|>$/g, '');
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, any>;
          return (obj.email || obj.address || obj.value || '').trim().replace(/^<|>$/g, '');
        }
        return String(item).trim().replace(/^<|>$/g, '');
      })
      .filter(Boolean);
  }
  return [String(val).trim().replace(/^<|>$/g, '')];
};

export const gmailSearchMessagesSchema = z.object({
  query: z.string().min(1).describe('Gmail search query, e.g. "from:rahul" or "subject:meeting"'),
  maxResults: z.coerce.number().int().min(1).max(20).default(5).describe('Maximum number of messages to return (1-20)'),
});
export type GmailSearchMessagesInput = z.infer<typeof gmailSearchMessagesSchema>;

export const gmailReadMessageSchema = z.object({
  messageId: z.string().min(1).describe('The ID of the Gmail message to read'),
});
export type GmailReadMessageInput = z.infer<typeof gmailReadMessageSchema>;

export const gmailDraftMessageSchema = z.object({
  to: z.preprocess(sanitizeEmailList, z.array(z.string().email()).min(1)).describe('List of recipient email addresses'),
  cc: z.preprocess(sanitizeEmailList, z.array(z.string().email())).optional().default([]).describe('Optional CC recipients'),
  subject: z.string().min(1).describe('Email subject line'),
  body: z.string().min(1).describe('Email body text (plain text or markdown)'),
  threadId: z.string().optional().describe('Optional Gmail thread ID to reply within'),
});
export type GmailDraftMessageInput = z.infer<typeof gmailDraftMessageSchema>;

export const gmailSendMessageSchema = z.object({
  to: z.preprocess(sanitizeEmailList, z.array(z.string().email()).min(1)).describe('List of recipient email addresses'),
  cc: z.preprocess(sanitizeEmailList, z.array(z.string().email())).optional().default([]).describe('Optional CC recipients'),
  subject: z.string().min(1).describe('Email subject line'),
  body: z.string().min(1).describe('Email body text'),
  draftId: z.string().optional().describe('Optional draft ID if sending an existing prepared draft'),
  idempotencyKey: z.string().optional().describe('Unique client/task key to prevent duplicate sends'),
});
export type GmailSendMessageInput = z.infer<typeof gmailSendMessageSchema>;
