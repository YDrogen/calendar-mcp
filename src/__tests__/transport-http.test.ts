import { describe, it, expect, vi, afterEach } from 'vitest';
import http from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createHttpServer } from '../transport/http.js';
import { AllToolDefinitions } from '../tools/definitions.js';

describe('HTTP Transport Server', () => {
  const mockHandlers = Object.fromEntries(
    AllToolDefinitions.map((def) => [
      def.name,
      async () => ({ content: [{ type: 'text' as const, text: 'test' }] }),
    ])
  );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create McpServer instance', () => {
    const { server } = createHttpServer(mockHandlers);
    expect(server).toBeInstanceOf(McpServer);
    expect(server).toBeDefined();
  });

  it('should register all tools on server', () => {
    const spy = vi.spyOn(McpServer.prototype, 'registerTool').mockImplementation(() => {});
    createHttpServer(mockHandlers);
    expect(spy).toHaveBeenCalledTimes(AllToolDefinitions.length);
    spy.mockRestore();
  });

  it('should create independent instances', () => {
    const { server: server1 } = createHttpServer(mockHandlers);
    const { server: server2 } = createHttpServer(mockHandlers);
    expect(server1).not.toBe(server2);
    expect(server1).toBeInstanceOf(McpServer);
    expect(server2).toBeInstanceOf(McpServer);
  });

  it('should return app, start and stop functions', () => {
    const { app, start, stop } = createHttpServer(mockHandlers);
    expect(app).toBeDefined();
    expect(typeof start).toBe('function');
    expect(typeof stop).toBe('function');
  });

  it('should respond to health check', async () => {
    const { app } = createHttpServer(mockHandlers);
    const server = http.createServer(app);

    return new Promise<void>((resolve, reject) => {
      server.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        try {
          const response = await fetch(`http://localhost:${port}/health`);
          expect(response.status).toBe(200);
          const body = await response.json();
          expect(body).toEqual({ status: 'ok' });
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          server.close();
        }
      });
    });
  });

  it('should reject requests with invalid Host header', async () => {
    const { app } = createHttpServer(mockHandlers);
    const server = http.createServer(app);

    return new Promise<void>((resolve, reject) => {
      server.listen(0, () => {
        const port = (server.address() as { port: number }).port;
        const req = http.request(
          {
            hostname: 'localhost',
            port,
            path: '/health',
            headers: { Host: 'evil.com' },
          },
          (res) => {
            try {
              expect(res.statusCode).toBe(403);
              resolve();
            } catch (error) {
              reject(error);
            } finally {
              server.close();
            }
          }
        );
        req.on('error', (err) => {
          server.close();
          reject(err);
        });
        req.end();
      });
    });
  });

  it('should set CORS headers', async () => {
    const { app } = createHttpServer(mockHandlers);
    const server = http.createServer(app);

    return new Promise<void>((resolve, reject) => {
      server.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        try {
          const response = await fetch(`http://localhost:${port}/health`, {
            method: 'OPTIONS',
          });
          expect(response.status).toBe(200);
          expect(response.headers.get('access-control-allow-origin')).toBe('*');
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          server.close();
        }
      });
    });
  });
});
