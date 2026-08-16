import { FastifyInstance } from 'fastify';
import { getDatabase } from '../database/index.js';
import { AuthenticatedRequest, authMiddleware } from '../auth/middleware.js';

export async function memoryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  const db = getDatabase();

  app.get('/', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const memories = await db.getMemories(user.id);
    return reply.send({ memories });
  });

  app.post<{ Body: { category?: string; key: string; value: string } }>('/', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { category, key, value } = req.body;

    if (!key || !value) {
      return reply.status(400).send({ error: 'Key and value are required' });
    }

    const memory = await db.saveMemory({
      userId: user.id,
      category: (category as any) || 'preference',
      key,
      value,
      source: 'user_stated',
      userApproved: true,
    });

    return reply.status(201).send({ memory });
  });

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const success = await db.deleteMemory(user.id, id);
    return reply.send({ success });
  });

  app.delete('/', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    await db.clearAllMemories(user.id);
    return reply.send({ success: true, message: 'All user memories purged' });
  });
}
