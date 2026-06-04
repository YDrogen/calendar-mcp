import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createStdioServer } from '../transport/stdio.js';
import { AllToolDefinitions } from '../tools/definitions.js';

describe('Stdio Transport Server', () => {
  const mockHandlers = Object.fromEntries(
    AllToolDefinitions.map((def) => [
      def.name,
      async () => ({ content: [{ type: 'text' as const, text: 'test' }] }),
    ])
  );

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create McpServer instance', () => {
    const { server } = createStdioServer(mockHandlers);
    expect(server).toBeInstanceOf(McpServer);
    expect(server).toBeDefined();
  });

  it('should register all tools on server', () => {
    const spy = vi.spyOn(McpServer.prototype, 'registerTool').mockImplementation(() => {});
    createStdioServer(mockHandlers);
    expect(spy).toHaveBeenCalledTimes(AllToolDefinitions.length);
    spy.mockRestore();
  });

  it('should create independent instances', () => {
    const { server: server1 } = createStdioServer(mockHandlers);
    const { server: server2 } = createStdioServer(mockHandlers);
    expect(server1).not.toBe(server2);
    expect(server1).toBeInstanceOf(McpServer);
    expect(server2).toBeInstanceOf(McpServer);
  });

  it('should return start and stop functions', () => {
    const { start, stop } = createStdioServer(mockHandlers);
    expect(typeof start).toBe('function');
    expect(typeof stop).toBe('function');
  });

  it('should connect transport on start', async () => {
    const { server, start, stop } = createStdioServer(mockHandlers);
    const connectSpy = vi.spyOn(server, 'connect').mockResolvedValue(undefined);
    await start();
    expect(connectSpy).toHaveBeenCalledTimes(1);
    stop();
  });
});
