export type MCPTransport = 'stdio' | 'sse' | 'streamable-http';
export type MCPAuthMode = 'none' | 'admin' | 'user-apikey' | 'user-oauth' | 'team-apikey' | 'team-oauth';

// Tool confirmation configuration types
export type ToolConfirmationMode = 'none' | 'all' | 'whitelist' | 'blacklist';

export interface ToolConfirmationConfig {
  mode: ToolConfirmationMode;
  // For whitelist: tools that DON'T require confirmation
  // For blacklist: tools that DO require confirmation
  // Format: "serverId:toolName" or just "toolName" for all servers
  tools?: string[];
}

export type AutoApproveReason = 'config_none' | 'whitelist' | 'user_always' | 'thread_allowed';

export interface MCPOAuthConfig {
  // Manual configuration (optional - will be discovered if not provided)
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  clientId?: string;
  clientSecretEnvVar?: string;  // Env var name for client secret
  scopes?: string[];
  // Dynamic registration settings
  clientName?: string;          // Name for dynamic registration
  clientUri?: string;           // Client homepage for registration
}

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: MCPTransport;
  command?: string;           // stdio only
  args?: string[];            // stdio only
  url?: string;               // sse/streamable-http
  enabled: boolean;
  authMode?: MCPAuthMode;     // Default: 'none'
  adminApiKeyEnvVar?: string; // For authMode='admin'
  oauth?: MCPOAuthConfig;     // For authMode='user-oauth'
  userInstructions?: string;  // Help text for users
}

export interface MCPToolMeta {
  // OpenAI-style UI resource reference
  'openai/outputTemplate'?: string;
  'openai/toolInvocation/invoking'?: string;
  'openai/toolInvocation/invoked'?: string;
  // MCP Apps style UI resource reference
  'ui/resourceUri'?: string;
  // Allow other metadata fields
  [key: string]: unknown;
}

export interface MCPToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  // Allow other annotation fields
  [key: string]: unknown;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, MCPToolProperty>;
    required?: string[];
    additionalProperties?: boolean;
  };
  _meta?: MCPToolMeta;
  annotations?: MCPToolAnnotations;
}

export interface MCPToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface MCPToolInvocation {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResponse {
  content: MCPContentItem[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

export interface MCPContentItem {
  type: 'text' | 'image' | 'audio' | 'resource_link' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
  name?: string;
  description?: string;
  resource?: MCPResource;
}

export interface MCPResource {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface MCPServerStatus {
  id: string;
  name: string;
  connected: boolean;
  tools: MCPTool[];
  error?: string;
}

export interface MCPCredentialStatus {
  serverId: string;
  serverName: string;
  authMode: MCPAuthMode;
  hasCredential: boolean;
  credentialType?: 'api_key' | 'oauth';
  userInstructions?: string;
}

// =============================================================================
// MCP Server Export Configuration (for exposing this app as an MCP server)
// =============================================================================

/**
 * Configuration for exposing this app's tools via MCP protocol.
 * Allows external MCP clients (Claude Desktop, MCP Inspector, etc.) to connect.
 */
export interface MCPServerExportConfig {
  /** Enable MCP server endpoint */
  enabled: boolean;
  /** Which tools to expose: 'all', 'native' (built-in only), or array of tool names */
  exposeTools?: 'all' | 'native' | string[];
  /** OAuth configuration for MCP clients */
  oauth?: MCPServerOAuthConfig;
}

/**
 * OAuth configuration for MCP server authentication.
 * Implements OAuth 2.1 with PKCE for MCP client authentication.
 */
export interface MCPServerOAuthConfig {
  /** Enable OAuth authentication (in addition to API keys) */
  enabled: boolean;
  /** Allow dynamic client registration (RFC 7591) */
  allowDynamicRegistration: boolean;
  /** Access token TTL in seconds (default: 3600 = 1 hour) */
  accessTokenTTLSeconds?: number;
  /** Refresh token TTL in seconds (default: 2592000 = 30 days) */
  refreshTokenTTLSeconds?: number;
}
