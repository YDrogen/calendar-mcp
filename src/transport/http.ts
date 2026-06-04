import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { registerToolsOnServer } from './shared.js';
import { ToolHandler } from '../types/mcp.js';
import { createWebhookEndpoint, channelStore } from '../webhooks/endpoint.js';

export function createHttpServer(
  handlers: { [name: string]: ToolHandler },
  port?: number,
  allowedHosts?: string[]
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

  if (allowedHosts && allowedHosts.length > 0) {
    app.use((req, res, next) => {
      const host = req.headers.host;
      if (!host) {
        res.status(403).send('Invalid Host header');
        return;
      }
      const hostWithoutPort = host.split(':')[0];
      if (!allowedHosts.includes(hostWithoutPort)) {
        res.status(403).send('Invalid Host header');
        return;
      }
      next();
    });
  }

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/webhooks', createWebhookEndpoint(channelStore));

  const transports: Record<string, SSEServerTransport> = {};

  function createSseTransport(res: express.Response, messageEndpoint: string) {
    const transport = new SSEServerTransport(
      messageEndpoint,
      res,
      allowedHosts && allowedHosts.length > 0
        ? {
            enableDnsRebindingProtection: true,
            allowedHosts,
          }
        : {}
    );
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;
    console.log(`[sse] client connected: ${sessionId}`);
    transport.onclose = () => {
      console.log(`[sse] client disconnected: ${sessionId}`);
      delete transports[sessionId];
    };
    return transport;
  }

  app.get('/mcp', async (req, res) => {
    try {
      const transport = createSseTransport(res, '/messages');
      await server.connect(transport);
    } catch {
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  });

  app.get('/sse', async (req, res) => {
    try {
      const transport = createSseTransport(res, '/messages');
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
    transport.handlePostMessage(req, res, req.body).catch(() => {});
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
