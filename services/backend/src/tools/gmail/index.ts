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

// In-memory messages store reserved ONLY for Jest automated unit test environments
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
      try {
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
      } catch (googleErr: any) {
        const errMsg = googleErr.response?.data?.error?.message || googleErr.message || 'Unknown Gmail API error';
        throw new Error(`Gmail API failed to search messages: ${errMsg}`);
      }
    }

    // Fallback for automated unit tests only
    if (process.env.NODE_ENV === 'test') {
      const results = Array.from(mockGmailMessages.values()).filter(
        (m) =>
          m.subject.toLowerCase().includes(input.query.toLowerCase()) ||
          m.snippet.toLowerCase().includes(input.query.toLowerCase()) ||
          m.from.toLowerCase().includes(input.query.toLowerCase())
      );
      return { messages: results.slice(0, input.maxResults) };
    }

    throw new Error(
      'Google account is not connected. To search your emails, please connect your Gmail account in Settings > Connections or visit /api/connections/google/connect in your browser.'
    );
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
      try {
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
          body: res.data.snippet,
        };
      } catch (googleErr: any) {
        const errMsg = googleErr.response?.data?.error?.message || googleErr.message || 'Unknown Gmail API error';
        throw new Error(`Gmail API failed to read message ${input.messageId}: ${errMsg}`);
      }
    }

    if (process.env.NODE_ENV === 'test') {
      const msg = mockGmailMessages.get(input.messageId);
      if (!msg) {
        throw new Error(`Message ${input.messageId} not found`);
      }
      return msg;
    }

    throw new Error(
      'Google account is not connected. To read emails, please connect your Gmail account in Settings > Connections or visit /api/connections/google/connect in your browser.'
    );
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

    if (!connection || connection.status !== 'active' || !connection.encryptedCredentialRef) {
      if (process.env.NODE_ENV === 'test') {
        return {
          draftId: 'test-mock-draft-id',
          status: 'draft_created',
          simulated: true,
          to: input.to,
          subject: input.subject,
        };
      }
      throw new Error(
        'Google account is not connected. To create Gmail drafts, please connect your Gmail account in Settings > Connections or visit /api/connections/google/connect in your browser.'
      );
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID is not configured in backend environment (.env).');
    }

    try {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth });

      const headerLines = [
        `To: ${input.to.join(', ')}`,
        input.cc && input.cc.length > 0 ? `Cc: ${input.cc.join(', ')}` : '',
        `Subject: ${input.subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
      ]
        .filter(Boolean)
        .join('\r\n');

      const rawEmail = `${headerLines}\r\n\r\n${input.body}`;
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

      const draftId = res.data.id;
      if (!draftId) {
        throw new Error('Gmail API responded without a valid draft ID.');
      }

      return {
        draftId,
        status: 'draft_created',
        simulated: false,
        to: input.to,
        subject: input.subject,
      };
    } catch (googleErr: any) {
      const errMsg = googleErr.response?.data?.error?.message || googleErr.message || 'Unknown Gmail API error';
      throw new Error(`Gmail API failed to create draft: ${errMsg}`);
    }
  },
  verify: async (output, ctx) => {
    if (!output || !output.draftId) return false;
    if (output.simulated === true) {
      return process.env.NODE_ENV === 'test';
    }
    const connection = await ctx.db.getConnection(ctx.userId, 'google');
    if (!connection) return false;
    try {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth });
      const check = await gmail.users.drafts.get({ userId: 'me', id: output.draftId });
      return check.data.id === output.draftId;
    } catch {
      return false;
    }
  },
};

export const gmailSendMessageTool: ToolDefinition<GmailSendMessageInput> = {
  name: 'gmail.sendMessage',
  description: 'Send an email directly via Gmail. High risk action requiring explicit user confirmation.',
  inputSchema: gmailSendMessageSchema,
  riskLevel: 'HIGH',
  requiredPermission: 'gmail.sendMessage',
  idempotencyKeyFn: (input) => input.idempotencyKey || `gmail-send-${input.to?.[0] || 'unknown'}-${Date.now()}`,
  timeoutMs: 15_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1500 },
  execute: async (input: GmailSendMessageInput, ctx: ExecutionContext) => {
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (!connection || connection.status !== 'active' || !connection.encryptedCredentialRef) {
      if (process.env.NODE_ENV === 'test') {
        // Safe mock return strictly for automated Jest unit tests
        return {
          messageId: 'test-mock-msg-id',
          threadId: 'test-mock-thread-id',
          status: 'sent',
          simulated: true,
          to: input.to,
          subject: input.subject,
        };
      }
      throw new Error(
        'Google account is not connected. To send real emails, please connect your Gmail account in Settings > Connections or visit /api/connections/google/connect in your browser.'
      );
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID is not configured in backend environment (.env).');
    }

    try {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);

      // Auto-update connection if Google client refreshes the access token
      auth.on('tokens', async (newTokens) => {
        try {
          const updatedTokens = { ...tokens, ...newTokens };
          connection.encryptedCredentialRef = GoogleOAuthService.encryptTokens(updatedTokens);
          connection.updatedAt = new Date().toISOString();
          await ctx.db.saveConnection(connection);
        } catch (refreshErr) {
          console.warn('[Gmail] Could not save refreshed Google tokens:', refreshErr);
        }
      });

      const gmail = google.gmail({ version: 'v1', auth });

      const headerLines = [
        `To: ${input.to.join(', ')}`,
        input.cc && input.cc.length > 0 ? `Cc: ${input.cc.join(', ')}` : '',
        `Subject: ${input.subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
      ]
        .filter(Boolean)
        .join('\r\n');

      const rawEmail = `${headerLines}\r\n\r\n${input.body}`;
      const encoded = Buffer.from(rawEmail).toString('base64url');

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encoded,
        },
      });

      const messageId = res.data.id;
      if (!messageId) {
        throw new Error('Gmail API responded without a valid message ID. Email dispatch could not be confirmed.');
      }

      return {
        messageId,
        threadId: res.data.threadId,
        status: 'sent',
        simulated: false,
        to: input.to,
        subject: input.subject,
      };
    } catch (googleErr: any) {
      const errMsg = googleErr.response?.data?.error?.message || googleErr.message || 'Unknown Gmail API error';
      throw new Error(`Gmail API failed to send email: ${errMsg}`);
    }
  },
  verify: async (output, ctx) => {
    if (!output || !output.messageId) return false;
    if (output.simulated === true) {
      return process.env.NODE_ENV === 'test';
    }
    const connection = await ctx.db.getConnection(ctx.userId, 'google');
    if (!connection) return false;
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
  },
};
