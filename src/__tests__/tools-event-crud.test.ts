import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GaxiosError } from 'gaxios';
import { createHandlers } from '../tools/handlers';
import type { CalendarService } from '../tools/handlers';

function createMockGaxiosError(
  status: number,
  reason: string,
  message: string
): GaxiosError {
  const error = new Error(message) as GaxiosError;
  Object.setPrototypeOf(error, GaxiosError.prototype);
  error.name = 'GaxiosError';
  error.status = status;
  error.response = {
    status,
    statusText: reason,
    data: {
      error: {
        errors: [{ reason, message }],
        message,
      },
    },
    headers: {},
    config: { url: 'https://example.com' } as unknown as GaxiosError['config'],
  };
  return error;
}

describe('Event CRUD Tool Handlers', () => {
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

  describe('create_event', () => {
    it('should delegate to createEvent and return JSON response with event data', async () => {
      const mockResult = {
        id: 'evt_123',
        summary: 'Team Meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      };
      vi.mocked(mockService.createEvent).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        summary: 'Team Meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      };

      const result = await handlers.create_event(input);

      expect(mockService.createEvent).toHaveBeenCalledWith('primary', {
        summary: 'Team Meeting',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      });
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('delete_event not found', () => {
    it('should return isError true with not found message when service throws 404', async () => {
      const error = createMockGaxiosError(
        404,
        'notFound',
        'The requested event was not found.'
      );
      vi.mocked(mockService.deleteEvent).mockRejectedValue(error);

      const input = { calendarId: 'primary', eventId: 'missing_evt' };
      const result = await handlers.delete_event(input);

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('404');
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('list_events all-day events', () => {
    it('should preserve both date and dateTime formats in handler output', async () => {
      const mockResult = [
        {
          id: '1',
          summary: 'All Day Event',
          start: { date: '2024-06-15' },
          end: { date: '2024-06-16' },
        },
        {
          id: '2',
          summary: 'Timed Event',
          start: { dateTime: '2024-06-15T10:00:00Z' },
          end: { dateTime: '2024-06-15T11:00:00Z' },
        },
      ];
      vi.mocked(mockService.listEvents).mockResolvedValue(mockResult);

      const result = await handlers.list_events({});

      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed[0].start.date).toBe('2024-06-15');
      expect(parsed[0].end.date).toBe('2024-06-16');
      expect(parsed[1].start.dateTime).toBe('2024-06-15T10:00:00Z');
      expect(parsed[1].end.dateTime).toBe('2024-06-15T11:00:00Z');
    });
  });

  describe('list_events pagination', () => {
    it('should return paginated results correctly', async () => {
      const mockResult = [
        { id: '1', summary: 'Event 1' },
        { id: '2', summary: 'Event 2' },
      ];
      vi.mocked(mockService.listEvents).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        maxResults: 2,
      };

      const result = await handlers.list_events(input);

      expect(mockService.listEvents).toHaveBeenCalledWith(
        'primary',
        undefined,
        undefined,
        2,
        undefined
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(2);
    });
  });

  describe('update_event', () => {
    it('should delegate with partial update body', async () => {
      const mockResult = {
        id: 'evt_123',
        summary: 'Updated Title',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      };
      vi.mocked(mockService.updateEvent).mockResolvedValue(mockResult);

      const input = {
        calendarId: 'primary',
        eventId: 'evt_123',
        summary: 'Updated Title',
      };

      const result = await handlers.update_event(input);

      expect(mockService.updateEvent).toHaveBeenCalledWith(
        'primary',
        'evt_123',
        {
          summary: 'Updated Title',
        }
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('get_event', () => {
    it('should delegate and return event details', async () => {
      const mockResult = {
        id: 'evt_456',
        summary: 'My Event',
        description: 'Event description',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      };
      vi.mocked(mockService.getEvent).mockResolvedValue(mockResult);

      const input = { calendarId: 'primary', eventId: 'evt_456' };
      const result = await handlers.get_event(input);

      expect(mockService.getEvent).toHaveBeenCalledWith('primary', 'evt_456');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('429 rate limit error', () => {
    it('should return formatted error with rate limit context', async () => {
      const error = createMockGaxiosError(
        429,
        'rateLimitExceeded',
        'User rate limit exceeded.'
      );
      vi.mocked(mockService.listEvents).mockRejectedValue(error);

      const result = await handlers.list_events({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('429');
      expect(result.content[0].text).toContain('Rate limit exceeded');
      expect(result.content[0].text).toContain('Please try again later');
    });
  });

  describe('500 server error', () => {
    it('should return formatted error when service throws 500', async () => {
      const error = createMockGaxiosError(
        500,
        'backendError',
        'Internal server error.'
      );
      vi.mocked(mockService.createEvent).mockRejectedValue(error);

      const input = {
        calendarId: 'primary',
        summary: 'New Event',
        start: { dateTime: '2024-06-15T10:00:00Z' },
        end: { dateTime: '2024-06-15T11:00:00Z' },
      };

      const result = await handlers.create_event(input);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('500');
      expect(result.content[0].text).toContain('backendError');
      expect(result.content[0].text).toContain('Internal server error');
    });
  });
});
