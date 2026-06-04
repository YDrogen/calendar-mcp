import { z } from 'zod';

/**
 * MCP tool handler input/output types.
 * Wraps the MCP SDK's callback signature with generic typing.
 */

/**
 * Input validation schema for any MCP tool.
 */
export type ToolInputSchema = z.ZodSchema;

/**
 * MCP tool handler function signature.
 * Receives validated input (Zod-parsed) and returns MCP response.
 */
export type ToolHandler = (
  input: unknown
) => Promise<{
  isError?: boolean;
  content: Array<{ type: 'text'; text: string }>;
}>;

/**
 * MCP tool definition with metadata and schema.
 */
export interface ToolDefinition<T extends ToolInputSchema = ToolInputSchema> {
  /**
   * Unique tool name (e.g., "list_events")
   */
  name: string;

  /**
   * Human-readable description for LLM context
   */
  description: string;

  /**
   * Zod input schema for validation and type safety
   */
  inputSchema: T;

  /**
   * Handler function that processes validated input
   */
  handler: ToolHandler;

  /**
   * MCP SDK annotations for UX hints
   */
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
}
