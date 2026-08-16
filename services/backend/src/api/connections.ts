import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { GOOGLE_SCOPES } from '@relay/config';
import { Connection } from '@relay/shared-types';
import { getDatabase } from '../database/index.js';
import { GoogleOAuthService } from '../integrations/googleOAuth.js';
import { AuthenticatedRequest, authMiddleware } from '../auth/middleware.js';

export async function connectionRoutes(app: FastifyInstance) {
  const db = getDatabase();

  // List connections for authenticated user
  app.get('/', { preHandler: [authMiddleware] }, async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const googleConn = await db.getConnection(user.id, 'google');
    return reply.send({ connections: googleConn ? [googleConn] : [] });
  });

  // Get OAuth initiation URL
  app.get('/google/auth-url', { preHandler: [authMiddleware] }, async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const scopes = [
      GOOGLE_SCOPES.GMAIL_READONLY,
      GOOGLE_SCOPES.GMAIL_COMPOSE,
      GOOGLE_SCOPES.GMAIL_SEND,
      GOOGLE_SCOPES.CALENDAR_READONLY,
      GOOGLE_SCOPES.CALENDAR_EVENTS,
      GOOGLE_SCOPES.CONTACTS_READONLY,
    ];

    const authUrl = GoogleOAuthService.getAuthUrl(scopes, user.id);
    return reply.send({ authUrl });
  });

  // OAuth Callback
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/google/callback', async (req, reply) => {
    const { code, state: userId, error } = req.query;

    if (error) {
      return reply.type('text/html').send(`<h3>Google OAuth Authorization Failed: ${error}</h3>`);
    }

    if (!code || !userId) {
      return reply.type('text/html').send(`<h3>Missing authorization code or user state.</h3>`);
    }

    try {
      const client = GoogleOAuthService.createOAuthClient();
      const { tokens } = await client.getToken(code);

      const encryptedTokens = GoogleOAuthService.encryptTokens(tokens as Record<string, unknown>);
      const now = new Date().toISOString();

      const connection: Connection = {
        id: uuidv4(),
        userId,
        provider: 'google',
        scopes: (tokens.scope || '').split(' '),
        encryptedCredentialRef: encryptedTokens,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      await db.saveConnection(connection);

      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <head><title>Relay Google Integration Connected</title></head>
          <body style="font-family: sans-serif; background: #0b0c10; color: #fff; text-align: center; padding: 50px;">
            <h2 style="color: #66fcf1;">Google Account Connected Successfully!</h2>
            <p>You can now return to the Relay app. This window can be closed.</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      req.log.error({ err }, 'Failed to exchange Google OAuth token');
      return reply.type('text/html').send(`<h3>Failed to complete Google OAuth connection: ${err.message}</h3>`);
    }
  });

  // Revoke connection
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: [authMiddleware] }, async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    const success = await db.deleteConnection(user.id, id);
    return reply.send({ success });
  });
}
