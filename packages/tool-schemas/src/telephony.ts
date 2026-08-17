import { z } from 'zod';

export const telephonyMakeCallSchema = z.object({
  phoneNumber: z.string().min(3).describe('E.164 or formatted recipient phone number (e.g. +91 98765 43210)'),
  recipientName: z.string().min(1).describe('Display name or alias of the person being called (e.g. Mom, Rahul)'),
  reason: z.string().optional().describe('Brief reason or context for the call'),
  idempotencyKey: z.string().optional().describe('Unique key to prevent duplicate calls'),
});

export type TelephonyMakeCallInput = z.infer<typeof telephonyMakeCallSchema>;
