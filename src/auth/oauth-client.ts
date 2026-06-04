import { OAuth2Client } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
];

export interface CreateOAuthClientOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function createOAuthClient(options: CreateOAuthClientOptions): OAuth2Client {
  return new OAuth2Client(options.clientId, options.clientSecret, options.redirectUri);
}

export function getAuthUrl(oauth2Client: OAuth2Client): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

export async function handleCallback(
  oauth2Client: OAuth2Client,
  code: string
): Promise<void> {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
}

export function onTokenRefresh(
  oauth2Client: OAuth2Client,
  callback: (tokens: import('google-auth-library').Credentials) => void
): void {
  oauth2Client.on('tokens', callback);
}
