import { OAuth2Client } from 'google-auth-library';
import { GaxiosError } from 'gaxios';
import { createCalendarClient, withRetry, isGaxiosError } from './google-client.js';
import { channelStore } from '../webhooks/endpoint.js';
import {
  Schema$Event,
  Schema$CalendarListEntry,
  Schema$FreeBusyResponse,
  Schema$Channel,
  Params$Resource$Events$List,
  Params$Resource$Events$Get,
  Params$Resource$Events$Insert,
  Params$Resource$Events$Patch,
  Params$Resource$Events$Delete,
  Params$Resource$Events$Instances,
  Params$Resource$Freebusy$Query,
  Params$Resource$Calendarlist$List,
  Calendar,
} from '../types/calendar.js';

function formatGaxiosError(error: GaxiosError, context: string): never {
  const status = error.status ?? (error.response?.status as number | undefined);
  const message = error.message ?? 'Unknown error';

  switch (status) {
    case 400:
      throw new Error(`Invalid request in ${context}: ${message}`);
    case 401:
      throw new Error(`Authentication failed in ${context}: Please re-authenticate.`);
    case 403:
      throw new Error(
        `Permission denied in ${context}: Insufficient permissions for this operation.`
      );
    case 404:
      throw new Error(`Resource not found in ${context}: The requested item does not exist.`);
    case 409:
      throw new Error(`Conflict in ${context}: ${message}`);
    case 429:
      throw new Error(`Rate limit exceeded in ${context}: Please try again later.`);
    case 500:
    case 502:
    case 503:
      throw new Error(
        `Google Calendar service unavailable in ${context}: Please try again later.`
      );
    default:
      throw new Error(`Calendar API error in ${context}: ${message} (status ${status ?? 'unknown'})`);
  }
}

function wrapWithErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  oauth2Client: OAuth2Client
): Promise<T> {
  return withRetry(fn, oauth2Client).catch((error: unknown) => {
    if (isGaxiosError(error)) {
      formatGaxiosError(error as GaxiosError, context);
    }
    throw error;
  });
}

export class CalendarService {
  private oauth2Client: OAuth2Client;

  constructor(oauth2Client: OAuth2Client) {
    this.oauth2Client = oauth2Client;
  }

  private getClient(): Calendar {
    return createCalendarClient(this.oauth2Client);
  }

  private subscriptions = new Map<string, { resourceId: string; expiration?: string; token: string }>();

  async listEvents(
    calendarId: string = 'primary',
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 250,
    q?: string
  ): Promise<Schema$Event[]> {
    const client = this.getClient();
    const results: Schema$Event[] = [];
    let pageToken: string | undefined;
    const cap = Math.min(maxResults, 250);

    do {
      const params: Params$Resource$Events$List = {
        calendarId,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: Math.min(100, cap - results.length),
        pageToken,
      };

      if (timeMin) params.timeMin = timeMin;
      if (timeMax) params.timeMax = timeMax;
      if (q) params.q = q;

      const response = await wrapWithErrorHandling(
        () => client.events.list(params),
        'listEvents',
        this.oauth2Client
      );

      const items = (response.data.items ?? []).slice(0, cap - results.length);
      for (const event of items) {
        if (event.status !== 'cancelled') {
          results.push(event);
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken && results.length < cap);

    return results;
  }

  async searchEvents(
    calendarId: string = 'primary',
    q: string,
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 250
  ): Promise<Schema$Event[]> {
    const client = this.getClient();
    const results: Schema$Event[] = [];
    let pageToken: string | undefined;
    const cap = Math.min(maxResults, 250);

    do {
      const params: Params$Resource$Events$List = {
        calendarId,
        q,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: Math.min(100, cap - results.length),
        pageToken,
      };

      if (timeMin) params.timeMin = timeMin;
      if (timeMax) params.timeMax = timeMax;

      const response = await wrapWithErrorHandling(
        () => client.events.list(params),
        'searchEvents',
        this.oauth2Client
      );

      const items = (response.data.items ?? []).slice(0, cap - results.length);
      for (const event of items) {
        if (event.status !== 'cancelled') {
          results.push(event);
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken && results.length < cap);

    return results;
  }

  async getEvent(calendarId: string = 'primary', eventId: string): Promise<Schema$Event> {
    const client = this.getClient();

    const params: Params$Resource$Events$Get = {
      calendarId,
      eventId,
    };

    const response = await wrapWithErrorHandling(
      () => client.events.get(params),
      'getEvent',
      this.oauth2Client
    );

    return response.data;
  }

  async createEvent(
    calendarId: string = 'primary',
    event: Partial<Schema$Event>
  ): Promise<Schema$Event> {
    const client = this.getClient();

    const params: Params$Resource$Events$Insert = {
      calendarId,
      requestBody: event,
    };

    const response = await wrapWithErrorHandling(
      () => client.events.insert(params),
      'createEvent',
      this.oauth2Client
    );

    return response.data;
  }

  async updateEvent(
    calendarId: string = 'primary',
    eventId: string,
    event: Partial<Schema$Event>
  ): Promise<Schema$Event> {
    const client = this.getClient();

    const params: Params$Resource$Events$Patch = {
      calendarId,
      eventId,
      requestBody: event,
    };

    const response = await wrapWithErrorHandling(
      () => client.events.patch(params),
      'updateEvent',
      this.oauth2Client
    );

    return response.data;
  }

  async deleteEvent(calendarId: string = 'primary', eventId: string): Promise<void> {
    const client = this.getClient();

    const params: Params$Resource$Events$Delete = {
      calendarId,
      eventId,
    };

    await wrapWithErrorHandling(
      () => client.events.delete(params),
      'deleteEvent',
      this.oauth2Client
    );
  }

  async listCalendars(): Promise<Schema$CalendarListEntry[]> {
    const client = this.getClient();
    const results: Schema$CalendarListEntry[] = [];
    let pageToken: string | undefined;

    do {
      const params: Params$Resource$Calendarlist$List = {
        maxResults: 100,
        pageToken,
      };

      const response = await wrapWithErrorHandling(
        () => client.calendarList.list(params),
        'listCalendars',
        this.oauth2Client
      );

      const items = response.data.items ?? [];
      results.push(...items);
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return results;
  }

  async getCalendar(calendarId: string): Promise<Schema$CalendarListEntry> {
    const client = this.getClient();

    const response = await wrapWithErrorHandling(
      () => client.calendarList.get({ calendarId }),
      'getCalendar',
      this.oauth2Client
    );

    return response.data;
  }

  async queryFreeBusy(
    calendarIds: string[],
    timeMin: string,
    timeMax: string,
    timeZone: string = 'UTC'
  ): Promise<Schema$FreeBusyResponse> {
    if (calendarIds.length > 50) {
      throw new Error('Cannot query more than 50 calendars at once');
    }

    const client = this.getClient();

    const params: Params$Resource$Freebusy$Query = {
      requestBody: {
        timeMin,
        timeMax,
        timeZone,
        items: calendarIds.map((id) => ({ id })),
      },
    };

    const response = await wrapWithErrorHandling(
      () => client.freebusy.query(params),
      'queryFreeBusy',
      this.oauth2Client
    );

    return response.data;
  }

  async listEventInstances(
    calendarId: string = 'primary',
    eventId: string,
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 250
  ): Promise<Schema$Event[]> {
    const client = this.getClient();
    const results: Schema$Event[] = [];
    let pageToken: string | undefined;
    const cap = Math.min(maxResults, 250);

    do {
      const params: Params$Resource$Events$Instances = {
        calendarId,
        eventId,
        maxResults: Math.min(100, cap - results.length),
        pageToken,
      };

      if (timeMin) params.timeMin = timeMin;
      if (timeMax) params.timeMax = timeMax;

      const response = await wrapWithErrorHandling(
        () => client.events.instances(params),
        'listEventInstances',
        this.oauth2Client
      );

      const items = (response.data.items ?? []).slice(0, cap - results.length);
      results.push(...items);
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken && results.length < cap);

    return results;
  }

  async createRecurringEvent(
    calendarId: string = 'primary',
    event: Partial<Schema$Event>
  ): Promise<Schema$Event> {
    if (!event.recurrence || event.recurrence.length === 0) {
      throw new Error('Recurrence rules are required for recurring events');
    }

    return this.createEvent(calendarId, event);
  }

  async subscribeCalendar(
    calendarId: string = 'primary',
    webhookUrl: string
  ): Promise<Schema$Channel> {
    const client = this.getClient();
    const channelId = crypto.randomUUID();
    const channelToken = crypto.randomUUID();

    const response = await wrapWithErrorHandling(
      () =>
        client.events.watch({
          calendarId,
          requestBody: {
            id: channelId,
            type: 'web_hook',
            address: webhookUrl,
            token: channelToken,
          },
        }),
      'subscribeCalendar',
      this.oauth2Client
    );

    this.subscriptions.set(channelId, {
      resourceId: response.data.resourceId || '',
      expiration: response.data.expiration ?? undefined,
      token: channelToken,
    });

    channelStore.tokens.set(channelId, channelToken);

    return response.data;
  }

  async unsubscribeCalendar(channelId: string): Promise<void> {
    const client = this.getClient();
    const sub = this.subscriptions.get(channelId);

    await wrapWithErrorHandling(
      () =>
        client.channels.stop({
          requestBody: {
            id: channelId,
            resourceId: sub?.resourceId || '',
          },
        }),
      'unsubscribeCalendar',
      this.oauth2Client
    );

    this.subscriptions.delete(channelId);
    channelStore.tokens.delete(channelId);
  }

  getChannelToken(channelId: string): string | undefined {
    return this.subscriptions.get(channelId)?.token;
  }

  async listSubscriptions(): Promise<Schema$Channel[]> {
    return Array.from(this.subscriptions.entries()).map(([id, sub]) => ({
      id,
      resourceId: sub.resourceId,
      expiration: sub.expiration,
    }));
  }

  async getCurrentTime(): Promise<{ currentTime: string; timezone: string }> {
    return {
      currentTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}
