import { google } from 'googleapis';
import {
  calendarFindAvailabilitySchema,
  calendarListEventsSchema,
  calendarCreateEventSchema,
  calendarUpdateEventSchema,
  CalendarFindAvailabilityInput,
  CalendarListEventsInput,
  CalendarCreateEventInput,
  CalendarUpdateEventInput,
} from '@relay/tool-schemas';
import { ToolDefinition, ExecutionContext } from '../types.js';
import { GoogleOAuthService } from '../../integrations/googleOAuth.js';

// In-memory calendar store for offline / mock testing
const mockCalendarEvents = new Map<string, any>([
  [
    'event-1',
    {
      id: 'event-1',
      summary: 'Weekly Team Sync',
      start: { dateTime: '2026-08-18T10:00:00+05:30' },
      end: { dateTime: '2026-08-18T10:30:00+05:30' },
      attendees: [{ email: 'rahul@example.com' }],
    },
  ],
]);

export const calendarFindAvailabilityTool: ToolDefinition<CalendarFindAvailabilityInput> = {
  name: 'calendar.findAvailability',
  description: 'Search for available (free/busy) calendar slots within a specific time window.',
  inputSchema: calendarFindAvailabilitySchema,
  riskLevel: 'MEDIUM',
  requiredPermission: 'calendar.findAvailability',
  timeoutMs: 10_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
  execute: async (input: CalendarFindAvailabilityInput, ctx: ExecutionContext) => {
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (connection && process.env.GOOGLE_CLIENT_ID) {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);
      const calendar = google.calendar({ version: 'v3', auth });

      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: input.timeMin,
          timeMax: input.timeMax,
          items: [{ id: 'primary' }, ...input.attendeeEmails.map((email) => ({ id: email }))],
        },
      });

      return {
        calendars: res.data.calendars,
        searchedWindow: { timeMin: input.timeMin, timeMax: input.timeMax },
        durationMinutes: input.durationMinutes,
      };
    }

    // Mock availability response
    return {
      availableSlots: [
        {
          start: `${input.timeMin.split('T')[0]}T14:00:00+05:30`,
          end: `${input.timeMin.split('T')[0]}T14:30:00+05:30`,
        },
        {
          start: `${input.timeMin.split('T')[0]}T15:00:00+05:30`,
          end: `${input.timeMin.split('T')[0]}T15:30:00+05:30`,
        },
        {
          start: `${input.timeMin.split('T')[0]}T16:30:00+05:30`,
          end: `${input.timeMin.split('T')[0]}T17:00:00+05:30`,
        },
      ],
      searchedWindow: { timeMin: input.timeMin, timeMax: input.timeMax },
      durationMinutes: input.durationMinutes,
    };
  },
  verify: async (output) => {
    return Array.isArray(output.availableSlots) || typeof output.calendars === 'object';
  },
};

export const calendarListEventsTool: ToolDefinition<CalendarListEventsInput> = {
  name: 'calendar.listEvents',
  description: 'List upcoming events and meetings from Google Calendar.',
  inputSchema: calendarListEventsSchema,
  riskLevel: 'MEDIUM',
  requiredPermission: 'calendar.listEvents',
  timeoutMs: 10_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
  execute: async (input: CalendarListEventsInput, ctx: ExecutionContext) => {
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (connection && process.env.GOOGLE_CLIENT_ID) {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);
      const calendar = google.calendar({ version: 'v3', auth });

      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: input.timeMin || new Date().toISOString(),
        timeMax: input.timeMax,
        maxResults: input.maxResults,
        q: input.query,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return {
        events: (res.data.items || []).map((ev) => ({
          id: ev.id,
          summary: ev.summary,
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          attendees: ev.attendees?.map((a) => a.email),
        })),
      };
    }

    return {
      events: Array.from(mockCalendarEvents.values()),
    };
  },
  verify: async (output) => {
    return Array.isArray(output.events);
  },
};

export const calendarCreateEventTool: ToolDefinition<CalendarCreateEventInput> = {
  name: 'calendar.createEvent',
  description: 'Create a new calendar meeting or event. Requires explicit user approval.',
  inputSchema: calendarCreateEventSchema,
  riskLevel: 'HIGH',
  requiredPermission: 'calendar.createEvent',
  idempotencyKeyFn: (input) => input.idempotencyKey,
  timeoutMs: 15_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1500 },
  execute: async (input: CalendarCreateEventInput, ctx: ExecutionContext) => {
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (connection && process.env.GOOGLE_CLIENT_ID) {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);
      const calendar = google.calendar({ version: 'v3', auth });

      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: input.summary,
          description: input.description,
          start: { dateTime: input.startTime },
          end: { dateTime: input.endTime },
          location: input.location,
          attendees: input.attendees?.map((email) => ({ email })),
        },
      });

      return {
        id: res.data.id,
        summary: res.data.summary,
        status: res.data.status,
        htmlLink: res.data.htmlLink,
        start: res.data.start?.dateTime,
        end: res.data.end?.dateTime,
      };
    }

    // Mock creation & store in local mock map for verification
    const mockId = `cal-event-${Date.now()}`;
    const newEvent = {
      id: mockId,
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startTime },
      end: { dateTime: input.endTime },
      attendees: input.attendees?.map((email) => ({ email })),
      status: 'confirmed',
    };
    mockCalendarEvents.set(mockId, newEvent);

    return {
      id: mockId,
      summary: input.summary,
      status: 'confirmed',
      start: input.startTime,
      end: input.endTime,
    };
  },
  verify: async (output, ctx) => {
    if (!output || !output.id) return false;
    // Verification step: check that the created event exists
    const connection = await ctx.db.getConnection(ctx.userId, 'google');
    if (connection && process.env.GOOGLE_CLIENT_ID) {
      try {
        const auth = GoogleOAuthService.createOAuthClient();
        const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
        auth.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth });
        const check = await calendar.events.get({ calendarId: 'primary', eventId: output.id });
        return check.data.id === output.id;
      } catch {
        return false;
      }
    }
    return mockCalendarEvents.has(output.id);
  },
};

export const calendarUpdateEventTool: ToolDefinition<CalendarUpdateEventInput> = {
  name: 'calendar.updateEvent',
  description: 'Update an existing calendar event.',
  inputSchema: calendarUpdateEventSchema,
  riskLevel: 'HIGH',
  requiredPermission: 'calendar.updateEvent',
  idempotencyKeyFn: (input) => input.idempotencyKey,
  timeoutMs: 15_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1500 },
  execute: async (input: CalendarUpdateEventInput, ctx: ExecutionContext) => {
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (connection && process.env.GOOGLE_CLIENT_ID) {
      const auth = GoogleOAuthService.createOAuthClient();
      const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
      auth.setCredentials(tokens);
      const calendar = google.calendar({ version: 'v3', auth });

      const res = await calendar.events.patch({
        calendarId: 'primary',
        eventId: input.eventId,
        requestBody: {
          ...(input.summary ? { summary: input.summary } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.startTime ? { start: { dateTime: input.startTime } } : {}),
          ...(input.endTime ? { end: { dateTime: input.endTime } } : {}),
          ...(input.attendees ? { attendees: input.attendees.map((email) => ({ email })) } : {}),
        },
      });

      return {
        id: res.data.id,
        summary: res.data.summary,
        status: res.data.status,
      };
    }

    const existing = mockCalendarEvents.get(input.eventId) || { id: input.eventId };
    const updated = {
      ...existing,
      ...(input.summary ? { summary: input.summary } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.startTime ? { start: { dateTime: input.startTime } } : {}),
      ...(input.endTime ? { end: { dateTime: input.endTime } } : {}),
    };
    mockCalendarEvents.set(input.eventId, updated);

    return {
      id: input.eventId,
      summary: updated.summary,
      status: 'confirmed',
    };
  },
  verify: async (output) => {
    return Boolean(output && output.id);
  },
};
