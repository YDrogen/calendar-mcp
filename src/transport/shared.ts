import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolHandler } from '../types/mcp.js';
import { AllToolDefinitions } from '../tools/definitions.js';

function sanitizeInput(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    if (typeof val === 'string' && val.length > 200) {
      sanitized[key] = val.slice(0, 200) + '...';
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export function registerToolsOnServer(
  server: McpServer,
  handlers: { [name: string]: ToolHandler }
): void {
  let count = 0;
  for (const def of AllToolDefinitions) {
    const handler = handlers[def.name];
    if (!handler) {
      throw new Error(`No handler found for tool: ${def.name}`);
    }

    const wrappedHandler: ToolHandler = async (input) => {
      const start = Date.now();
      console.log(`[tool:call] ${def.name}`, JSON.stringify(sanitizeInput(input)));
      try {
        const result = await handler(input);
        console.log(`[tool:ok] ${def.name} (${Date.now() - start}ms)`);
        return result;
      } catch (err) {
        console.error(`[tool:err] ${def.name} (${Date.now() - start}ms)`, err instanceof Error ? err.message : err);
        throw err;
      }
    };

    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
      },
      wrappedHandler
    );
    count++;
  }
  console.log(`[server] registered ${count} tools`);
}
