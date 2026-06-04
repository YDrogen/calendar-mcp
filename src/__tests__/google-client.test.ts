import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GaxiosError } from 'gaxios';
import {
  createCalendarClient,
  withRetry,
  isGaxiosError,
} from '../services/google-client';
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
  },
  freebusy: {
    query: vi.fn(),
  },
  calendarList: {
    list: vi.fn(),
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

describe('createCalendarClient', () => {
  it('should create a calendar client with OAuth2Client', () => {
    const oauth2Client = new OAuth2Client('clientId', 'clientSecret', 'redirectUri');
    const client = createCalendarClient(oauth2Client);
    expect(client).toBeDefined();
  });
});

describe('isGaxiosError', () => {
  it('should return true for GaxiosError instances', () => {
    const error = createMockGaxiosError(404);
    expect(isGaxiosError(error)).toBe(true);
  });

  it('should return false for regular Error instances', () => {
    expect(isGaxiosError(new Error('regular'))).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isGaxiosError('string')).toBe(false);
    expect(isGaxiosError(null)).toBe(false);
    expect(isGaxiosError(undefined)).toBe(false);
    expect(isGaxiosError({})).toBe(false);
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should return result on success without retries', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry 3 times on 429 with increasing delays', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(createMockGaxiosError(429))
      .mockRejectedValueOnce(createMockGaxiosError(429))
      .mockRejectedValueOnce(createMockGaxiosError(429))
      .mockResolvedValue('success');

    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(100 + 200 + 400);
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('should fail after 3 retries on 429', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject(createMockGaxiosError(429)));

    let caught: unknown;
    const promise = withRetry(fn).catch((e) => {
      caught = e;
    });
    await vi.advanceTimersByTimeAsync(100 + 200 + 400 + 800);
    await promise;

    expect(caught).toBeInstanceOf(GaxiosError);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('should refresh token on 401 then retry once', async () => {
    const oauth2Client = new OAuth2Client('clientId', 'clientSecret', 'redirectUri');
    const refreshSpy = vi
      .spyOn(oauth2Client, 'refreshAccessToken')
      .mockResolvedValue({ credentials: {}, res: null });

    const fn = vi
      .fn()
      .mockRejectedValueOnce(createMockGaxiosError(401))
      .mockResolvedValue('success');

    const result = await withRetry(fn, oauth2Client);

    expect(result).toBe('success');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should fail on 404 without retry', async () => {
    const fn = vi.fn().mockRejectedValue(createMockGaxiosError(404));

    await expect(withRetry(fn)).rejects.toBeInstanceOf(GaxiosError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should only refresh token once for 3 concurrent 401 calls', async () => {
    const oauth2Client = new OAuth2Client('clientId', 'clientSecret', 'redirectUri');
    let refreshCount = 0;

    vi.spyOn(oauth2Client, 'refreshAccessToken').mockImplementation(async () => {
      refreshCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { credentials: {}, res: null };
    });

    const fn = vi.fn().mockRejectedValue(createMockGaxiosError(401));

    const promise1 = withRetry(fn, oauth2Client);
    const promise2 = withRetry(fn, oauth2Client);
    const promise3 = withRetry(fn, oauth2Client);

    await expect(Promise.all([promise1, promise2, promise3])).rejects.toBeInstanceOf(
      GaxiosError
    );

    expect(refreshCount).toBe(1);
  });

  it('should retry on 503 with exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(createMockGaxiosError(503))
      .mockRejectedValueOnce(createMockGaxiosError(503))
      .mockResolvedValue('success');

    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(100 + 200);
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
