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

describe('Webhook Tool Handlers', () => {
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

  describe('subscribe_calendar', () => {
    it('should delegate to subscribeCalendar with calendarId and webhookUrl and return channel info', async () => {
      const mockResult = {
        id: 'channel-123',
        resourceId: 'res-123',
        expiration: '1234567890000',
      };
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
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
    });
  });

  describe('unsubscribe_calendar', () => {
    it('should delegate to unsubscribeCalendar with channelId', async () => {
      vi.mocked(mockService.unsubscribeCalendar).mockResolvedValue(undefined);

      const input = { channelId: 'channel-456' };
      const result = await handlers.unsubscribe_calendar(input);

      expect(mockService.unsubscribeCalendar).toHaveBeenCalledWith('channel-456');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(undefined));
    });
  });

  describe('list_subscriptions', () => {
    it('should delegate to listSubscriptions and return array of active subscriptions', async () => {
      const mockResult = [
        { id: 'channel-1', resourceId: 'res-1', expiration: '1000' },
        { id: 'channel-2', resourceId: 'res-2', expiration: '2000' },
      ];
      vi.mocked(mockService.listSubscriptions).mockResolvedValue(mockResult);

      const result = await handlers.list_subscriptions({});

      expect(mockService.listSubscriptions).toHaveBeenCalledWith();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(mockResult));
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].resourceId).toBe('res-1');
      expect(parsed[1].resourceId).toBe('res-2');
    });
  });

  describe('subscribe_calendar error', () => {
    it('should return isError true with formatted message when service throws error', async () => {
      const error = new Error('Webhook subscription failed');
      vi.mocked(mockService.subscribeCalendar).mockRejectedValue(error);

      const input = {
        calendarId: 'primary',
        webhookUrl: 'https://example.com/webhook',
      };
      const result = await handlers.subscribe_calendar(input);

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Error: Webhook subscription failed');
    });
  });

  describe('unsubscribe_calendar not found', () => {
    it('should return formatted not found error when service throws 404', async () => {
      const error = createMockGaxiosError(
        404,
        'notFound',
        'The requested channel was not found.'
      );
      vi.mocked(mockService.unsubscribeCalendar).mockRejectedValue(error);

      const input = { channelId: 'missing-channel' };
      const result = await handlers.unsubscribe_calendar(input);

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('404');
      expect(result.content[0].text).toContain('not found');
    });
  });
});
