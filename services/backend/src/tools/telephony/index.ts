import { telephonyMakeCallSchema, TelephonyMakeCallInput } from '@relay/tool-schemas';
import { ToolDefinition, ExecutionContext } from '../types.js';

export const telephonyMakeCallTool: ToolDefinition<TelephonyMakeCallInput> = {
  name: 'telephony.makeCall',
  description: 'Initiate a phone call to a resolved contact with their phone number. Opens the device native phone dialer upon user approval.',
  inputSchema: telephonyMakeCallSchema,
  riskLevel: 'HIGH',
  requiredPermission: 'telephony.makeCall',
  idempotencyKeyFn: (input) => input.idempotencyKey || `${input.recipientName}-${input.phoneNumber}`,
  timeoutMs: 15_000,
  retryPolicy: { maxRetries: 1, backoffMs: 1000 },
  execute: async (input: TelephonyMakeCallInput, _ctx: ExecutionContext) => {
    // Format sanitized phone URL for device dialer
    const cleanNumber = input.phoneNumber.replace(/[^\d+]/g, '');
    const dialerUrl = `tel:${cleanNumber}`;

    return {
      status: 'dialer_ready',
      recipientName: input.recipientName,
      phoneNumber: input.phoneNumber,
      cleanPhoneNumber: cleanNumber,
      dialerUrl,
      reason: input.reason || 'Requested phone call',
      message: `Device dialer prepared for ${input.recipientName} (${input.phoneNumber})`,
    };
  },
  verify: async (output) => {
    return Boolean(output && output.dialerUrl && output.phoneNumber);
  },
};
