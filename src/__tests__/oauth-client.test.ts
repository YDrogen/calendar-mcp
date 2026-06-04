import { describe, it, expect, vi } from 'vitest';
import {
  createOAuthClient,
  getAuthUrl,
  handleCallback,
  onTokenRefresh,
} from '../auth/oauth-client.js';
import { OAuth2Client } from 'google-auth-library';

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(function () {
    return {
      generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?scope=calendar'),
      getToken: vi.fn().mockResolvedValue({
        tokens: { access_token: 'mock-access-token', refresh_token: 'mock-refresh-token' },
      }),
      setCredentials: vi.fn(),
      on: vi.fn(),
    };
  }),
}));

describe('oauth-client', () => {
  describe('createOAuthClient', () => {
    it('should create an OAuth2Client with provided options', () => {
      const client = createOAuthClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/oauth2callback',
      });

      expect(client).toBeDefined();
      expect(OAuth2Client).toHaveBeenCalledWith(
        'test-client-id',
        'test-client-secret',
        'http://localhost:3000/oauth2callback'
      );
    });
  });

  describe('getAuthUrl', () => {
    it('should generate auth URL with correct parameters', () => {
      const client = createOAuthClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/oauth2callback',
      });

      const url = getAuthUrl(client);
      expect(url).toBe('https://accounts.google.com/o/oauth2/auth?scope=calendar');
      expect(client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/tasks',
        ],
      });
    });
  });

  describe('handleCallback', () => {
    it('should exchange code for tokens and set credentials', async () => {
      const client = createOAuthClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/oauth2callback',
      });

      await handleCallback(client, 'test-auth-code');
      expect(client.getToken).toHaveBeenCalledWith('test-auth-code');
      expect(client.setCredentials).toHaveBeenCalledWith({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      });
    });
  });

  describe('onTokenRefresh', () => {
    it('should register a callback for token events', () => {
      const client = createOAuthClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/oauth2callback',
      });

      const callback = vi.fn();
      onTokenRefresh(client, callback);
      expect(client.on).toHaveBeenCalledWith('tokens', callback);
    });
  });
});
