import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import { HealthResponse } from '@relay/shared-types';
import { initializeTools } from './tools/index.js';
import { getDatabase } from './database/index.js';
import { taskRoutes } from './api/tasks.js';
import { approvalRoutes } from './api/approvals.js';
import { voiceRoutes } from './api/voice.js';
import { connectionRoutes } from './api/connections.js';
import { memoryRoutes } from './api/memory.js';

dotenv.config();

export function createServer(): FastifyInstance {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
  });

  // Initialize tool registry
  initializeTools();

  // Plugins
  app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.register(formbody);
  app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25 MB max audio upload
    },
  });

  // Health check endpoint
  app.get('/health', async () => {
    const hasFirebase = Boolean(process.env.FIREBASE_PROJECT_ID);
    const primaryProvider = process.env.GROQ_API_KEY ? 'groq (llama-3.3-70b)' : process.env.ANTHROPIC_API_KEY ? 'anthropic (claude-3.5-sonnet)' : 'mock';

    const health: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: hasFirebase ? 'firestore' : 'in_memory',
      aiProvider: primaryProvider,
    };
    return health;
  });

  // API Route groups
  app.register(taskRoutes, { prefix: '/api/tasks' });
  app.register(approvalRoutes, { prefix: '/api/approvals' });
  app.register(voiceRoutes, { prefix: '/api/voice' });
  app.register(connectionRoutes, { prefix: '/api/connections' });
  app.register(memoryRoutes, { prefix: '/api/memory' });

  return app;
}
