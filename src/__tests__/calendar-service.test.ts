import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GaxiosError } from 'gaxios';
import { CalendarService } from '../services/calendar-service';
import { OAuth2Client } from 'google-auth-library';

const createMockGaxiosError = (status: number): GaxiosError => {
  const response = {
    status,
    statusText: status === 429 ? 'Too Many Requests' : 'Error',
    data: undefined,
    headers: new Headers(),
    config: {},
  };
  const error = new GaxiosError(
    `HTTP ${status}`,
    { url: 'https://example.com' } as unknown as ConstructorParameters<
      typeof GaxiosError
    >[1],
    response as unknown as ConstructorParameters<typeof GaxiosError>[2]
  );
  (error as unknown as { status: number }).status = status;
  return error;
};

const createMockCalendarClient = () => ({
  events: {
    list: vi.fn(),
    get: vi.fn(),
    insert: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    instances: vi.fn(),
    watch: vi.fn(),
  },
  freebusy: {
    query: vi.fn(),
  },
  calendarList: {
    list: vi.fn(),
    get: vi.fn(),
  },
  channels: {
    stop: vi.fn(),
  },
});

vi.mock('@googleapis/calendar', async () => {
  const actual = await vi.importActual<typeof import('@googleapis/calendar')>('@googleapis/calendar');
  return {
    ...actual,
    calendar: vi.fn(() => createMockCalendarClient()),
  };
});

describe('CalendarService', () => {
  let service: CalendarService;
  let oauth2Client: OAuth2Client;
  let mockClient: ReturnType<typeof createMockCalendarClient>;

  beforeEach(async () => {
    oauth2Client = new OAuth2Client('clientId', 'clientSecret', 'redirectUri');
    oauth2Client.setCredentials({ refresh_token: 'mock-refresh-token' });
    service = new CalendarService(oauth2Client);
    mockClient = createMockCalendarClient();
    const { calendar } = await import('@googleapis/calendar');
    vi.mocked(calendar).mockReturnValue(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listEvents', () => {
    it('should list events with default calendarId', async () => {
      mockClient.events.list.mockResolvedValue({
        data: {
          items: [
            { id: '1', summary: 'Event 1', status: 'confirmed' },
            { id: '2', summary: 'Event 2', status: 'confirmed' },
          ],
        },
      });

      const events = await service.listEvents();

      expect(events).toHaveLength(2);
      expect(mockClient.events.list).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'primary' })
      );
    });

    it('should filter out cancelled events', async () => {
      mockClient.events.list.mockResolvedValue({
        data: {
          items: [
            { id: '1', summary: 'Active', status: 'confirmed' },
            { id: '2', summary: 'Cancelled', status: 'cancelled' },
            { id: '3', summary: 'Also Active', status: 'confirmed' },
          ],
        },
      });

      const events = await service.listEvents();

      expect(events).toHaveLength(2);
      expect(events.some((e) => e.id === '2')).toBe(false);
    });

    it('should auto-paginate with pageToken', async () => {
      mockClient.events.list
        .mockResolvedValueOnce({
          data: {
            items: [{ id: '1', summary: 'Page 1', status: 'confirmed' }],
            nextPageToken: 'token1',
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [{ id: '2', summary: 'Page 2', status: 'confirmed' }],
          },
        });

      const events = await service.listEvents();

      expect(events).toHaveLength(2);
      expect(mockClient.events.list).toHaveBeenCalledTimes(2);
      expect(mockClient.events.list).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ pageToken: 'token1' })
      );
    });

    it('should cap results at 250', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        summary: `Event ${i}`,
        status: 'confirmed',
      }));

      mockClient.events.list
        .mockResolvedValueOnce({
          data: { items, nextPageToken: 'token1' },
        })
        .mockResolvedValueOnce({
          data: { items, nextPageToken: 'token2' },
        })
        .mockResolvedValueOnce({
          data: { items, nextPageToken: 'token3' },
        });

      const events = await service.listEvents('primary', undefined, undefined, 250);

      expect(events.length).toBeLessThanOrEqual(250);
    });

    it('should pass timeMin and timeMax', async () => {
      mockClient.events.list.mockResolvedValue({ data: { items: [] } });

      await service.listEvents('primary', '2024-01-01T00:00:00Z', '2024-01-31T23:59:59Z');

      expect(mockClient.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          timeMin: '2024-01-01T00:00:00Z',
          timeMax: '2024-01-31T23:59:59Z',
        })
      );
    });

    it('should use singleEvents and orderBy startTime', async () => {
      mockClient.events.list.mockResolvedValue({ data: { items: [] } });

      await service.listEvents();

      expect(mockClient.events.list).toHaveBeenCalledWith(
        expect.objectContaining({
          singleEvents: true,
          orderBy: 'startTime',
        })
      );
    });
  });

  describe('getEvent', () => {
    it('should get event with default calendarId', async () => {
      mockClient.events.get.mockResolvedValue({
        data: { id: 'evt1', summary: 'My Event' },
      });

      const event = await service.getEvent(undefined as unknown as string, 'evt1');

      expect(event.id).toBe('evt1');
      expect(mockClient.events.get).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'primary', eventId: 'evt1' })
      );
    });

    it('should get event with custom calendarId', async () => {
      mockClient.events.get.mockResolvedValue({
        data: { id: 'evt1', summary: 'My Event' },
      });

      await service.getEvent('custom@cal.com', 'evt1');

      expect(mockClient.events.get).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'custom@cal.com', eventId: 'evt1' })
      );
    });
  });

  describe('createEvent', () => {
    it('should create event with default calendarId', async () => {
      const newEvent = { summary: 'New Event', start: { dateTime: '2024-01-01T10:00:00Z' }, end: { dateTime: '2024-01-01T11:00:00Z' } };
      mockClient.events.insert.mockResolvedValue({ data: { id: 'new1', ...newEvent } });

      const event = await service.createEvent(undefined as unknown as string, newEvent);

      expect(event.summary).toBe('New Event');
      expect(mockClient.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'primary', requestBody: newEvent })
      );
    });

    it('should create all-day event with date format', async () => {
      const newEvent = { summary: 'All Day', start: { date: '2024-01-01' }, end: { date: '2024-01-02' } };
      mockClient.events.insert.mockResolvedValue({ data: { id: 'all1', ...newEvent } });

      const event = await service.createEvent('primary', newEvent);

      expect(event.start?.date).toBe('2024-01-01');
      expect(event.end?.date).toBe('2024-01-02');
    });

    it('should create timed event with dateTime format', async () => {
      const newEvent = { summary: 'Timed', start: { dateTime: '2024-01-01T10:00:00Z' }, end: { dateTime: '2024-01-01T11:00:00Z' } };
      mockClient.events.insert.mockResolvedValue({ data: { id: 'timed1', ...newEvent } });

      const event = await service.createEvent('primary', newEvent);

      expect(event.start?.dateTime).toBe('2024-01-01T10:00:00Z');
      expect(event.end?.dateTime).toBe('2024-01-01T11:00:00Z');
    });
  });

  describe('updateEvent', () => {
    it('should patch event with default calendarId', async () => {
      const updates = { summary: 'Updated' };
      mockClient.events.patch.mockResolvedValue({ data: { id: 'evt1', summary: 'Updated' } });

      const event = await service.updateEvent(undefined as unknown as string, 'evt1', updates);

      expect(event.summary).toBe('Updated');
      expect(mockClient.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'primary', eventId: 'evt1', requestBody: updates })
      );
    });

    it('should support partial updates', async () => {
      const updates = { summary: 'New Title' };
      mockClient.events.patch.mockResolvedValue({ data: { id: 'evt1', summary: 'New Title' } });

      await service.updateEvent('primary', 'evt1', updates);

      expect(mockClient.events.patch).toHaveBeenCalledWith(
        expect.objectContaining({ requestBody: updates })
      );
    });
  });

  describe('deleteEvent', () => {
    it('should delete event with default calendarId', async () => {
      mockClient.events.delete.mockResolvedValue({ data: {} });

      await service.deleteEvent(undefined as unknown as string, 'evt1');

      expect(mockClient.events.delete).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'primary', eventId: 'evt1' })
      );
    });

    it('should delete event with custom calendarId', async () => {
      mockClient.events.delete.mockResolvedValue({ data: {} });

      await service.deleteEvent('custom@cal.com', 'evt1');

      expect(mockClient.events.delete).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'custom@cal.com', eventId: 'evt1' })
      );
    });
  });

  describe('listCalendars', () => {
    it('should list calendars with pagination', async () => {
      mockClient.calendarList.list
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 'cal1', summary: 'Calendar 1' }],
            nextPageToken: 'token1',
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 'cal2', summary: 'Calendar 2' }],
          },
        });

      const calendars = await service.listCalendars();

      expect(calendars).toHaveLength(2);
      expect(mockClient.calendarList.list).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCalendar', () => {
    it('should get calendar by id', async () => {
      mockClient.calendarList.get.mockResolvedValue({
        data: { id: 'cal1', summary: 'Work' },
      });

      const calendar = await service.getCalendar('cal1');

      expect(calendar.id).toBe('cal1');
      expect(mockClient.calendarList.get).toHaveBeenCalledWith({ calendarId: 'cal1' });
    });
  });

  describe('queryFreeBusy', () => {
    it('should query freebusy for multiple calendars', async () => {
      const response = {
        data: {
          calendars: {
            'cal1': { busy: [{ start: '2024-01-01T10:00:00Z', end: '2024-01-01T11:00:00Z' }] },
          },
        },
      };
      mockClient.freebusy.query.mockResolvedValue(response);

      const result = await service.queryFreeBusy(
        ['cal1', 'cal2'],
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z'
      );

      expect(result.calendars).toBeDefined();
      expect(mockClient.freebusy.query).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            timeMin: '2024-01-01T00:00:00Z',
            timeMax: '2024-01-02T00:00:00Z',
            timeZone: 'UTC',
            items: [{ id: 'cal1' }, { id: 'cal2' }],
          }),
        })
      );
    });

    it('should throw for more than 50 calendar IDs', async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `cal${i}`);
      await expect(service.queryFreeBusy(ids, '2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z')).rejects.toThrow(
        'Cannot query more than 50 calendars at once'
      );
    });

    it('should use custom timezone', async () => {
      mockClient.freebusy.query.mockResolvedValue({ data: {} });

      await service.queryFreeBusy(['cal1'], '2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z', 'America/New_York');

      expect(mockClient.freebusy.query).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ timeZone: 'America/New_York' }),
        })
      );
    });
  });

  describe('listEventInstances', () => {
    it('should list instances with pagination', async () => {
      mockClient.events.instances
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 'inst1', summary: 'Instance 1' }],
            nextPageToken: 'token1',
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [{ id: 'inst2', summary: 'Instance 2' }],
          },
        });

      const instances = await service.listEventInstances('primary', 'rec1');

      expect(instances).toHaveLength(2);
      expect(mockClient.events.instances).toHaveBeenCalledTimes(2);
    });

    it('should cap at 250 results', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `inst${i}`,
        summary: `Instance ${i}`,
      }));

      mockClient.events.instances
        .mockResolvedValueOnce({
          data: { items, nextPageToken: 'token1' },
        })
        .mockResolvedValueOnce({
          data: { items, nextPageToken: 'token2' },
        })
        .mockResolvedValueOnce({
          data: { items, nextPageToken: 'token3' },
        });

      const instances = await service.listEventInstances('primary', 'rec1');

      expect(instances.length).toBeLessThanOrEqual(250);
    });
  });

  describe('createRecurringEvent', () => {
    it('should create event with recurrence', async () => {
      const event = {
        summary: 'Weekly Meeting',
        start: { dateTime: '2024-01-01T10:00:00Z' },
        end: { dateTime: '2024-01-01T11:00:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
      };
      mockClient.events.insert.mockResolvedValue({ data: { id: 'rec1', ...event } });

      const result = await service.createRecurringEvent('primary', event);

      expect(result.recurrence).toEqual(['RRULE:FREQ=WEEKLY;COUNT=10']);
      expect(mockClient.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({ requestBody: event })
      );
    });

    it('should throw if recurrence is missing', async () => {
      const event = { summary: 'No Recurrence', start: { dateTime: '2024-01-01T10:00:00Z' }, end: { dateTime: '2024-01-01T11:00:00Z' } };

      await expect(service.createRecurringEvent('primary', event)).rejects.toThrow(
        'Recurrence rules are required for recurring events'
      );
    });

    it('should throw if recurrence is empty', async () => {
      const event = { summary: 'Empty Recurrence', start: { dateTime: '2024-01-01T10:00:00Z' }, end: { dateTime: '2024-01-01T11:00:00Z' }, recurrence: [] };

      await expect(service.createRecurringEvent('primary', event)).rejects.toThrow(
        'Recurrence rules are required for recurring events'
      );
    });
  });

  describe('searchEvents', () => {
    it('should search events with query', async () => {
      mockClient.events.list.mockResolvedValue({
        data: {
          items: [{ id: '1', summary: 'Meeting with Bob' }],
        },
      });

      const events = await service.searchEvents('primary', 'Bob');

      expect(events).toHaveLength(1);
      expect(mockClient.events.list).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'Bob' })
      );
    });

    it('should auto-paginate search results', async () => {
      mockClient.events.list
        .mockResolvedValueOnce({
          data: {
            items: [{ id: '1', summary: 'Result 1', status: 'confirmed' }],
            nextPageToken: 'token1',
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [{ id: '2', summary: 'Result 2', status: 'confirmed' }],
          },
        });

      const events = await service.searchEvents('primary', 'query');

      expect(events).toHaveLength(2);
      expect(mockClient.events.list).toHaveBeenCalledTimes(2);
    });

    it('should filter cancelled events in search', async () => {
      mockClient.events.list.mockResolvedValue({
        data: {
          items: [
            { id: '1', summary: 'Active', status: 'confirmed' },
            { id: '2', summary: 'Cancelled', status: 'cancelled' },
          ],
        },
      });

      const events = await service.searchEvents('primary', 'query');

      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe('Active');
    });
  });

  describe('subscribeCalendar', () => {
    it('should subscribe to calendar with generated channelId and token', async () => {
      mockClient.events.watch.mockResolvedValue({
        data: {
          id: 'channel-123',
          resourceId: 'res-123',
          expiration: '1234567890000',
        },
      });

      const result = await service.subscribeCalendar('primary', 'https://example.com/webhook');

      expect(result.id).toBe('channel-123');
      expect(result.resourceId).toBe('res-123');
      expect(mockClient.events.watch).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'primary',
          requestBody: expect.objectContaining({
            type: 'web_hook',
            address: 'https://example.com/webhook',
            token: expect.any(String),
          }),
        })
      );
    });

    it('should store subscription metadata locally', async () => {
      mockClient.events.watch.mockResolvedValue({
        data: {
          id: 'channel-456',
          resourceId: 'res-456',
          expiration: '1234567890000',
        },
      });

      await service.subscribeCalendar('primary', 'https://example.com/webhook');

      const subs = await service.listSubscriptions();
      expect(subs).toHaveLength(1);
      expect(subs[0].resourceId).toBe('res-456');
      expect(subs[0].expiration).toBe('1234567890000');
    });
  });

  describe('unsubscribeCalendar', () => {
    it('should unsubscribe using stored resourceId', async () => {
      const randomUUIDSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('channel-789');
      mockClient.events.watch.mockResolvedValue({
        data: {
          id: 'channel-789',
          resourceId: 'res-789',
          expiration: '1234567890000',
        },
      });
      mockClient.channels.stop.mockResolvedValue({ data: {} });

      await service.subscribeCalendar('primary', 'https://example.com/webhook');
      await service.unsubscribeCalendar('channel-789');

      expect(mockClient.channels.stop).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            id: 'channel-789',
            resourceId: 'res-789',
          }),
        })
      );
      randomUUIDSpy.mockRestore();
    });

    it('should remove subscription from local store', async () => {
      const randomUUIDSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('channel-abc');
      mockClient.events.watch.mockResolvedValue({
        data: {
          id: 'channel-abc',
          resourceId: 'res-abc',
          expiration: '1234567890000',
        },
      });
      mockClient.channels.stop.mockResolvedValue({ data: {} });

      await service.subscribeCalendar('primary', 'https://example.com/webhook');
      expect(await service.listSubscriptions()).toHaveLength(1);

      await service.unsubscribeCalendar('channel-abc');
      expect(await service.listSubscriptions()).toHaveLength(0);
      randomUUIDSpy.mockRestore();
    });
  });

  describe('listSubscriptions', () => {
    it('should return empty array when no subscriptions', async () => {
      const subs = await service.listSubscriptions();
      expect(subs).toEqual([]);
    });

    it('should return multiple subscriptions', async () => {
      mockClient.events.watch
        .mockResolvedValueOnce({
          data: { id: 'ch1', resourceId: 'res1', expiration: '1000' },
        })
        .mockResolvedValueOnce({
          data: { id: 'ch2', resourceId: 'res2', expiration: '2000' },
        });

      await service.subscribeCalendar('primary', 'https://example.com/webhook1');
      await service.subscribeCalendar('primary', 'https://example.com/webhook2');

      const subs = await service.listSubscriptions();
      expect(subs).toHaveLength(2);
      expect(subs[0].resourceId).toBe('res1');
      expect(subs[1].resourceId).toBe('res2');
    });
  });

  describe('error handling', () => {
    it('should throw user-friendly message on 404', async () => {
      mockClient.events.get.mockRejectedValue(createMockGaxiosError(404));

      await expect(service.getEvent('primary', 'missing')).rejects.toThrow(
        'Resource not found'
      );
    });

    it('should throw user-friendly message on 401', async () => {
      const refreshSpy = vi
        .spyOn(oauth2Client, 'refreshAccessToken')
        .mockResolvedValue({ credentials: {}, res: null });

      mockClient.events.list
        .mockRejectedValueOnce(createMockGaxiosError(401))
        .mockRejectedValueOnce(createMockGaxiosError(401));

      await expect(service.listEvents()).rejects.toThrow('Authentication failed');
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw user-friendly message on 429', async () => {
      mockClient.events.list.mockRejectedValue(createMockGaxiosError(429));

      await expect(service.listEvents()).rejects.toThrow('Rate limit exceeded');
    });

    it('should throw user-friendly message on 403', async () => {
      mockClient.events.insert.mockRejectedValue(createMockGaxiosError(403));

      await expect(service.createEvent('primary', { summary: 'Test' })).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should throw user-friendly message on 500', async () => {
      mockClient.events.delete.mockRejectedValue(createMockGaxiosError(500));

      await expect(service.deleteEvent('primary', 'evt1')).rejects.toThrow(
        'Google Calendar service unavailable'
      );
    });

    it('should retry on 429 then succeed', async () => {
      mockClient.events.list
        .mockRejectedValueOnce(createMockGaxiosError(429))
        .mockResolvedValueOnce({
          data: { items: [{ id: '1', summary: 'Event', status: 'confirmed' }] },
        });

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const promise = service.listEvents();
      await vi.advanceTimersByTimeAsync(100);
      const events = await promise;
      vi.useRealTimers();

      expect(events).toHaveLength(1);
      expect(mockClient.events.list).toHaveBeenCalledTimes(2);
    });
  });
});
