import { describe, it, expect, vi } from 'vitest';
import { createHandlers } from '../tools/handlers';
import type { CalendarService } from '../tools/handlers';

describe('Tool Handlers', () => {
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

  it('should create all 15 handlers', () => {
    expect(Object.keys(handlers)).toHaveLength(15);
    expect(handlers.list_events).toBeDefined();
    expect(handlers.get_event).toBeDefined();
    expect(handlers.create_event).toBeDefined();
    expect(handlers.update_event).toBeDefined();
    expect(handlers.delete_event).toBeDefined();
    expect(handlers.list_event_instances).toBeDefined();
    expect(handlers.create_recurring_event).toBeDefined();
    expect(handlers.query_free_busy).toBeDefined();
    expect(handlers.list_calendars).toBeDefined();
    expect(handlers.get_calendar).toBeDefined();
    expect(handlers.subscribe_calendar).toBeDefined();
    expect(handlers.unsubscribe_calendar).toBeDefined();
    expect(handlers.list_subscriptions).toBeDefined();
    expect(handlers.search_events).toBeDefined();
    expect(handlers.get_current_time).toBeDefined();
  });

  describe('list_events', () => {
    it('should delegate to listEvents with all parameters', async () => {
      const mockResult = [{ id: '1', summary: 'Event 1' }];
      vi.mocked(mockService.listEvents).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-01-31T23:59:59Z',
        maxResults: 100,
        q: 'meeting',
      };

      const result = await handlers.list_events(input);

      expect(mockService.listEvents).toHaveBeenCalledWith(
        'primary',
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z',
        100,
        'meeting'
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });

    it('should handle optional parameters', async () => {
      vi.mocked(mockService.listEvents).mockResolvedValue([]);

      const result = await handlers.list_events({});

      expect(mockService.listEvents).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
      expect(result.content[0].text).toBe('[]');
    });
  });

  describe('get_event', () => {
    it('should delegate to getEvent', async () => {
      const mockResult = { id: 'evt1', summary: 'My Event' };
      vi.mocked(mockService.getEvent).mockResolvedValue(mockResult);

      const input = { calendarId: 'primary', eventId: 'evt1' };
      const result = await handlers.get_event(input);

      expect(mockService.getEvent).toHaveBeenCalledWith('primary', 'evt1');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('create_event', () => {
    it('should delegate to createEvent with mapped body', async () => {
      const mockResult = { id: 'new1', summary: 'New Event' };
      vi.mocked(mockService.createEvent).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        summary: 'New Event',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      };

      const result = await handlers.create_event(input);

      expect(mockService.createEvent).toHaveBeenCalledWith('primary', {
        summary: 'New Event',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      });
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('update_event', () => {
    it('should delegate to updateEvent with mapped body', async () => {
      const mockResult = { id: 'evt1', summary: 'Updated' };
      vi.mocked(mockService.updateEvent).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        eventId: 'evt1',
        summary: 'Updated Title',
      };

      const result = await handlers.update_event(input);

      expect(mockService.updateEvent).toHaveBeenCalledWith('primary', 'evt1', {
        summary: 'Updated Title',
      });
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('delete_event', () => {
    it('should delegate to deleteEvent', async () => {
      vi.mocked(mockService.deleteEvent).mockResolvedValue(undefined);

      const input = { calendarId: 'primary', eventId: 'evt1' };
      const result = await handlers.delete_event(input);

      expect(mockService.deleteEvent).toHaveBeenCalledWith('primary', 'evt1');
      expect(result.content[0].text).toBe(JSON.stringify(undefined));
    });
  });

  describe('list_event_instances', () => {
    it('should delegate to listEventInstances', async () => {
      const mockResult = [{ id: 'inst1', summary: 'Instance 1' }];
      vi.mocked(mockService.listEventInstances).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        eventId: 'rec1',
        timeMin: '2024-06-01T00:00:00Z',
        timeMax: '2024-06-30T23:59:59Z',
        maxResults: 50,
      };

      const result = await handlers.list_event_instances(input);

      expect(mockService.listEventInstances).toHaveBeenCalledWith(
        'primary',
        'rec1',
        '2024-06-01T00:00:00Z',
        '2024-06-30T23:59:59Z',
        50
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('create_recurring_event', () => {
    it('should delegate to createRecurringEvent with mapped body', async () => {
      const mockResult = { id: 'rec1', summary: 'Weekly Meeting' };
      vi.mocked(mockService.createRecurringEvent).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        summary: 'Weekly Meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
      };

      const result = await handlers.create_recurring_event(input);

      expect(mockService.createRecurringEvent).toHaveBeenCalledWith('primary', {
        summary: 'Weekly Meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
      });
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('query_free_busy', () => {
    it('should delegate to queryFreeBusy', async () => {
      const mockResult = { calendars: {} };
      vi.mocked(mockService.queryFreeBusy).mockResolvedValue(mockResult);

      const input = {
        calendarIds: ['cal1', 'cal2'],
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-01-02T00:00:00Z',
        timeZone: 'UTC',
      };

      const result = await handlers.query_free_busy(input);

      expect(mockService.queryFreeBusy).toHaveBeenCalledWith(
        ['cal1', 'cal2'],
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
        'UTC'
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('list_calendars', () => {
    it('should delegate to listCalendars', async () => {
      const mockResult = [{ id: 'cal1', summary: 'Work' }];
      vi.mocked(mockService.listCalendars).mockResolvedValue(mockResult);

      const result = await handlers.list_calendars({});

      expect(mockService.listCalendars).toHaveBeenCalledWith();
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('get_calendar', () => {
    it('should delegate to getCalendar', async () => {
      const mockResult = { id: 'cal1', summary: 'Work' };
      vi.mocked(mockService.getCalendar).mockResolvedValue(mockResult);

      const input = { calendarId: 'cal1' };
      const result = await handlers.get_calendar(input);

      expect(mockService.getCalendar).toHaveBeenCalledWith('cal1');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('subscribe_calendar', () => {
    it('should delegate to subscribeCalendar', async () => {
      const mockResult = { id: 'channel1', resourceId: 'res1' };
      vi.mocked(mockService.subscribeCalendar).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        webhookUrl: 'https://example.com/webhook',
      };

      const result = await handlers.subscribe_calendar(input);

      expect(mockService.subscribeCalendar).toHaveBeenCalledWith(
        'primary',
        'https://example.com/webhook'
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('unsubscribe_calendar', () => {
    it('should delegate to unsubscribeCalendar', async () => {
      vi.mocked(mockService.unsubscribeCalendar).mockResolvedValue(undefined);

      const input = { channelId: 'channel1' };
      const result = await handlers.unsubscribe_calendar(input);

      expect(mockService.unsubscribeCalendar).toHaveBeenCalledWith('channel1');
      expect(result.content[0].text).toBe(JSON.stringify(undefined));
    });
  });

  describe('list_subscriptions', () => {
    it('should delegate to listSubscriptions', async () => {
      const mockResult = [{ id: 'channel1' }];
      vi.mocked(mockService.listSubscriptions).mockResolvedValue(mockResult);

      const result = await handlers.list_subscriptions({});

      expect(mockService.listSubscriptions).toHaveBeenCalledWith();
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('search_events', () => {
    it('should delegate to searchEvents', async () => {
      const mockResult = [{ id: '1', summary: 'Meeting' }];
      vi.mocked(mockService.searchEvents).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        q: 'meeting',
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-01-31T23:59:59Z',
        maxResults: 50,
      };

      const result = await handlers.search_events(input);

      expect(mockService.searchEvents).toHaveBeenCalledWith(
        'primary',
        'meeting',
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z',
        50
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('get_current_time', () => {
    it('should delegate to getCurrentTime', async () => {
      const mockResult = { currentTime: '2024-01-01T00:00:00Z', timezone: 'UTC' };
      vi.mocked(mockService.getCurrentTime).mockResolvedValue(mockResult);

      const result = await handlers.get_current_time({});

      expect(mockService.getCurrentTime).toHaveBeenCalledWith();
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('error handling', () => {
    it('should format errors with clear messages', async () => {
      vi.mocked(mockService.listEvents).mockRejectedValue(
        new Error('Network error')
      );

      const result = await handlers.list_events({});

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Error: Network error');
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(mockService.getEvent).mockRejectedValue('string error');

      const result = await handlers.get_event({ eventId: 'evt1' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Error: string error');
    });

    it('should handle null/undefined exceptions', async () => {
      vi.mocked(mockService.deleteEvent).mockRejectedValue(null);

      const result = await handlers.delete_event({ eventId: 'evt1' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Error: null');
    });
  });
});
