import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerToolsOnServer } from './shared.js';
import { ToolHandler } from '../types/mcp.js';

export function createStdioServer(handlers: { [name: string]: ToolHandler }) {
  const server = new McpServer({
    name: 'calendar-mcp-stdio',
    version: '1.0.0',
  });

  registerToolsOnServer(server, handlers);

  const transport = new StdioServerTransport();
  let isRunning = false;

  const shutdown = async () => {
    if (!isRunning) return;
    isRunning = false;
    await transport.close();
    process.exit(0);
  };

  return {
    server,
    start: async () => {
      if (isRunning) return;
      isRunning = true;
      await server.connect(transport);
      process.once('SIGTERM', shutdown);
      process.once('SIGINT', shutdown);
    },
    stop: () => {
      if (!isRunning) return;
      isRunning = false;
      transport.close().catch(() => {});
      process.off('SIGTERM', shutdown);
      process.off('SIGINT', shutdown);
    },
  };
}
