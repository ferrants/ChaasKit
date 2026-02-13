import type { MCPContentItem, MCPAuthMode, MCPOAuthConfig } from '@chaaskit/shared';

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

/** Credential configuration for native tool integrations */
export interface NativeCredentialConfig {
  /** Unique ID used as serverId in MCPCredential table */
  id: string;
  /** Display name in settings UI (e.g., "Jira", "Slack") */
  name: string;
  /** Authentication mode */
  authMode: MCPAuthMode;
  /** Help text shown to users in settings */
  userInstructions?: string;
  /** OAuth configuration (required for oauth auth modes) */
  oauth?: MCPOAuthConfig;
  /** When credential is missing: 'hide' removes tool from LLM, 'error' shows tool but returns error on use. Default: 'hide' */
  whenMissing?: 'hide' | 'error';
}

/** Resolved credential data passed to tool execute() */
export interface ResolvedCredential {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
}

/**
 * Context passed to native tool execution
 */
export interface ToolContext {
  userId?: string;
  threadId?: string;
  agentId?: string;
  teamId?: string;
  credential?: ResolvedCredential;
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

  /** References a NativeCredentialConfig.id - credential will be auto-resolved and passed via context */
  credentialId?: string;

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
