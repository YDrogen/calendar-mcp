import { z } from 'zod';

const ISO8601String = z.string().describe('ISO 8601 datetime string');
const CalendarIdString = z
  .string()
  .describe(
    'Google Calendar ID (email format for user calendar, or calendar list ID)'
  );
const EventIdString = z.string().describe('Unique event ID');
const ChannelIdString = z.string().describe('Webhook channel ID');

// Event CRUD schemas

export const ListEventsSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    timeMin: ISO8601String.optional().describe(
      'Start of time range (RFC 3339 format)'
    ),
    timeMax: ISO8601String.optional().describe(
      'End of time range (RFC 3339 format)'
    ),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(250)
      .optional()
      .describe('Maximum number of events to return (max 250)'),
    q: z
      .string()
      .optional()
      .describe('Free text search query for event title/description'),
  })
  .describe('List events in a calendar with optional filtering');

export const GetEventSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    eventId: EventIdString.describe('Event ID to retrieve'),
  })
  .describe('Get details of a single event');

export const CreateEventSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    summary: z.string().describe('Event title'),
    description: z.string().optional().describe('Event description'),
    start: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional().describe('Date in YYYY-MM-DD format'),
        timeZone: z.string().optional(),
      })
      .describe('Event start time (dateTime for timed, date for all-day)'),
    end: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional().describe('Date in YYYY-MM-DD format'),
        timeZone: z.string().optional(),
      })
      .describe('Event end time'),
    attendees: z
      .array(
        z.object({
          email: z.string().email().describe('Attendee email'),
          displayName: z.string().optional().describe('Attendee display name'),
        })
      )
      .optional()
      .describe('List of attendees'),
    recurrence: z
      .array(z.string())
      .optional()
      .describe('Recurrence rules (RRULE strings, e.g., "RRULE:FREQ=WEEKLY")'),
  })
  .describe('Create a new event');

export const UpdateEventSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    eventId: EventIdString.describe('Event ID to update'),
    summary: z.string().optional().describe('Updated event title'),
    description: z.string().optional().describe('Updated description'),
    start: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional(),
        timeZone: z.string().optional(),
      })
      .optional()
      .describe('Updated start time'),
    end: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional(),
        timeZone: z.string().optional(),
      })
      .optional()
      .describe('Updated end time'),
  })
  .describe('Update an existing event (partial update)');

export const DeleteEventSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    eventId: EventIdString.describe('Event ID to delete'),
  })
  .describe('Delete an event');

// Recurring event schemas

export const ListEventInstancesSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    eventId: EventIdString.describe('Recurring event ID'),
    timeMin: ISO8601String.optional().describe(
      'Start of time range for instances'
    ),
    timeMax: ISO8601String.optional().describe(
      'End of time range for instances'
    ),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(250)
      .optional()
      .describe('Maximum instances to return'),
  })
  .describe('List individual instances of a recurring event');

export const CreateRecurringEventSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    summary: z.string().describe('Event title'),
    start: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional(),
        timeZone: z.string().optional(),
      })
      .describe('Event start time'),
    end: z
      .object({
        dateTime: ISO8601String.optional(),
        date: z.string().optional(),
        timeZone: z.string().optional(),
      })
      .describe('Event end time'),
    recurrence: z
      .array(z.string())
      .min(1)
      .describe(
        'Recurrence rules as RRULE strings (e.g., ["RRULE:FREQ=WEEKLY;COUNT=10"])'
      ),
    description: z.string().optional().describe('Event description'),
  })
  .describe('Create a recurring event');

// Free/busy schema

export const QueryFreeBusySchema = z
  .object({
    calendarIds: z
      .array(CalendarIdString)
      .min(1)
      .max(50)
      .describe('Calendar IDs to query (max 50)'),
    timeMin: ISO8601String.describe('Start of time range'),
    timeMax: ISO8601String.describe('End of time range'),
    timeZone: z
      .string()
      .optional()
      .describe('Timezone for response (defaults to UTC)'),
  })
  .describe('Query free/busy availability for multiple calendars');

// Calendar management schemas

export const ListCalendarsSchema = z
  .object({})
  .describe('List all calendars in the user account');

export const GetCalendarSchema = z
  .object({
    calendarId: CalendarIdString.describe('Calendar ID'),
  })
  .describe('Get details of a single calendar');

// Webhook subscription schemas

export const SubscribeCalendarSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    webhookUrl: z.string().url().describe('Webhook endpoint URL for push notifications'),
  })
  .describe(
    'Subscribe to push notifications for calendar changes (7-day expiry)'
  );

export const UnsubscribeCalendarSchema = z
  .object({
    channelId: ChannelIdString.describe('Webhook channel ID to unsubscribe'),
  })
  .describe('Unsubscribe from calendar push notifications');

export const ListSubscriptionsSchema = z
  .object({})
  .describe('List active webhook subscriptions');

// Utility schemas

export const SearchEventsSchema = z
  .object({
    calendarId: CalendarIdString.optional().describe(
      'Calendar ID (defaults to primary)'
    ),
    q: z.string().describe('Search query string'),
    timeMin: ISO8601String.optional().describe('Start of time range'),
    timeMax: ISO8601String.optional().describe('End of time range'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(250)
      .optional()
      .describe('Maximum results to return'),
  })
  .describe('Full-text search events in a calendar');

export const GetCurrentTimeSchema = z
  .object({})
  .describe('Get current server time with timezone context');

// Type exports for consuming code
export type ListEventsInput = z.infer<typeof ListEventsSchema>;
export type GetEventInput = z.infer<typeof GetEventSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type DeleteEventInput = z.infer<typeof DeleteEventSchema>;
export type ListEventInstancesInput = z.infer<typeof ListEventInstancesSchema>;
export type CreateRecurringEventInput = z.infer<
  typeof CreateRecurringEventSchema
>;
export type QueryFreeBusyInput = z.infer<typeof QueryFreeBusySchema>;
export type ListCalendarsInput = z.infer<typeof ListCalendarsSchema>;
export type GetCalendarInput = z.infer<typeof GetCalendarSchema>;
export type SubscribeCalendarInput = z.infer<typeof SubscribeCalendarSchema>;
export type UnsubscribeCalendarInput = z.infer<typeof UnsubscribeCalendarSchema>;
export type ListSubscriptionsInput = z.infer<typeof ListSubscriptionsSchema>;
export type SearchEventsInput = z.infer<typeof SearchEventsSchema>;
export type GetCurrentTimeInput = z.infer<typeof GetCurrentTimeSchema>;

// Registry of all tool schemas
export const AllToolSchemas = {
  list_events: ListEventsSchema,
  get_event: GetEventSchema,
  create_event: CreateEventSchema,
  update_event: UpdateEventSchema,
  delete_event: DeleteEventSchema,
  list_event_instances: ListEventInstancesSchema,
  create_recurring_event: CreateRecurringEventSchema,
  query_free_busy: QueryFreeBusySchema,
  list_calendars: ListCalendarsSchema,
  get_calendar: GetCalendarSchema,
  subscribe_calendar: SubscribeCalendarSchema,
  unsubscribe_calendar: UnsubscribeCalendarSchema,
  list_subscriptions: ListSubscriptionsSchema,
  search_events: SearchEventsSchema,
  get_current_time: GetCurrentTimeSchema,
} as const;
