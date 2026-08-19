import { z } from 'zod';

export const messagingSendWhatsAppSchema = z.object({
  phoneNumber: z.string().min(3).describe('Recipient phone number, ideally in full international E.164 format (e.g. +91 98765 43210). WhatsApp requires international format to resolve correctly.'),
  recipientName: z.string().min(1).describe('Display name or alias of the recipient (e.g. Mom, Rahul)'),
  messageBody: z.string().min(1).describe('The message text to send via WhatsApp'),
  idempotencyKey: z.string().optional().describe('Unique key to prevent duplicate messages'),
});

export type MessagingSendWhatsAppInput = z.infer<typeof messagingSendWhatsAppSchema>;

export const messagingSendSmsSchema = z.object({
  phoneNumber: z.string().min(3).describe('Recipient phone number in E.164 or local format (e.g. +91 98765 43210)'),
  recipientName: z.string().min(1).describe('Display name or alias of the recipient (e.g. Mom, Rahul)'),
  messageBody: z.string().min(1).describe('The SMS message text to send'),
  idempotencyKey: z.string().optional().describe('Unique key to prevent duplicate messages'),
});

export type MessagingSendSmsInput = z.infer<typeof messagingSendSmsSchema>;
