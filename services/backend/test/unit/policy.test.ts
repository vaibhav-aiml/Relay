import { PolicyEngine } from '../../src/permissions/policy.js';
import { User } from '@relay/shared-types';

describe('PolicyEngine Unit Tests', () => {
  const mockUser: User = {
    id: 'test-user',
    profile: { name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() },
    settings: { voiceEnabled: true, defaultProvider: 'groq', autoApproveLowRisk: true },
  };

  test('allows low-risk web and contacts tools without confirmation', () => {
    const webResult = PolicyEngine.evaluate('web.search', mockUser);
    expect(webResult.decision).toBe('ALLOWED');
    expect(webResult.riskLevel).toBe('LOW');

    const contactsResult = PolicyEngine.evaluate('contacts.search', mockUser);
    expect(contactsResult.decision).toBe('ALLOWED');
    expect(contactsResult.riskLevel).toBe('LOW');
  });

  test('allows medium-risk read tools without confirmation', () => {
    const calResult = PolicyEngine.evaluate('calendar.findAvailability', mockUser);
    expect(calResult.decision).toBe('ALLOWED');
    expect(calResult.riskLevel).toBe('MEDIUM');

    const gmailResult = PolicyEngine.evaluate('gmail.readMessage', mockUser);
    expect(gmailResult.decision).toBe('ALLOWED');
    expect(gmailResult.riskLevel).toBe('MEDIUM');
  });

  test('requires confirmation for high-risk mutating tools and phone calls', () => {
    const sendEmailResult = PolicyEngine.evaluate('gmail.sendMessage', mockUser);
    expect(sendEmailResult.decision).toBe('NEEDS_CONFIRMATION');
    expect(sendEmailResult.riskLevel).toBe('HIGH');

    const createEventResult = PolicyEngine.evaluate('calendar.createEvent', mockUser);
    expect(createEventResult.decision).toBe('NEEDS_CONFIRMATION');
    expect(createEventResult.riskLevel).toBe('HIGH');

    const makeCallResult = PolicyEngine.evaluate('telephony.makeCall', mockUser);
    expect(makeCallResult.decision).toBe('NEEDS_CONFIRMATION');
    expect(makeCallResult.riskLevel).toBe('HIGH');
  });

  test('formats phone call approval description correctly', () => {
    const desc = PolicyEngine.formatApprovalDescription('telephony.makeCall', {
      recipientName: 'Rahul',
      phoneNumber: '+91 98765 43210',
      reason: 'discuss project roadmap',
    });
    expect(desc).toBe('Call Rahul at +91 98765 43210 - discuss project roadmap');
  });

  test('requires confirmation for critical-risk deletion tools', () => {
    const deleteEventResult = PolicyEngine.evaluate('calendar.deleteEvent', mockUser);
    expect(deleteEventResult.decision).toBe('NEEDS_CONFIRMATION');
    expect(deleteEventResult.riskLevel).toBe('CRITICAL');
  });

  test('blocks unrecognized capabilities for security', () => {
    const unknownResult = PolicyEngine.evaluate('unknown.hackAction', mockUser);
    expect(unknownResult.decision).toBe('BLOCKED');
  });
});
