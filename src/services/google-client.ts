import { calendar, calendar_v3 } from '@googleapis/calendar';
import { OAuth2Client } from 'google-auth-library';
import { GaxiosError } from 'gaxios';

export function createCalendarClient(
  oauth2Client: OAuth2Client
): calendar_v3.Calendar {
  return calendar({ version: 'v3', auth: oauth2Client });
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function refreshToken(oauth2Client: OAuth2Client): Promise<void> {
  if (isRefreshing && refreshPromise) {
    await refreshPromise;
    return;
  }

  isRefreshing = true;
  refreshPromise = oauth2Client.refreshAccessToken().then(
    () => {
      isRefreshing = false;
    },
    (error) => {
      isRefreshing = false;
      throw error;
    }
  );

  await refreshPromise;
}

export function isGaxiosError(error: unknown): error is GaxiosError {
  return error instanceof GaxiosError;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  oauth2Client?: OAuth2Client
): Promise<T> {
  const maxRetries = 3;
  let lastError: unknown;
  let did401Retry = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isGaxiosError(error)) {
        throw error;
      }

      const status =
        error.status ?? (error.response?.status as number | undefined);

      if (status === 404) {
        throw error;
      }

      if (status === 401 && oauth2Client && !did401Retry) {
        did401Retry = true;
        await refreshToken(oauth2Client);
        continue;
      }

      if (status === 429 || status === 503) {
        if (attempt >= maxRetries) {
          throw error;
        }
        const delay = 100 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
