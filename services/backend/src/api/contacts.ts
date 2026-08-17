import { FastifyInstance } from 'fastify';
import { getDatabase } from '../database/index.js';
import { AuthenticatedRequest, authMiddleware } from '../auth/middleware.js';
import { UserContact } from '@relay/shared-types';

export async function contactsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  const db = getDatabase();

  // Sync device contacts
  app.post<{ Body: { contacts: UserContact[] } }>('/sync', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { contacts } = req.body;

    if (!Array.isArray(contacts)) {
      return reply.status(400).send({ error: 'Contacts array is required' });
    }

    // Filter and sanitize valid contacts
    const sanitizedContacts: UserContact[] = contacts
      .filter((c) => c && typeof c.name === 'string' && c.name.trim().length > 0)
      .map((c) => ({
        name: c.name.trim(),
        phone: c.phone ? c.phone.trim() : undefined,
        email: c.email ? c.email.trim() : undefined,
        relation: c.relation ? c.relation.trim() : undefined,
      }));

    await db.saveUserContacts(user.id, sanitizedContacts);

    // Safe sanitized logging - no PII (names, phones, emails) in logs
    req.log.info(
      {
        safeMetadata: {
          userId: user.id,
          syncedCount: sanitizedContacts.length,
        },
      },
      `Device contacts synced (${sanitizedContacts.length} contacts)`
    );

    console.log(`[Contacts] Synced ${sanitizedContacts.length} device contacts for user: ${user.id}`);

    return reply.status(200).send({
      success: true,
      count: sanitizedContacts.length,
      message: `Successfully synced ${sanitizedContacts.length} contacts`,
    });
  });

  // Get synced device contacts
  app.get('/', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const contacts = await db.getUserContacts(user.id);
    return reply.send({ contacts });
  });

  // Clear synced device contacts
  app.delete('/', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    await db.clearUserContacts(user.id);

    req.log.info(
      {
        safeMetadata: {
          userId: user.id,
          cleared: true,
        },
      },
      'User device contacts cleared'
    );

    console.log(`[Contacts] Cleared device contacts for user: ${user.id}`);

    return reply.send({ success: true, message: 'All synced device contacts cleared' });
  });
}
