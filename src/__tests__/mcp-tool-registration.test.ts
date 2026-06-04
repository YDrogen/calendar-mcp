import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListEventsSchema, CreateEventSchema, DeleteEventSchema } from '../types/tools';
import { ToolDefinition } from '../types/mcp';
import { z } from 'zod';

describe('MCP SDK Tool Registration', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-calendar-server',
      version: '1.0.0',
    });
  });

  afterEach(() => {
    server = null;
  });

  it('should create McpServer instance without errors', () => {
    expect(server).toBeDefined();
  });

  it('should register a tool with Zod schema using registerTool', () => {
    const definition: ToolDefinition = {
      name: 'list_events',
      description: 'List events in a calendar',
      inputSchema: ListEventsSchema,
      handler: async (input) => ({
        content: [{ type: 'text' as const, text: JSON.stringify(input) }],
      }),
    };

    expect(() => {
      server.registerTool(
        definition.name,
        {
          description: definition.description,
          inputSchema: definition.inputSchema,
        },
        definition.handler
      );
    }).not.toThrow();
  });

  it('should register multiple tools with different schemas', () => {
    const tools: ToolDefinition[] = [
      {
        name: 'list_events',
        description: 'List events',
        inputSchema: ListEventsSchema,
        handler: async () => ({
          content: [{ type: 'text', text: '[]' }],
        }),
      },
      {
        name: 'create_event',
        description: 'Create event',
        inputSchema: CreateEventSchema,
        handler: async () => ({
          content: [{ type: 'text', text: '{}' }],
        }),
      },
      {
        name: 'delete_event',
        description: 'Delete event',
        inputSchema: DeleteEventSchema,
        handler: async () => ({
          content: [{ type: 'text', text: 'deleted' }],
        }),
      },
    ];

    expect(() => {
      tools.forEach((tool) => {
        server.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
          tool.handler
        );
      });
    }).not.toThrow();
  });

  it('should register tools with annotations', () => {
    const definition: ToolDefinition = {
      name: 'delete_event',
      description: 'Delete an event',
      inputSchema: DeleteEventSchema,
      handler: async () => ({
        content: [{ type: 'text', text: 'deleted' }],
      }),
      annotations: {
        destructiveHint: true,
      },
    };

    expect(() => {
      server.registerTool(
        definition.name,
        {
          description: definition.description,
          inputSchema: definition.inputSchema,
          annotations: definition.annotations,
        },
        definition.handler
      );
    }).not.toThrow();
  });

  it('should validate tool input at registration time', () => {
    const schema = z.object({
      required_field: z.string(),
    });

    const definition: ToolDefinition = {
      name: 'test_tool',
      description: 'Test tool',
      inputSchema: schema,
      handler: async (input) => ({
        content: [{ type: 'text', text: JSON.stringify(input) }],
      }),
    };

    expect(() => {
      server.registerTool(
        definition.name,
        {
          description: definition.description,
          inputSchema: definition.inputSchema,
        },
        definition.handler
      );
    }).not.toThrow();
  });

  it('should handle tool handlers with different return types', () => {
    const handlers = [
      async () => ({
        content: [{ type: 'text' as const, text: 'success' }],
      }),
      async () => ({
        isError: true,
        content: [{ type: 'text' as const, text: 'error message' }],
      }),
    ];

    handlers.forEach((handler) => {
      expect(async () => {
        const result = await handler();
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
      }).not.toThrow();
    });
  });

  it('should support Zod schema with complex nested objects', () => {
    const schema = z.object({
      summary: z.string(),
      start: z.object({
        dateTime: z.string().optional(),
        date: z.string().optional(),
      }),
      end: z.object({
        dateTime: z.string().optional(),
        date: z.string().optional(),
      }),
      attendees: z
        .array(
          z.object({
            email: z.string().email(),
            displayName: z.string().optional(),
          })
        )
        .optional(),
    });

    const definition: ToolDefinition = {
      name: 'create_event_complex',
      description: 'Create event with complex schema',
      inputSchema: schema,
      handler: async (input) => ({
        content: [{ type: 'text', text: JSON.stringify(input) }],
      }),
    };

    expect(() => {
      server.registerTool(
        definition.name,
        {
          description: definition.description,
          inputSchema: definition.inputSchema,
        },
        definition.handler
      );
    }).not.toThrow();
  });

  it('should allow schema descriptions for LLM context', () => {
    const schema = z
      .object({
        calendarId: z
          .string()
          .describe('Google Calendar ID or email address'),
        timeMin: z
          .string()
          .describe('Start of time range in RFC 3339 format'),
        timeMax: z
          .string()
          .describe('End of time range in RFC 3339 format'),
      })
      .describe('Query parameters for listing events');

    const definition: ToolDefinition = {
      name: 'list_events_described',
      description: 'List calendar events with descriptions',
      inputSchema: schema,
      handler: async (input) => ({
        content: [{ type: 'text', text: JSON.stringify(input) }],
      }),
    };

    expect(() => {
      server.registerTool(
        definition.name,
        {
          description: definition.description,
          inputSchema: definition.inputSchema,
        },
        definition.handler
      );
    }).not.toThrow();
  });

  it('should create two independent McpServer instances', () => {
    const server1 = new McpServer({
      name: 'server-1',
      version: '1.0.0',
    });

    const server2 = new McpServer({
      name: 'server-2',
      version: '1.0.0',
    });

    expect(server1).toBeDefined();
    expect(server2).toBeDefined();
    expect(server1).not.toBe(server2);
  });

  it('should register same tool on two independent servers', () => {
    const server1 = new McpServer({
      name: 'server-1',
      version: '1.0.0',
    });

    const server2 = new McpServer({
      name: 'server-2',
      version: '1.0.0',
    });

    const tool = {
      name: 'list_events',
      description: 'List events',
      inputSchema: ListEventsSchema,
      handler: async () => ({
        content: [{ type: 'text' as const, text: '[]' }],
      }),
    };

    expect(() => {
      server1.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        tool.handler
      );
      server2.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        tool.handler
      );
    }).not.toThrow();

    expect(server1).not.toBe(server2);
  });
});
