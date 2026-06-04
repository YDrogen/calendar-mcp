import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolHandler } from '../types/mcp.js';
import { AllToolDefinitions } from '../tools/definitions.js';

export function registerToolsOnServer(
  server: McpServer,
  handlers: { [name: string]: ToolHandler }
): void {
  for (const def of AllToolDefinitions) {
    const handler = handlers[def.name];
    if (!handler) {
      throw new Error(`No handler found for tool: ${def.name}`);
    }

    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
      },
      handler
    );
  }
}
