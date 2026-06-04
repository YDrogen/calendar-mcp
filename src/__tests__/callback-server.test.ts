import { describe, it, expect, afterEach } from 'vitest';
import { startCallbackServer } from '../auth/callback-server.js';

describe('callback-server', () => {
  let server: ReturnType<typeof startCallbackServer>;
  const TEST_PORT = 8765;

  afterEach(() => {
    server?.close();
  });

  describe('startCallbackServer', () => {
    it('should return url, waitForCode promise, and close function', () => {
      server = startCallbackServer(TEST_PORT);
      expect(server.url).toBe(`http://localhost:${TEST_PORT}/oauth2callback`);
      expect(server.waitForCode).toBeInstanceOf(Promise);
      expect(typeof server.close).toBe('function');
    });

    it('should resolve waitForCode when GET /oauth2callback receives code', async () => {
      server = startCallbackServer(TEST_PORT);
      const response = await fetch(`${server.url}?code=test-auth-code`);
      const code = await server.waitForCode;

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain('Authorization complete');
      expect(code).toBe('test-auth-code');
    });

    it('should reject waitForCode when no code is provided', async () => {
      server = startCallbackServer(TEST_PORT);
      const rejectionPromise = expect(server.waitForCode).rejects.toThrow('No authorization code provided');
      const response = await fetch(server.url);

      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toContain('Authorization failed');

      await rejectionPromise;
    });

    it('should close the server', () => {
      server = startCallbackServer(TEST_PORT);
      expect(() => server.close()).not.toThrow();
    });
  });
});