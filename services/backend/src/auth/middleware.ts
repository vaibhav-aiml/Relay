import { FastifyRequest, FastifyReply } from 'fastify';
import admin from 'firebase-admin';
import { User } from '@relay/shared-types';
import { getDatabase } from '../database/index.js';

export interface AuthenticatedRequest extends FastifyRequest {
  user: User;
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  const db = getDatabase();

  // If running in development without Firebase keys or with local bearer token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Default fallback user for development
    let defaultUser = await db.getUser('default-user');
    if (!defaultUser) {
      defaultUser = {
        id: 'default-user',
        profile: {
          name: 'Pilot User',
          email: 'user@example.com',
          createdAt: new Date().toISOString(),
        },
        settings: {
          voiceEnabled: true,
          defaultProvider: 'groq',
          autoApproveLowRisk: true,
        },
      };
      await db.saveUser(defaultUser);
    }
    (req as AuthenticatedRequest).user = defaultUser;
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    if (admin.apps.length > 0 && process.env.FIREBASE_PROJECT_ID) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      let user = await db.getUser(decodedToken.uid);

      if (!user) {
        user = {
          id: decodedToken.uid,
          profile: {
            name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
            email: decodedToken.email || '',
            createdAt: new Date().toISOString(),
          },
          settings: {
            voiceEnabled: true,
            defaultProvider: 'groq',
            autoApproveLowRisk: true,
          },
        };
        await db.saveUser(user);
      }
      (req as AuthenticatedRequest).user = user;
    } else {
      // Local fallback
      let user = await db.getUser('default-user');
      if (!user) {
        user = {
          id: 'default-user',
          profile: {
            name: 'Pilot User',
            email: 'user@example.com',
            createdAt: new Date().toISOString(),
          },
          settings: {
            voiceEnabled: true,
            defaultProvider: 'groq',
            autoApproveLowRisk: true,
          },
        };
        await db.saveUser(user);
      }
      (req as AuthenticatedRequest).user = user;
    }
  } catch (err: any) {
    req.log.warn(`Token verification failed: ${err.message}`);
    return reply.status(401).send({ error: 'Unauthorized: Invalid token' });
  }
}
