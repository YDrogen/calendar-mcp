import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ListEventsSchema,
  GetEventSchema,
  CreateEventSchema,
  UpdateEventSchema,
  DeleteEventSchema,
  ListEventInstancesSchema,
  CreateRecurringEventSchema,
  QueryFreeBusySchema,
  ListCalendarsSchema,
  GetCalendarSchema,
  SubscribeCalendarSchema,
  UnsubscribeCalendarSchema,
  ListSubscriptionsSchema,
  SearchEventsSchema,
  GetCurrentTimeSchema,
  AllToolSchemas,
} from '../types/tools';

describe('Tool Schemas - Validation Tests', () => {
  describe('ListEventsSchema', () => {
    it('should parse valid input with all fields', () => {
      const input = {
        calendarId: 'primary',
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-12-31T23:59:59Z',
        maxResults: 100,
        q: 'meeting',
      };
      expect(() => ListEventsSchema.parse(input)).not.toThrow();
    });

    it('should parse valid input with optional fields omitted', () => {
      const input = {};
      expect(() => ListEventsSchema.parse(input)).not.toThrow();
    });

    it('should reject maxResults > 250', () => {
      const input = { maxResults: 251 };
      expect(() => ListEventsSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should reject invalid maxResults (zero or negative)', () => {
      expect(() => ListEventsSchema.parse({ maxResults: 0 })).toThrow(
        z.ZodError
      );
      expect(() => ListEventsSchema.parse({ maxResults: -1 })).toThrow(
        z.ZodError
      );
    });
  });

  describe('GetEventSchema', () => {
    it('should require eventId', () => {
      const input = { calendarId: 'primary' };
      expect(() => GetEventSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should parse with required eventId', () => {
      const input = { eventId: 'event123' };
      expect(() => GetEventSchema.parse(input)).not.toThrow();
    });
  });

  describe('CreateEventSchema', () => {
    it('should require summary, start, and end', () => {
      const input = {};
      expect(() => CreateEventSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should parse valid timed event', () => {
      const input = {
        summary: 'Meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      };
      expect(() => CreateEventSchema.parse(input)).not.toThrow();
    });

    it('should parse valid all-day event', () => {
      const input = {
        summary: 'Birthday',
        start: { date: '2024-06-15' },
        end: { date: '2024-06-16' },
      };
      expect(() => CreateEventSchema.parse(input)).not.toThrow();
    });

    it('should parse with attendees', () => {
      const input = {
        summary: 'Meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        attendees: [
          { email: 'user@example.com' },
          { email: 'admin@example.com', displayName: 'Admin' },
        ],
      };
      expect(() => CreateEventSchema.parse(input)).not.toThrow();
    });

    it('should parse with recurrence', () => {
      const input = {
        summary: 'Weekly meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
      };
      expect(() => CreateEventSchema.parse(input)).not.toThrow();
    });

    it('should reject invalid attendee email', () => {
      const input = {
        summary: 'Meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        attendees: [{ email: 'not-an-email' }],
      };
      expect(() => CreateEventSchema.parse(input)).toThrow(z.ZodError);
    });
  });

  describe('UpdateEventSchema', () => {
    it('should require eventId', () => {
      const input = { summary: 'Updated' };
      expect(() => UpdateEventSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should allow partial updates', () => {
      const input = { eventId: 'event123', summary: 'New Title' };
      expect(() => UpdateEventSchema.parse(input)).not.toThrow();
    });

    it('should allow updating only time fields', () => {
      const input = {
        eventId: 'event123',
        start: { dateTime: '2024-06-20T14:00:00Z' },
      };
      expect(() => UpdateEventSchema.parse(input)).not.toThrow();
    });
  });

  describe('DeleteEventSchema', () => {
    it('should require eventId', () => {
      expect(() => DeleteEventSchema.parse({})).toThrow(z.ZodError);
    });

    it('should parse with eventId', () => {
      expect(() => DeleteEventSchema.parse({ eventId: 'event123' })).not.toThrow();
    });
  });

  describe('ListEventInstancesSchema', () => {
    it('should require eventId', () => {
      expect(() => ListEventInstancesSchema.parse({})).toThrow(z.ZodError);
    });

    it('should parse with eventId and optional time range', () => {
      const input = {
        eventId: 'event123',
        timeMin: '2024-06-01T00:00:00Z',
        timeMax: '2024-06-30T23:59:59Z',
      };
      expect(() => ListEventInstancesSchema.parse(input)).not.toThrow();
    });
  });

  describe('CreateRecurringEventSchema', () => {
    it('should require summary, start, end, and recurrence array', () => {
      const input = {
        summary: 'Weekly',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      };
      expect(() => CreateRecurringEventSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should require non-empty recurrence array', () => {
      const input = {
        summary: 'Weekly',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        recurrence: [],
      };
      expect(() => CreateRecurringEventSchema.parse(input)).toThrow(z.ZodError);
    });

    it('should parse with valid recurrence', () => {
      const input = {
        summary: 'Weekly meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
      };
      expect(() => CreateRecurringEventSchema.parse(input)).not.toThrow();
    });
  });

  describe('QueryFreeBusySchema', () => {
    it('should require calendarIds and time range', () => {
      expect(() => QueryFreeBusySchema.parse({})).toThrow(z.ZodError);
    });

    it('should require non-empty calendarIds', () => {
      const input = {
        calendarIds: [],
        timeMin: '2024-06-01T00:00:00Z',
        timeMax: '2024-06-30T23:59:59Z',
      };
      expect(() => QueryFreeBusySchema.parse(input)).toThrow(z.ZodError);
    });

    it('should reject more than 50 calendarIds', () => {
      const input = {
        calendarIds: Array(51)
          .fill(0)
          .map((_, i) => `calendar${i}@google.com`),
        timeMin: '2024-06-01T00:00:00Z',
        timeMax: '2024-06-30T23:59:59Z',
      };
      expect(() => QueryFreeBusySchema.parse(input)).toThrow(z.ZodError);
    });

    it('should parse with max 50 calendarIds', () => {
      const input = {
        calendarIds: Array(50)
          .fill(0)
          .map((_, i) => `calendar${i}@google.com`),
        timeMin: '2024-06-01T00:00:00Z',
        timeMax: '2024-06-30T23:59:59Z',
      };
      expect(() => QueryFreeBusySchema.parse(input)).not.toThrow();
    });
  });

  describe('ListCalendarsSchema', () => {
    it('should parse empty object', () => {
      expect(() => ListCalendarsSchema.parse({})).not.toThrow();
    });
  });

  describe('GetCalendarSchema', () => {
    it('should require calendarId', () => {
      expect(() => GetCalendarSchema.parse({})).toThrow(z.ZodError);
    });

    it('should parse with calendarId', () => {
      expect(() => GetCalendarSchema.parse({ calendarId: 'primary' })).not.toThrow();
    });
  });

  describe('SubscribeCalendarSchema', () => {
    it('should require webhookUrl', () => {
      expect(() => SubscribeCalendarSchema.parse({})).toThrow(z.ZodError);
    });

    it('should require valid URL for webhookUrl', () => {
      expect(() =>
        SubscribeCalendarSchema.parse({ webhookUrl: 'not-a-url' })
      ).toThrow(z.ZodError);
    });

    it('should parse with valid URL', () => {
      expect(() =>
        SubscribeCalendarSchema.parse({
          webhookUrl: 'https://example.com/webhook',
        })
      ).not.toThrow();
    });
  });

  describe('UnsubscribeCalendarSchema', () => {
    it('should require channelId', () => {
      expect(() => UnsubscribeCalendarSchema.parse({})).toThrow(z.ZodError);
    });

    it('should parse with channelId', () => {
      expect(() =>
        UnsubscribeCalendarSchema.parse({ channelId: 'channel123' })
      ).not.toThrow();
    });
  });

  describe('ListSubscriptionsSchema', () => {
    it('should parse empty object', () => {
      expect(() => ListSubscriptionsSchema.parse({})).not.toThrow();
    });
  });

  describe('SearchEventsSchema', () => {
    it('should require search query', () => {
      expect(() => SearchEventsSchema.parse({})).toThrow(z.ZodError);
    });

    it('should parse with required query', () => {
      const input = { q: 'meeting' };
      expect(() => SearchEventsSchema.parse(input)).not.toThrow();
    });

    it('should parse with time range and maxResults', () => {
      const input = {
        q: 'meeting',
        timeMin: '2024-06-01T00:00:00Z',
        timeMax: '2024-06-30T23:59:59Z',
        maxResults: 50,
      };
      expect(() => SearchEventsSchema.parse(input)).not.toThrow();
    });
  });

  describe('GetCurrentTimeSchema', () => {
    it('should parse empty object', () => {
      expect(() => GetCurrentTimeSchema.parse({})).not.toThrow();
    });
  });

  describe('AllToolSchemas registry', () => {
    it('should contain all 27 tool schemas', () => {
      expect(Object.keys(AllToolSchemas)).toHaveLength(27);
    });

    it('should have schemas for all CRUD operations', () => {
      expect(AllToolSchemas).toHaveProperty('list_events');
      expect(AllToolSchemas).toHaveProperty('get_event');
      expect(AllToolSchemas).toHaveProperty('create_event');
      expect(AllToolSchemas).toHaveProperty('update_event');
      expect(AllToolSchemas).toHaveProperty('delete_event');
    });

    it('should have schemas for recurring events', () => {
      expect(AllToolSchemas).toHaveProperty('list_event_instances');
      expect(AllToolSchemas).toHaveProperty('create_recurring_event');
    });

    it('should have schemas for free/busy and calendars', () => {
      expect(AllToolSchemas).toHaveProperty('query_free_busy');
      expect(AllToolSchemas).toHaveProperty('list_calendars');
      expect(AllToolSchemas).toHaveProperty('get_calendar');
    });

    it('should have schemas for webhooks', () => {
      expect(AllToolSchemas).toHaveProperty('subscribe_calendar');
      expect(AllToolSchemas).toHaveProperty('unsubscribe_calendar');
      expect(AllToolSchemas).toHaveProperty('list_subscriptions');
    });

    it('should have schemas for utilities', () => {
      expect(AllToolSchemas).toHaveProperty('search_events');
      expect(AllToolSchemas).toHaveProperty('get_current_time');
    });
  });

  describe('Edge cases', () => {
    it('should pass extra unknown properties (Zod default behavior)', () => {
      const input = {
        calendarId: 'primary',
        unknownField: 'value',
      };
      const result = ListEventsSchema.parse(input);
      expect(result).toEqual({ calendarId: 'primary' });
    });

    it('should handle whitespace in string fields', () => {
      const input = {
        summary: '  Meeting Title  ',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      };
      const result = CreateEventSchema.parse(input);
      expect(result.summary).toBe('  Meeting Title  ');
    });

    it('should accept empty description', () => {
      const input = {
        summary: 'Meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        description: '',
      };
      expect(() => CreateEventSchema.parse(input)).not.toThrow();
    });
  });
});
