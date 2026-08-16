import { z } from 'zod';
import { RiskLevel } from '@relay/shared-types';
import { IDatabaseRepository } from '../database/types.js';

export interface ExecutionContext {
  userId: string;
  taskId: string;
  db: IDatabaseRepository;
  logger?: any;
  userGoogleToken?: string;
}

export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TOutput, any, any>;
  riskLevel: RiskLevel;
  requiredPermission: string;
  idempotencyKeyFn?: (input: TInput) => string;
  execute: (input: TInput, ctx: ExecutionContext) => Promise<TOutput>;
  verify: (output: TOutput, ctx: ExecutionContext) => Promise<boolean>;
  timeoutMs: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
}
