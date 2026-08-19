import {
  messagingSendWhatsAppSchema,
  messagingSendSmsSchema,
  MessagingSendWhatsAppInput,
  MessagingSendSmsInput,
} from '@relay/tool-schemas';
import { ToolDefinition, ExecutionContext } from '../types.js';

export const messagingSendWhatsAppTool: ToolDefinition<MessagingSendWhatsAppInput> = {
  name: 'messaging.sendWhatsApp',
  description:
    'Send a WhatsApp message to a resolved contact with their phone number and message body. Opens WhatsApp on the user device with the message pre-filled upon user approval. Phone number should ideally be in full international E.164 format for WhatsApp to resolve correctly.',
  inputSchema: messagingSendWhatsAppSchema,
  riskLevel: 'HIGH',
  requiredPermission: 'messaging.sendWhatsApp',
  idempotencyKeyFn: (input) =>
    input.idempotencyKey || `whatsapp-${input.recipientName}-${input.phoneNumber}`,
  timeoutMs: 15_000,
  retryPolicy: { maxRetries: 1, backoffMs: 1000 },
  execute: async (input: MessagingSendWhatsAppInput, _ctx: ExecutionContext) => {
    // Strip non-numeric characters except leading +
    const cleanNumber = input.phoneNumber.replace(/[^\d+]/g, '');
    const encodedMsg = encodeURIComponent(input.messageBody);
    const deepLinkUrl = `whatsapp://send?phone=${cleanNumber}&text=${encodedMsg}`;

    return {
      status: 'message_ready',
      channel: 'whatsapp',
      recipientName: input.recipientName,
      phoneNumber: input.phoneNumber,
      cleanPhoneNumber: cleanNumber,
      messageBody: input.messageBody,
      deepLinkUrl,
      message: `WhatsApp message prepared for ${input.recipientName} (${input.phoneNumber})`,
    };
  },
  verify: async (output) => {
    return Boolean(output && output.deepLinkUrl && output.phoneNumber && output.messageBody);
  },
};

export const messagingSendSmsTool: ToolDefinition<MessagingSendSmsInput> = {
  name: 'messaging.sendSMS',
  description:
    'Send an SMS text message to a resolved contact with their phone number and message body. Opens the native SMS/Messages app on the user device with the message pre-filled upon user approval.',
  inputSchema: messagingSendSmsSchema,
  riskLevel: 'HIGH',
  requiredPermission: 'messaging.sendSMS',
  idempotencyKeyFn: (input) =>
    input.idempotencyKey || `sms-${input.recipientName}-${input.phoneNumber}`,
  timeoutMs: 15_000,
  retryPolicy: { maxRetries: 1, backoffMs: 1000 },
  execute: async (input: MessagingSendSmsInput, _ctx: ExecutionContext) => {
    const cleanNumber = input.phoneNumber.replace(/[^\d+]/g, '');
    const encodedMsg = encodeURIComponent(input.messageBody);
    const deepLinkUrl = `sms:${cleanNumber}?body=${encodedMsg}`;

    return {
      status: 'message_ready',
      channel: 'sms',
      recipientName: input.recipientName,
      phoneNumber: input.phoneNumber,
      cleanPhoneNumber: cleanNumber,
      messageBody: input.messageBody,
      deepLinkUrl,
      message: `SMS message prepared for ${input.recipientName} (${input.phoneNumber})`,
    };
  },
  verify: async (output) => {
    return Boolean(output && output.deepLinkUrl && output.phoneNumber && output.messageBody);
  },
};
