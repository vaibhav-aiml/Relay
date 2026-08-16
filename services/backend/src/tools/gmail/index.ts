import { google } from 'googleapis';
import {
  gmailSearchMessagesSchema,
  gmailReadMessageSchema,
  gmailDraftMessageSchema,
  gmailSendMessageSchema,
  GmailSearchMessagesInput,
  GmailReadMessageInput,
  GmailDraftMessageInput,
  GmailSendMessageInput,
} from '@relay/tool-schemas';
import { ToolDefinition, ExecutionContext } from '../types.js';
import { GoogleOAuthService } from '../../integrations/googleOAuth.js';

// In-memory messages store for mock testing
const mockGmailMessages = new Map<string, any>([
  [
    'msg-1',
    {
      id: 'msg-1',
      threadId: 'th-1',
      from: 'rahul@example.com',
      to: 'chandra@example.com',
      subject: 'Catchup next week',
      snippet: 'Hey Chandra, let me know when you are free on Tuesday afternoon for a sync.',
      body: 'Hey Chandra, let me know when you are free on Tuesday afternoon for a sync. Best, Rahul',
      date: '2026-08-16T10:00:00Z',
    },
  ],
]);

const mockSentMessages = new Set<string>();

export const gmailSearchMessagesTool: ToolDefinition<GmailSearchMessagesInput> = {
  name: 'gmail.searchMessages',
  description: 'Search for emails in Gmail matching a query.',
  inputSchema: gmailSearchMessagesSchema,
  riskLevel: 'MEDIUM',
  requiredPermission: 'gmail.searchMessages',
  timeoutMs: 10_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
  execute: async (input: GmailSearchMessagesInput, ctx: ExecutionContext) => {
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (connection && process.env.GOOGLE_CLIENT_ID) {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth });

      const res = await gmail.users.messages.list({
        userId: 'me',
        q: input.query,
        maxResults: input.maxResults,
      });

      const messages = await Promise.all(
        (res.data.messages || []).map(async (m) => {
          if (!m.id) return null;
          const detail = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata' });
          const headers = detail.data.payload?.headers || [];
          const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '(No subject)';
          const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
          return {
            id: m.id,
            threadId: m.threadId,
            snippet: detail.data.snippet,
            subject,
            from,
          };
        })
      );

      return {
        messages: messages.filter(Boolean),
      };
    }

    // Mock search
    const results = Array.from(mockGmailMessages.values()).filter((m) =>
      m.subject.toLowerCase().includes(input.query.toLowerCase()) ||
      m.snippet.toLowerCase().includes(input.query.toLowerCase()) ||
      m.from.toLowerCase().includes(input.query.toLowerCase())
    );

    return {
      messages: results.slice(0, input.maxResults),
    };
  },
  verify: async (output) => {
    return Array.isArray(output.messages);
  },
};

export const gmailReadMessageTool: ToolDefinition<GmailReadMessageInput> = {
  name: 'gmail.readMessage',
  description: 'Read the full body and metadata of a specific Gmail message.',
  inputSchema: gmailReadMessageSchema,
  riskLevel: 'MEDIUM',
  requiredPermission: 'gmail.readMessage',
  timeoutMs: 10_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
  execute: async (input: GmailReadMessageInput, ctx: ExecutionContext) => {
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (connection && process.env.GOOGLE_CLIENT_ID) {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth });

      const res = await gmail.users.messages.get({
        userId: 'me',
        id: input.messageId,
        format: 'full',
      });

      const headers = res.data.payload?.headers || [];
      const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value;
      const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value;
      const to = headers.find((h) => h.name?.toLowerCase() === 'to')?.value;

      return {
        id: res.data.id,
        threadId: res.data.threadId,
        snippet: res.data.snippet,
        subject,
        from,
        to,
        body: res.data.snippet, // For safety / simplified parsing
      };
    }

    const msg = mockGmailMessages.get(input.messageId);
    if (!msg) {
      throw new Error(`Message ${input.messageId} not found`);
    }
    return msg;
  },
  verify: async (output) => {
    return Boolean(output && output.id);
  },
};

export const gmailDraftMessageTool: ToolDefinition<GmailDraftMessageInput> = {
  name: 'gmail.draftMessage',
  description: 'Create an email draft in Gmail without sending.',
  inputSchema: gmailDraftMessageSchema,
  riskLevel: 'MEDIUM',
  requiredPermission: 'gmail.draftMessage',
  timeoutMs: 10_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
  execute: async (input: GmailDraftMessageInput, ctx: ExecutionContext) => {
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (connection && process.env.GOOGLE_CLIENT_ID) {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth });

      const rawEmail = [
        `To: ${input.to.join(', ')}`,
        input.cc && input.cc.length > 0 ? `Cc: ${input.cc.join(', ')}` : '',
        `Subject: ${input.subject}`,
        '',
        input.body,
      ]
        .filter(Boolean)
        .join('\r\n');

      const encoded = Buffer.from(rawEmail).toString('base64url');

      const res = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encoded,
            threadId: input.threadId,
          },
        },
      });

      return {
        draftId: res.data.id,
        status: 'draft_created',
        to: input.to,
        subject: input.subject,
      };
    }

    const draftId = `draft-${Date.now()}`;
    return {
      draftId,
      status: 'draft_created',
      to: input.to,
      subject: input.subject,
    };
  },
  verify: async (output) => {
    return Boolean(output && output.draftId);
  },
};

export const gmailSendMessageTool: ToolDefinition<GmailSendMessageInput> = {
  name: 'gmail.sendMessage',
  description: 'Send an email directly via Gmail. High risk action requiring explicit user confirmation.',
  inputSchema: gmailSendMessageSchema,
  riskLevel: 'HIGH',
  requiredPermission: 'gmail.sendMessage',
  idempotencyKeyFn: (input) => input.idempotencyKey,
  timeoutMs: 15_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1500 },
  execute: async (input: GmailSendMessageInput, ctx: ExecutionContext) => {
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (connection && process.env.GOOGLE_CLIENT_ID) {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth });

      const rawEmail = [
        `To: ${input.to.join(', ')}`,
        input.cc && input.cc.length > 0 ? `Cc: ${input.cc.join(', ')}` : '',
        `Subject: ${input.subject}`,
        '',
        input.body,
      ]
        .filter(Boolean)
        .join('\r\n');

      const encoded = Buffer.from(rawEmail).toString('base64url');

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encoded,
        },
      });

      return {
        messageId: res.data.id,
        threadId: res.data.threadId,
        status: 'sent',
        to: input.to,
        subject: input.subject,
      };
    }

    const sentId = `sent-msg-${Date.now()}`;
    mockSentMessages.add(sentId);

    return {
      messageId: sentId,
      status: 'sent',
      to: input.to,
      subject: input.subject,
    };
  },
  verify: async (output, ctx) => {
    if (!output || !output.messageId) return false;
    const connection = await ctx.db.getConnection(ctx.userId, 'google');
    if (connection && process.env.GOOGLE_CLIENT_ID) {
      try {
        const auth = GoogleOAuthService.createOAuthClient();
        const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
        auth.setCredentials(tokens);
        const gmail = google.gmail({ version: 'v1', auth });
        const check = await gmail.users.messages.get({ userId: 'me', id: output.messageId });
        return check.data.id === output.messageId;
      } catch {
        return false;
      }
    }
    return mockSentMessages.has(output.messageId);
  },
};
