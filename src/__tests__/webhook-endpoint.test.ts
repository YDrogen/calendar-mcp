import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'http';
import express from 'express';
import { createWebhookEndpoint, channelStore } from '../webhooks/endpoint.js';

describe('Webhook Endpoint', () => {
  const createApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/webhooks', createWebhookEndpoint(channelStore));
    return app;
  };

  beforeEach(() => {
    channelStore.tokens.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    channelStore.tokens.clear();
  });

  it('should return 200 for valid push notification', async () => {
    channelStore.tokens.set('channel-123', 'token-abc');

    const app = createApp();
    const server = http.createServer(app);

    return new Promise<void>((resolve, reject) => {
      server.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        try {
          const response = await fetch(`http://localhost:${port}/webhooks/google-calendar`, {
            method: 'POST',
            headers: {
              'X-Goog-Channel-ID': 'channel-123',
              'X-Goog-Channel-Token': 'token-abc',
              'X-Goog-Resource-State': 'exists',
              'X-Goog-Resource-ID': 'resource-456',
              'X-Goog-Message-Number': '1',
            },
          });
          expect(response.status).toBe(200);
          const text = await response.text();
          expect(text).toBe('OK');
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          server.close();
        }
      });
    });
  });

  it('should return 403 for invalid token', async () => {
    channelStore.tokens.set('channel-123', 'token-abc');

    const app = createApp();
    const server = http.createServer(app);

    return new Promise<void>((resolve, reject) => {
      server.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        try {
          const response = await fetch(`http://localhost:${port}/webhooks/google-calendar`, {
            method: 'POST',
            headers: {
              'X-Goog-Channel-ID': 'channel-123',
              'X-Goog-Channel-Token': 'wrong-token',
              'X-Goog-Resource-State': 'exists',
            },
          });
          expect(response.status).toBe(403);
          const text = await response.text();
          expect(text).toBe('Invalid channel token');
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          server.close();
        }
      });
    });
  });

  it('should return 400 for missing headers', async () => {
    const app = createApp();
    const server = http.createServer(app);

    return new Promise<void>((resolve, reject) => {
      server.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        try {
          const response = await fetch(`http://localhost:${port}/webhooks/google-calendar`, {
            method: 'POST',
            headers: {
              'X-Goog-Channel-ID': 'channel-123',
            },
          });
          expect(response.status).toBe(400);
          const text = await response.text();
          expect(text).toBe('Missing required headers');
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          server.close();
        }
      });
    });
  });

  it('should return 200 with sync acknowledgment for sync state', async () => {
    channelStore.tokens.set('channel-123', 'token-abc');

    const app = createApp();
    const server = http.createServer(app);

    return new Promise<void>((resolve, reject) => {
      server.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        try {
          const response = await fetch(`http://localhost:${port}/webhooks/google-calendar`, {
            method: 'POST',
            headers: {
              'X-Goog-Channel-ID': 'channel-123',
              'X-Goog-Channel-Token': 'token-abc',
              'X-Goog-Resource-State': 'sync',
            },
          });
          expect(response.status).toBe(200);
          const text = await response.text();
          expect(text).toBe('Sync acknowledged');
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          server.close();
        }
      });
    });
  });

  it('should log and return 200 for valid notification with resource state exists', async () => {
    channelStore.tokens.set('channel-123', 'token-abc');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const app = createApp();
    const server = http.createServer(app);

    return new Promise<void>((resolve, reject) => {
      server.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        try {
          const response = await fetch(`http://localhost:${port}/webhooks/google-calendar`, {
            method: 'POST',
            headers: {
              'X-Goog-Channel-ID': 'channel-123',
              'X-Goog-Channel-Token': 'token-abc',
              'X-Goog-Resource-State': 'exists',
              'X-Goog-Resource-ID': 'resource-789',
              'X-Goog-Message-Number': '42',
            },
          });
          expect(response.status).toBe(200);
          const text = await response.text();
          expect(text).toBe('OK');
          expect(consoleSpy).toHaveBeenCalledWith(
            '[Webhook] Calendar change notification: channel=channel-123, resource=resource-789, state=exists, message=42'
          );
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          consoleSpy.mockRestore();
          server.close();
        }
      });
    });
  });
});
