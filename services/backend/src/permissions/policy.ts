import { RiskLevel, User } from '@relay/shared-types';
import { CAPABILITY_RISK_MAP } from '@relay/config';

export type PolicyDecision = 'ALLOWED' | 'NEEDS_CONFIRMATION' | 'BLOCKED';

export interface PolicyEvaluation {
  decision: PolicyDecision;
  riskLevel: RiskLevel;
  capability: string;
  reason?: string;
}

export class PolicyEngine {
  /**
   * Deterministically evaluates whether a capability can be executed directly,
   * requires explicit user confirmation, or is blocked.
   */
  public static evaluate(capability: string, user: User): PolicyEvaluation {
    const capabilityDef = CAPABILITY_RISK_MAP[capability];

    if (!capabilityDef) {
      // Unknown capabilities are blocked by default for security
      return {
        decision: 'BLOCKED',
        riskLevel: 'CRITICAL',
        capability,
        reason: `Capability '${capability}' is not recognized by security policy.`,
      };
    }

    const { riskLevel, requiresConfirmation } = capabilityDef;

    // Critical actions always require confirmation or may be blocked by user settings
    if (riskLevel === 'CRITICAL') {
      return {
        decision: 'NEEDS_CONFIRMATION',
        riskLevel: 'CRITICAL',
        capability,
        reason: `Critical risk action requires mandatory user confirmation.`,
      };
    }

    // High risk actions (send email, create/update calendar event) require confirmation
    if (riskLevel === 'HIGH' || requiresConfirmation) {
      return {
        decision: 'NEEDS_CONFIRMATION',
        riskLevel: 'HIGH',
        capability,
        reason: `High risk action '${capability}' modifies external state and requires user approval.`,
      };
    }

    // Low and Medium risk read actions are allowed
    return {
      decision: 'ALLOWED',
      riskLevel,
      capability,
    };
  }

  /**
   * Generates a clear, user-facing explanation of what an action intends to do.
   */
  public static formatApprovalDescription(toolName: string, args: Record<string, unknown>): string {
    switch (toolName) {
      case 'gmail.sendMessage': {
        const to = Array.isArray(args.to) ? args.to.join(', ') : String(args.to || '');
        const subject = String(args.subject || '(No subject)');
        return `Send email to ${to} with subject "${subject}"`;
      }
      case 'calendar.createEvent': {
        const summary = String(args.summary || 'Meeting');
        const start = String(args.startTime || '');
        const attendees = Array.isArray(args.attendees) && args.attendees.length > 0
          ? ` with ${args.attendees.join(', ')}`
          : '';
        return `Create calendar event "${summary}" on ${start}${attendees}`;
      }
      case 'calendar.updateEvent': {
        const eventId = String(args.eventId || '');
        return `Update calendar event ID ${eventId}`;
      }
      case 'calendar.deleteEvent': {
        const eventId = String(args.eventId || '');
        return `Delete calendar event ID ${eventId}`;
      }
      case 'telephony.makeCall': {
        const name = String(args.recipientName || 'contact');
        const phone = String(args.phoneNumber || '');
        const reason = args.reason ? ` - ${args.reason}` : '';
        return `Call ${name} at ${phone}${reason}`;
      }
      default:
        return `Execute action '${toolName}' with provided parameters`;
    }
  }
}
