import { z } from 'zod';

export const gmailSearchMessagesSchema = z.object({
  query: z.string().min(1).describe('Gmail search query, e.g. "from:rahul" or "subject:meeting"'),
  maxResults: z.number().int().min(1).max(20).default(5).describe('Maximum number of messages to return (1-20)'),
});
export type GmailSearchMessagesInput = z.infer<typeof gmailSearchMessagesSchema>;

export const gmailReadMessageSchema = z.object({
  messageId: z.string().min(1).describe('The ID of the Gmail message to read'),
});
export type GmailReadMessageInput = z.infer<typeof gmailReadMessageSchema>;

export const gmailDraftMessageSchema = z.object({
  to: z.array(z.string().email()).min(1).describe('List of recipient email addresses'),
  cc: z.array(z.string().email()).optional().default([]).describe('Optional CC recipients'),
  subject: z.string().min(1).describe('Email subject line'),
  body: z.string().min(1).describe('Email body text (plain text or markdown)'),
  threadId: z.string().optional().describe('Optional Gmail thread ID to reply within'),
});
export type GmailDraftMessageInput = z.infer<typeof gmailDraftMessageSchema>;

export const gmailSendMessageSchema = z.object({
  to: z.array(z.string().email()).min(1).describe('List of recipient email addresses'),
  cc: z.array(z.string().email()).optional().default([]).describe('Optional CC recipients'),
  subject: z.string().min(1).describe('Email subject line'),
  body: z.string().min(1).describe('Email body text'),
  draftId: z.string().optional().describe('Optional draft ID if sending an existing prepared draft'),
  idempotencyKey: z.string().min(8).describe('Unique client/task key to prevent duplicate sends'),
});
export type GmailSendMessageInput = z.infer<typeof gmailSendMessageSchema>;
