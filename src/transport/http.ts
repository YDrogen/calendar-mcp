import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { registerToolsOnServer } from './shared.js';
import { ToolHandler } from '../types/mcp.js';
import { createWebhookEndpoint, channelStore } from '../webhooks/endpoint.js';

export function createHttpServer(
  handlers: { [name: string]: ToolHandler },
  port?: number
) {
  const server = new McpServer({
    name: 'calendar-mcp-http',
    version: '1.0.0',
  });

  registerToolsOnServer(server, handlers);

  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.use((req, res, next) => {
    const host = req.headers.host;
    if (!host) {
      res.status(403).send('Invalid Host header');
      return;
    }
    const hostWithoutPort = host.split(':')[0];
    const allowedHosts = ['localhost', '127.0.0.1', '::1'];
    if (!allowedHosts.includes(hostWithoutPort)) {
      res.status(403).send('Invalid Host header');
      return;
    }
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/webhooks', createWebhookEndpoint(channelStore));

  const transports: Record<string, SSEServerTransport> = {};

  app.get('/mcp', async (req, res) => {
    try {
      const transport = new SSEServerTransport('/messages', res, {
        enableDnsRebindingProtection: true,
        allowedHosts: ['localhost', '127.0.0.1', '::1'],
      });
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;
      transport.onclose = () => {
        delete transports[sessionId];
      };
      await server.connect(transport);
    } catch {
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).send('Missing sessionId parameter');
      return;
    }
    const transport = transports[sessionId];
    if (!transport) {
      res.status(404).send('Session not found');
      return;
    }
    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch {
      if (!res.headersSent) {
        res.status(500).send('Error handling request');
      }
    }
  });

  const httpPort = port ?? (Number(process.env.HTTP_PORT) || 3000);
  let httpServer: ReturnType<typeof app.listen> | undefined;

  return {
    server,
    app,
    start: async () => {
      return new Promise<void>((resolve) => {
        httpServer = app.listen(httpPort, () => {
          resolve();
        });
      });
    },
    stop: () => {
      Object.values(transports).forEach((t) => {
        t.close().catch(() => {});
      });
      httpServer?.close();
    },
  };
}
