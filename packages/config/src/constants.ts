import { RiskLevel } from '@relay/shared-types';

export const AGENT_CONFIG = {
  MAX_ITERATIONS: 10,
  MAX_DURATION_MS: 120_000, // 2 minutes hard cap
  DEFAULT_TOOL_TIMEOUT_MS: 15_000,
  DEFAULT_MAX_RETRIES: 2,
  BACKOFF_BASE_MS: 1000,
  MAX_TASK_HISTORY_PER_USER: 50,
  DAILY_USER_TOKEN_LIMIT: 100_000,
} as const;

export const CAPABILITY_RISK_MAP: Record<string, { riskLevel: RiskLevel; description: string; requiresConfirmation: boolean }> = {
  // Web capabilities
  'web.search': { riskLevel: 'LOW', description: 'Search the web for information', requiresConfirmation: false },
  'web.open': { riskLevel: 'LOW', description: 'Fetch and read a public webpage', requiresConfirmation: false },

  // Contacts
  'contacts.search': { riskLevel: 'LOW', description: 'Search Google Contacts', requiresConfirmation: false },

  // Calendar capabilities
  'calendar.findAvailability': { riskLevel: 'MEDIUM', description: 'Inspect free/busy schedule slots', requiresConfirmation: false },
  'calendar.listEvents': { riskLevel: 'MEDIUM', description: 'List upcoming calendar events', requiresConfirmation: false },
  'calendar.createEvent': { riskLevel: 'HIGH', description: 'Create a new calendar meeting or event', requiresConfirmation: true },
  'calendar.updateEvent': { riskLevel: 'HIGH', description: 'Modify an existing calendar event', requiresConfirmation: true },
  'calendar.deleteEvent': { riskLevel: 'CRITICAL', description: 'Delete a calendar event permanently', requiresConfirmation: true },

  // Gmail capabilities
  'gmail.searchMessages': { riskLevel: 'MEDIUM', description: 'Search emails in Gmail', requiresConfirmation: false },
  'gmail.readMessage': { riskLevel: 'MEDIUM', description: 'Read email headers and contents', requiresConfirmation: false },
  'gmail.draftMessage': { riskLevel: 'MEDIUM', description: 'Create an email draft in Gmail without sending', requiresConfirmation: false },
  'gmail.sendMessage': { riskLevel: 'HIGH', description: 'Send an email directly from Gmail', requiresConfirmation: true },

  // Tasks meta-capabilities
  'tasks.create': { riskLevel: 'LOW', description: 'Create an autonomous subtask', requiresConfirmation: false },
  'tasks.getStatus': { riskLevel: 'LOW', description: 'Check status of an active task', requiresConfirmation: false },
  'tasks.cancel': { riskLevel: 'LOW', description: 'Cancel an active task', requiresConfirmation: false },

  // Memory
  'memory.save': { riskLevel: 'LOW', description: 'Store a user stated preference', requiresConfirmation: false },
  'memory.get': { riskLevel: 'LOW', description: 'Retrieve user preferences', requiresConfirmation: false },
};

export const GOOGLE_SCOPES = {
  GMAIL_READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
  GMAIL_COMPOSE: 'https://www.googleapis.com/auth/gmail.compose',
  GMAIL_SEND: 'https://www.googleapis.com/auth/gmail.send',
  CALENDAR_READONLY: 'https://www.googleapis.com/auth/calendar.readonly',
  CALENDAR_EVENTS: 'https://www.googleapis.com/auth/calendar.events',
  CONTACTS_READONLY: 'https://www.googleapis.com/auth/contacts.readonly',
  USER_INFO: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
} as const;
