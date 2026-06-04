import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHandlers } from '../tools/handlers';
import type { CalendarService } from '../tools/handlers';
import { QueryFreeBusySchema } from '../types/tools';

describe('Free/Busy and Calendar Management Tool Handlers', () => {
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

  describe('query_free_busy', () => {
    it('should delegate to queryFreeBusy with calendarIds, timeMin, timeMax, and timeZone', async () => {
      const mockResult = {
        kind: 'calendar#freeBusy',
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-01-02T00:00:00Z',
        calendars: {
          'cal1@example.com': {
            busy: [{ start: '2024-01-01T10:00:00Z', end: '2024-01-01T11:00:00Z' }],
          },
          'cal2@example.com': {
            busy: [],
          },
        },
      };
      vi.mocked(mockService.queryFreeBusy).mockResolvedValue(mockResult);

      const input = {
        calendarIds: ['cal1@example.com', 'cal2@example.com'],
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-01-02T00:00:00Z',
        timeZone: 'UTC',
      };

      const result = await handlers.query_free_busy(input);

      expect(mockService.queryFreeBusy).toHaveBeenCalledWith(
        ['cal1@example.com', 'cal2@example.com'],
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
        'UTC'
      );
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('query_free_busy max calendars', () => {
    it('should reject more than 50 calendarIds in Zod schema', () => {
      const calendarIds = Array.from({ length: 51 }, (_, i) => `cal${i}@example.com`);
      const result = QueryFreeBusySchema.safeParse({
        calendarIds,
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-01-02T00:00:00Z',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const calendarIdsError = result.error.issues.find(
          (e) => e.path[0] === 'calendarIds'
        );
        expect(calendarIdsError).toBeDefined();
        expect(calendarIdsError?.message.toLowerCase()).toContain('50');
      }
    });

    it('should accept exactly 50 calendarIds', () => {
      const calendarIds = Array.from({ length: 50 }, (_, i) => `cal${i}@example.com`);
      const result = QueryFreeBusySchema.safeParse({
        calendarIds,
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-01-02T00:00:00Z',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('list_calendars', () => {
    it('should delegate to listCalendars and return list of calendars', async () => {
      const mockResult = [
        { id: 'primary', summary: 'My Calendar', accessRole: 'owner' },
        { id: 'work@example.com', summary: 'Work', accessRole: 'reader' },
      ];
      vi.mocked(mockService.listCalendars).mockResolvedValue(mockResult);

      const result = await handlers.list_calendars({});

      expect(mockService.listCalendars).toHaveBeenCalledWith();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('get_calendar', () => {
    it('should delegate to getCalendar with calendarId and return calendar details', async () => {
      const mockResult = {
        id: 'work@example.com',
        summary: 'Work Calendar',
        description: 'Company work calendar',
        accessRole: 'owner',
        timeZone: 'America/New_York',
      };
      vi.mocked(mockService.getCalendar).mockResolvedValue(mockResult);

      const input = { calendarId: 'work@example.com' };
      const result = await handlers.get_calendar(input);

      expect(mockService.getCalendar).toHaveBeenCalledWith('work@example.com');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('query_free_busy with timezone', () => {
    it('should pass timezone parameter correctly when provided', async () => {
      const mockResult = { calendars: {} };
      vi.mocked(mockService.queryFreeBusy).mockResolvedValue(mockResult);

      const input = {
        calendarIds: ['primary'],
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-01-02T00:00:00Z',
        timeZone: 'America/New_York',
      };

      await handlers.query_free_busy(input);

      expect(mockService.queryFreeBusy).toHaveBeenCalledWith(
        ['primary'],
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
        'America/New_York'
      );
    });

    it('should pass undefined for timeZone when omitted, allowing service default of UTC', async () => {
      const mockResult = { calendars: {} };
      vi.mocked(mockService.queryFreeBusy).mockResolvedValue(mockResult);

      const input = {
        calendarIds: ['primary'],
        timeMin: '2024-01-01T00:00:00Z',
        timeMax: '2024-01-02T00:00:00Z',
      };

      await handlers.query_free_busy(input);

      expect(mockService.queryFreeBusy).toHaveBeenCalledWith(
        ['primary'],
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
        undefined
      );
    });
  });
});
