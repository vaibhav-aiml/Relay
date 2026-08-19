import { z } from 'zod';

export const calendarFindAvailabilitySchema = z.object({
  timeMin: z.string().describe('ISO 8601 string for start of search window, e.g. 2026-08-17T09:00:00Z'),
  timeMax: z.string().describe('ISO 8601 string for end of search window, e.g. 2026-08-17T18:00:00Z'),
  durationMinutes: z.coerce.number().int().min(15).max(480).default(30).describe('Required meeting duration in minutes'),
  attendeeEmails: z
    .preprocess((val) => (typeof val === 'string' ? [val] : val), z.array(z.string().email()))
    .optional()
    .default([])
    .describe('Optional attendee emails to check free/busy for'),
});
export type CalendarFindAvailabilityInput = z.infer<typeof calendarFindAvailabilitySchema>;

export const calendarListEventsSchema = z.object({
  timeMin: z.string().optional().describe('ISO 8601 start time'),
  timeMax: z.string().optional().describe('ISO 8601 end time'),
  maxResults: z.coerce.number().int().min(1).max(50).default(10).describe('Max events to fetch'),
  query: z.string().optional().describe('Optional text query to filter events'),
});
export type CalendarListEventsInput = z.infer<typeof calendarListEventsSchema>;

export const calendarCreateEventSchema = z.object({
  summary: z.string().min(1).describe('Event title/summary'),
  description: z.string().optional().describe('Detailed description or agenda for the meeting'),
  startTime: z.string().describe('ISO 8601 start time string, e.g. 2026-08-18T15:00:00+05:30'),
  endTime: z.string().describe('ISO 8601 end time string, e.g. 2026-08-18T15:30:00+05:30'),
  attendees: z
    .preprocess((val) => (typeof val === 'string' ? [val] : val), z.array(z.string().email()))
    .optional()
    .default([])
    .describe('List of attendee email addresses'),
  location: z.string().optional().describe('Location or virtual meeting link'),
  idempotencyKey: z.string().min(8).describe('Unique client/task key to prevent duplicate booking'),
});
export type CalendarCreateEventInput = z.infer<typeof calendarCreateEventSchema>;

export const calendarUpdateEventSchema = z.object({
  eventId: z.string().min(1).describe('The ID of the calendar event to update'),
  summary: z.string().optional().describe('Updated title'),
  description: z.string().optional().describe('Updated description'),
  startTime: z.string().optional().describe('Updated start time'),
  endTime: z.string().optional().describe('Updated end time'),
  attendees: z
    .preprocess((val) => (typeof val === 'string' ? [val] : val), z.array(z.string().email()))
    .optional()
    .describe('Updated attendees list'),
  idempotencyKey: z.string().min(8).describe('Unique idempotency key'),
});
export type CalendarUpdateEventInput = z.infer<typeof calendarUpdateEventSchema>;

export const calendarDeleteEventSchema = z.object({
  eventId: z.string().min(1).describe('The ID of the calendar event to delete permanently'),
  summary: z.string().optional().describe('Title of the event being deleted for user confirmation'),
  idempotencyKey: z.string().optional().describe('Unique idempotency key'),
});
export type CalendarDeleteEventInput = z.infer<typeof calendarDeleteEventSchema>;
