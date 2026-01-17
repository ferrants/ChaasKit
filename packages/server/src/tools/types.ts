import type { MCPContentItem } from '@chaaskit/shared';

/**
 * JSON Schema for tool input validation
 */
export interface JSONSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    default?: unknown;
  }>;
  required?: string[];
}

/**
 * Context passed to native tool execution
 */
export interface ToolContext {
  userId?: string;
  threadId?: string;
  agentId?: string;
}

/**
 * Result returned from native tool execution
 */
export interface ToolResult {
  content: MCPContentItem[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

/**
 * Metadata for native tools (mirrors MCP tool metadata)
 */
export interface NativeToolMeta {
  /** Inline HTML template for widget rendering */
  'ui/template'?: string;
  /** File path relative to tools/templates/ for widget rendering */
  'ui/templateFile'?: string;
  /** Allow additional metadata keys */
  [key: string]: unknown;
}

/**
 * Native tool definition - mirrors MCP tool structure for consistency
 */
export interface NativeTool {
  /** Unique tool name (used in allowedTools as 'native:name') */
  name: string;

  /** Human-readable description for the LLM */
  description: string;

  /** JSON Schema describing the tool's input parameters */
  inputSchema: JSONSchema;

  /** Optional metadata for UI templates and other extensions */
  _meta?: NativeToolMeta;

  /** Execute the tool with the given input */
  execute: (input: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

/**
 * Native tool formatted for agent consumption (matches MCP tool format)
 */
export interface NativeToolForAgent {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  serverId: 'native';
  _meta?: NativeToolMeta;
}
