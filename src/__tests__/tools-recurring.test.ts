import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHandlers } from '../tools/handlers';
import type { CalendarService } from '../tools/handlers';

describe('Recurring Event Tool Handlers', () => {
  let mockService: CalendarService;
  let handlers: ReturnType<typeof createHandlers>;

  beforeEach(() => {
    mockService = {
      listEvents: vi.fn(),
      getEvent: vi.fn(),
      createEvent: vi.fn(),
      updateEvent: vi.fn(),
      deleteEvent: vi.fn(),
      listEventInstances: vi.fn(),
      createRecurringEvent: vi.fn(),
      queryFreeBusy: vi.fn(),
      listCalendars: vi.fn(),
      getCalendar: vi.fn(),
      subscribeCalendar: vi.fn(),
      unsubscribeCalendar: vi.fn(),
      listSubscriptions: vi.fn(),
      searchEvents: vi.fn(),
      getCurrentTime: vi.fn(),
    } as unknown as CalendarService;

    handlers = createHandlers(mockService);
  });

  describe('create_recurring_event', () => {
    it('should delegate to createRecurringEvent with recurrence array', async () => {
      const mockResult = {
        id: 'rec_123',
        summary: 'Weekly Standup',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
      };
      vi.mocked(mockService.createRecurringEvent).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        summary: 'Weekly Standup',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
      };

      const result = await handlers.create_recurring_event(input);

      expect(mockService.createRecurringEvent).toHaveBeenCalledWith('primary', {
        summary: 'Weekly Standup',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
      });
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('list_event_instances', () => {
    it('should delegate to listEventInstances and return list of instances', async () => {
      const mockResult = [
        { id: 'inst_1', summary: 'Instance 1', start: { dateTime: '2024-06-15T10:00:00Z' } },
        { id: 'inst_2', summary: 'Instance 2', start: { dateTime: '2024-06-22T10:00:00Z' } },
        { id: 'inst_3', summary: 'Instance 3', start: { dateTime: '2024-06-29T10:00:00Z' } },
      ];
      vi.mocked(mockService.listEventInstances).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        eventId: 'rec_123',
        timeMin: '2024-06-01T00:00:00Z',
        timeMax: '2024-06-30T23:59:59Z',
        maxResults: 50,
      };

      const result = await handlers.list_event_instances(input);

      expect(mockService.listEventInstances).toHaveBeenCalledWith(
        'primary',
        'rec_123',
        '2024-06-01T00:00:00Z',
        '2024-06-30T23:59:59Z',
        50
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('invalid recurrence handling', () => {
    it('should return formatted error when service rejects invalid recurrence', async () => {
      vi.mocked(mockService.createRecurringEvent).mockRejectedValue(
        new Error('Recurrence rules are required for recurring events')
      );

      const input = {
        calendarId: 'primary',
        summary: 'Invalid Event',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        recurrence: [],
      };

      const result = await handlers.create_recurring_event(input);

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Error: Recurrence rules are required for recurring events');
    });
  });

  describe('recurring event with exceptions', () => {
    it('should return all instances including cancelled ones', async () => {
      const mockResult = [
        { id: 'inst_1', summary: 'Instance 1', status: 'confirmed', start: { dateTime: '2024-06-15T10:00:00Z' } },
        { id: 'inst_2', summary: 'Instance 2', status: 'cancelled', start: { dateTime: '2024-06-22T10:00:00Z' } },
        { id: 'inst_3', summary: 'Instance 3', status: 'confirmed', start: { dateTime: '2024-06-29T10:00:00Z' } },
      ];
      vi.mocked(mockService.listEventInstances).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        eventId: 'rec_123',
      };

      const result = await handlers.list_event_instances(input);

      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].status).toBe('confirmed');
      expect(parsed[1].status).toBe('cancelled');
      expect(parsed[2].status).toBe('confirmed');
    });
  });

  describe('empty instances list', () => {
    it('should return empty JSON array when service returns empty array', async () => {
      vi.mocked(mockService.listEventInstances).mockResolvedValue([]);

      const input = {
        calendarId: 'primary',
        eventId: 'rec_123',
      };

      const result = await handlers.list_event_instances(input);

      expect(mockService.listEventInstances).toHaveBeenCalledWith(
        'primary',
        'rec_123',
        undefined,
        undefined,
        undefined
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('[]');
    });
  });
});
