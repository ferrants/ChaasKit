# MCP Integration

The Model Context Protocol (MCP) enables AI agents to use external tools. This template includes full MCP support for tool discovery, execution, and per-user or per-team authentication.

## Overview

MCP allows the AI assistant to:
- Access external data sources
- Execute commands on your behalf
- Interact with APIs and services
- Read and manipulate files
- Render rich UI widgets from tool responses

## Architecture

```
User Message --> Chat API --> AI Agent (Anthropic/OpenAI)
                                  |
                             tool_use block
                                  |
                             MCP Client Manager
                                  |
                             Get User/Team Credentials (if needed)
                                  |
                             Execute Tool
                                  |
                             Tool Result --> Continue AI Loop
                                  |
                             Final Response --> User
```

## Configuration

Configure MCP servers in `config/app.config.ts`:

```typescript
mcp: {
  servers: [
    // Stdio server - no authentication (local process)
    {
      id: 'filesystem',
      name: 'File System',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      enabled: true,
    },
    // Streamable HTTP with admin API key (shared across all users)
    {
      id: 'company-tools',
      name: 'Company Tools',
      transport: 'streamable-http',
      url: 'https://tools.company.com/mcp',
      enabled: true,
      authMode: 'admin',
      adminApiKeyEnvVar: 'COMPANY_TOOLS_API_KEY',
    },
    // Streamable HTTP with user API key (each user provides their own)
    {
      id: 'openai-tools',
      name: 'OpenAI Tools',
      transport: 'streamable-http',
      url: 'https://mcp.openai.com',
      enabled: true,
      authMode: 'user-apikey',
      userInstructions: 'Enter your OpenAI API key from platform.openai.com',
    },
    // Streamable HTTP with user OAuth (each user authenticates via OAuth)
    {
      id: 'github-tools',
      name: 'GitHub Tools',
      transport: 'streamable-http',
      url: 'https://github-mcp.example.com',
      enabled: true,
      authMode: 'user-oauth',
      oauth: {
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        tokenEndpoint: 'https://github.com/login/oauth/access_token',
        clientId: '${GITHUB_MCP_CLIENT_ID}',
        clientSecretEnvVar: 'GITHUB_MCP_CLIENT_SECRET',
        scopes: ['repo', 'read:user'],
      },
      userInstructions: 'Connect your GitHub account to use repository tools',
    },
    // Streamable HTTP with team API key (team admin provides key, shared in team threads)
    {
      id: 'jira-tools',
      name: 'Jira',
      transport: 'streamable-http',
      url: 'https://jira-mcp.example.com',
      enabled: true,
      authMode: 'team-apikey',
      userInstructions: 'Ask your team admin to configure the Jira API key in Team Settings',
    },
  ],
  allowUserServers: true,
  toolConfirmation: {
    mode: 'all', // 'none' | 'all' | 'whitelist' | 'blacklist'
    tools: [], // Tool patterns for whitelist/blacklist modes
  },
  toolTimeout: 30000,
  showToolCalls: true, // Set to false to hide tool execution cards in chat
}
```

### Server Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `transport` | `'stdio'` \| `'sse'` \| `'streamable-http'` | Connection type |
| `command` | string | Command to run (stdio only) |
| `args` | string[] | Command arguments (stdio only) |
| `url` | string | Server URL (sse/streamable-http) |
| `enabled` | boolean | Enable/disable server |
| `authMode` | `'none'` \| `'admin'` \| `'user-apikey'` \| `'user-oauth'` \| `'team-apikey'` \| `'team-oauth'` | Authentication mode |
| `adminApiKeyEnvVar` | string | Env var name for admin API key |
| `oauth` | object | OAuth configuration (see below) |
| `userInstructions` | string | Help text shown to users |

### OAuth Configuration

| Option | Type | Description |
|--------|------|-------------|
| `authorizationEndpoint` | string | OAuth authorization URL |
| `tokenEndpoint` | string | OAuth token URL |
| `clientId` | string | OAuth client ID (supports `${ENV_VAR}` syntax) |
| `clientSecretEnvVar` | string | Env var name for client secret |
| `scopes` | string[] | OAuth scopes to request |

### Global Options

| Option | Description |
|--------|-------------|
| `allowUserServers` | Allow users to add their own MCP servers |
| `toolConfirmation` | Tool confirmation settings (see below) |
| `toolTimeout` | Timeout for tool calls in milliseconds |
| `showToolCalls` | Show tool execution cards in chat (default: true) |

### Tool Confirmation Configuration

| Option | Type | Description |
|--------|------|-------------|
| `mode` | `'none'` \| `'all'` \| `'whitelist'` \| `'blacklist'` | Confirmation mode |
| `tools` | string[] | Tool patterns for whitelist/blacklist modes |

## Transport Types

### Stdio Transport

Spawns a child process and communicates via stdin/stdout. No authentication needed.

```typescript
{
  id: 'my-server',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
  enabled: true,
}
```

### SSE Transport

Connects to an HTTP server using Server-Sent Events.

```typescript
{
  id: 'my-server',
  transport: 'sse',
  url: 'http://localhost:8080/sse',
  enabled: true,
}
```

### Streamable HTTP Transport

Modern HTTP-based transport with support for authentication. Recommended for remote servers.

```typescript
{
  id: 'my-server',
  transport: 'streamable-http',
  url: 'https://api.example.com/mcp',
  enabled: true,
  authMode: 'user-apikey',
  userInstructions: 'Enter your API key',
}
```

## Authentication Modes

### No Authentication (`none`)

Default for stdio servers. No credentials required.

### Admin API Key (`admin`)

A shared API key stored in environment variables. All users share the same credentials.

```typescript
{
  authMode: 'admin',
  adminApiKeyEnvVar: 'MY_SERVICE_API_KEY',
}
```

### User API Key (`user-apikey`)

Each user provides their own API key via the Settings modal.

```typescript
{
  authMode: 'user-apikey',
  userInstructions: 'Enter your API key from dashboard.example.com',
}
```

### User OAuth (`user-oauth`)

Each user authenticates via OAuth 2.0. Supports:
- Manual OAuth configuration
- RFC 9728/8414 auto-discovery (if server supports it)
- PKCE for enhanced security

```typescript
{
  authMode: 'user-oauth',
  oauth: {
    authorizationEndpoint: 'https://provider.com/oauth/authorize',
    tokenEndpoint: 'https://provider.com/oauth/token',
    clientId: '${OAUTH_CLIENT_ID}',
    clientSecretEnvVar: 'OAUTH_CLIENT_SECRET',
    scopes: ['read', 'write'],
  },
  userInstructions: 'Connect your account to use these tools',
}
```

### Team API Key (`team-apikey`)

A team admin provides a shared API key that all team members use in team threads. Credentials are configured in Team Settings and only work in team threads (not personal threads).

```typescript
{
  authMode: 'team-apikey',
  userInstructions: 'Ask your team admin to configure the API key in Team Settings',
}
```

### Team OAuth (`team-oauth`)

A team admin authenticates via OAuth once and all team members use the shared credential in team threads. Supports the same OAuth configuration options as `user-oauth`.

```typescript
{
  authMode: 'team-oauth',
  oauth: {
    authorizationEndpoint: 'https://provider.com/oauth/authorize',
    tokenEndpoint: 'https://provider.com/oauth/token',
    clientId: '${OAUTH_CLIENT_ID}',
    clientSecretEnvVar: 'OAUTH_CLIENT_SECRET',
    scopes: ['read', 'write'],
  },
  userInstructions: 'Team admin can connect this integration in Team Settings',
}
```

**Note**: Team credentials are scoped to team threads only. Tools with `team-apikey` or `team-oauth` auth modes will not appear in personal threads.

## OAuth Auto-Discovery

For servers that support RFC 9728 or RFC 8414, OAuth configuration can be auto-discovered:

```typescript
{
  id: 'modern-service',
  transport: 'streamable-http',
  url: 'https://api.modern-service.com/mcp',
  enabled: true,
  authMode: 'user-oauth',
  // No oauth config needed - will be discovered automatically
}
```

The system will check:
1. `/.well-known/oauth-protected-resource` (RFC 9728)
2. `/.well-known/oauth-authorization-server` (RFC 8414)

## User Credential Management

Users manage their MCP credentials in the Settings modal:

- **API Key servers**: Text input to enter/update key
- **OAuth servers**: "Connect" button to start OAuth flow
- **Disconnect**: Remove stored credentials

Credentials are encrypted at rest using AES-256-GCM.

## Team Credential Management

Team admins (owner or admin role) manage shared MCP credentials in the Team Settings page:

- **API Key servers**: Text input to enter/update the team API key
- **OAuth servers**: "Connect" button to start OAuth flow on behalf of the team
- **Disconnect**: Remove stored team credentials

Team credentials are only usable in team threads. When a team member chats in a team thread, the AI agent can use tools authenticated with the team's credentials. In personal threads, team-auth tools will not appear.

### Permissions

| Role | Can manage team MCP credentials |
|------|--------------------------------|
| Owner | Yes |
| Admin | Yes |
| Member | No |
| Viewer | No |

### Environment Variables

```bash
# Credential encryption key (min 32 chars, falls back to SESSION_SECRET)
MCP_CREDENTIAL_KEY=your-32-char-secure-key-here

# Admin MCP server keys
COMPANY_TOOLS_API_KEY=sk-...

# OAuth client credentials
GITHUB_MCP_CLIENT_ID=...
GITHUB_MCP_CLIENT_SECRET=...
```

## UI Resource Widgets

MCP tools can return rich UI content using the OpenAI Apps SDK format. When a tool response includes a `uiResource` with HTML content, it's rendered as an interactive widget.

### How It Works

1. Tool returns `uiResource` with `text` (HTML) and `mimeType: 'text/html'`
2. HTML is rendered in a sandboxed iframe
3. `window.openai` API is injected with tool input/output data

### OpenAI Apps SDK Integration

The iframe receives:

```javascript
window.openai = {
  theme: 'light', // or 'dark' - matches app theme
  canvas: {
    getContent: async () => ({
      toolInput: { /* original tool arguments */ },
      toolOutput: { /* tool response data */ }
    })
  }
};
```

### Structured Content

Tools can return `structuredContent` for rich data that's:
- Passed to UI widgets via `window.openai.canvas.getContent()`
- Included in agent context for follow-up questions

## Frontend Display

Tool calls are displayed inline in messages (when `showToolCalls: true`):

```
AI: I'll read that file for you.

[Tool: read_file] ▾
  Server: filesystem
  Arguments: { "path": "/tmp/data.json" }
  Result: { "data": "..." }

[Interactive Widget] (if uiResource returned)

Here's what I found in the file...
```

### Tool Call States

- **Pending**: Tool is being executed (spinner)
- **Completed**: Tool finished successfully (checkmark)
- **Error**: Tool failed (error icon)

### Hiding Tool Calls

Set `showToolCalls: false` in config to hide tool execution cards while still showing UI widgets and responses.

## API Endpoints

### List Servers

```http
GET /api/mcp/servers
Authorization: Bearer <token>
```

### List Tools

```http
GET /api/mcp/tools
Authorization: Bearer <token>
```

### Credential Status

```http
GET /api/mcp/credentials
Authorization: Bearer <token>
```

### Set API Key

```http
POST /api/mcp/credentials/:serverId/apikey
Authorization: Bearer <token>
Content-Type: application/json

{
  "apiKey": "sk-..."
}
```

### Start OAuth Flow

```http
GET /api/mcp/oauth/:serverId/authorize
Authorization: Bearer <token>
```

Returns redirect URL for OAuth authorization.

### OAuth Callback

```http
GET /api/mcp/oauth/callback?code=...&state=...
```

Exchanges code for tokens and stores credentials.

### Remove Credentials

```http
DELETE /api/mcp/credentials/:serverId
Authorization: Bearer <token>
```

### Team Credential Status

```http
GET /api/mcp/team/:teamId/credentials
Authorization: Bearer <token>
```

Requires admin role in the team.

### Set Team API Key

```http
POST /api/mcp/team/:teamId/credentials/:serverId/apikey
Authorization: Bearer <token>
Content-Type: application/json

{
  "apiKey": "sk-..."
}
```

Requires admin role in the team.

### Start Team OAuth Flow

```http
GET /api/mcp/team/:teamId/oauth/:serverId/authorize
Authorization: Bearer <token>
```

Requires admin role in the team. Returns redirect URL for OAuth authorization.

### Remove Team Credentials

```http
DELETE /api/mcp/team/:teamId/credentials/:serverId
Authorization: Bearer <token>
```

Requires admin role in the team.

## Agentic Loop

The chat endpoint implements an agentic loop:

1. Send message with available tools to AI
2. If AI returns `tool_use`, execute the tool
3. Send tool result (including `structuredContent`) back to AI
4. Repeat until AI responds without tool calls
5. Return final response with any UI resources

### Maximum Iterations

Limited to 10 iterations to prevent infinite loops.

## Tool Confirmation

The tool confirmation system gives users control over which tools can execute automatically and which require explicit approval.

### Confirmation Modes

**`none`** - No confirmation required. All tools execute automatically.

```typescript
toolConfirmation: {
  mode: 'none',
}
```

**`all`** - All tools require user confirmation before execution.

```typescript
toolConfirmation: {
  mode: 'all',
}
```

**`whitelist`** - Listed tools skip confirmation; all others require it.

```typescript
toolConfirmation: {
  mode: 'whitelist',
  tools: [
    'weather:get_forecast',     // Specific tool
    'calculator:compute',        // Safe read-only tools
  ],
}
```

**`blacklist`** - Listed tools require confirmation; all others execute automatically.

```typescript
toolConfirmation: {
  mode: 'blacklist',
  tools: [
    'filesystem:delete_file',   // Destructive operations
    'github:create_issue',      // Actions with side effects
    'email:send',               // External communications
  ],
}
```

### Tool Patterns

Tool patterns can be specified as:
- `serverId:toolName` - Matches a specific tool on a specific server
- `toolName` - Matches the tool on any server

### User Runtime Options

When confirmation is required, users see a modal with these options:

1. **Allow once** - Execute the tool this time only
2. **Allow for this chat** - Auto-approve this tool for the current conversation
3. **Always allow** - Save to user settings, auto-approve in all future chats
4. **Deny** - Reject the tool call; AI receives denial message and continues

### Auto-Approved Indicators

Tools that are auto-approved show a visual indicator explaining why:
- "Admin config allows all tools" - Mode is `none`
- "Tool is in allowed list" - Whitelisted tool
- "You always allowed this tool" - User's saved preference
- "Allowed for this chat" - Thread-level approval

### User Settings

Users' "always allow" choices are stored in their settings:

```typescript
{
  allowedTools: [
    'filesystem:read_file',
    'calculator:compute',
  ]
}
```

### Confirmation Flow

```
Tool Call Received
       ↓
Check Admin Config
       ↓
┌──────────────────┐
│  Mode = 'none'?  │──Yes──→ Execute (auto-approved)
└────────┬─────────┘
         No
         ↓
┌──────────────────┐
│   Whitelisted?   │──Yes──→ Execute (auto-approved)
└────────┬─────────┘
         No
         ↓
┌──────────────────┐
│  Blacklisted or  │──No───→ Execute (auto-approved)
│   Mode = 'all'?  │
└────────┬─────────┘
        Yes
         ↓
┌──────────────────┐
│ User 'always'?   │──Yes──→ Execute (auto-approved)
└────────┬─────────┘
         No
         ↓
┌──────────────────┐
│ Thread allowed?  │──Yes──→ Execute (auto-approved)
└────────┬─────────┘
         No
         ↓
    Show Modal
         ↓
   User Decision
     ↓     ↓
   Allow  Deny
     ↓     ↓
  Execute Return denial message
```

### API Endpoint

```http
POST /api/chat/confirm-tool
Authorization: Bearer <token>
Content-Type: application/json

{
  "confirmationId": "confirm_1234567890_abc123",
  "approved": true,
  "scope": "always"  // "once" | "thread" | "always"
}
```

### SSE Events

During streaming, tool confirmation uses these events:

- `tool_pending_confirmation` - Tool requires user approval
- `tool_confirmed` - User responded (approved or denied)
- `tool_auto_approved` - Tool was auto-approved with reason

## Security Considerations

1. **Credential Encryption**: All credentials encrypted at rest with AES-256-GCM
2. **Credential Isolation**: User credentials are never shared between users; team credentials are shared only within the team and only in team threads
3. **OAuth Security**: PKCE used for all OAuth flows
4. **Path Restrictions**: File system servers should be scoped to specific directories
5. **Tool Confirmation**: Use `toolConfirmation` with `mode: 'all'` or `blacklist` for sensitive operations
6. **Timeout**: Set appropriate `toolTimeout` to prevent hanging
7. **Confirmation Expiry**: Pending confirmations auto-deny after 5 minutes

## Available MCP Servers

### Official Servers

| Server | Description | Install |
|--------|-------------|---------|
| `@modelcontextprotocol/server-filesystem` | File system access | `npx -y @modelcontextprotocol/server-filesystem /path` |
| `@modelcontextprotocol/server-memory` | Key-value storage | `npx -y @modelcontextprotocol/server-memory` |
| `@modelcontextprotocol/server-brave-search` | Web search | Requires API key |
| `@modelcontextprotocol/server-puppeteer` | Browser automation | `npx -y @modelcontextprotocol/server-puppeteer` |

### Community Servers

Find more at [modelcontextprotocol.io](https://modelcontextprotocol.io)

## Creating Custom MCP Servers

### Basic Structure

```typescript
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const server = new Server({
  name: 'my-server',
  version: '1.0.0',
});

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'my_tool',
      description: 'Does something',
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string' }
        },
        required: ['param']
      }
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  // Return with optional structuredContent and uiResource
  return {
    content: [{ type: 'text', text: 'Result' }],
    structuredContent: { data: 'structured data for widgets' },
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Returning UI Resources

```typescript
server.setRequestHandler('tools/call', async (request) => {
  return {
    content: [
      { type: 'text', text: 'Here is the visualization' },
      {
        type: 'resource',
        resource: {
          uri: 'ui://widget',
          mimeType: 'text/html',
          text: '<html>...</html>', // OpenAI Apps SDK compatible HTML
        }
      }
    ],
    structuredContent: {
      chartData: [1, 2, 3, 4, 5],
      labels: ['A', 'B', 'C', 'D', 'E'],
    },
  };
});
```

## Troubleshooting

### Server not connecting

1. Check the command/URL is correct
2. Verify the server is installed/accessible
3. Look for errors in server logs
4. For auth servers, ensure credentials are configured

### Tools not appearing

1. Verify server is connected: `GET /api/mcp/servers`
2. Check server supports tools
3. Look for errors during `listTools`

### User credentials not working

1. Check credential status: `GET /api/mcp/credentials`
2. For OAuth, try disconnecting and reconnecting
3. Verify OAuth client ID/secret are correct
4. Check `MCP_CREDENTIAL_KEY` is set

### UI widgets not rendering

1. Verify tool returns `uiResource` with `text` and `mimeType`
2. Check browser console for iframe errors
3. Ensure HTML is valid and self-contained

---

## MCP Server Export

ChaasKit can act as an MCP server, allowing external MCP clients like Claude Desktop, MCP Inspector, or custom applications to access your app's tools. This enables integration with the broader MCP ecosystem.

### Overview

When enabled, the MCP server export feature:

- Exposes your app's native tools (and optionally MCP tools) via the MCP protocol
- Supports OAuth 2.1 with PKCE for secure authentication
- Implements dynamic client registration (RFC 7591)
- Works with any MCP-compatible client

### Configuration

Enable MCP server export in `config/app.config.ts`:

```typescript
mcp: {
  // ... existing MCP client config ...

  // NEW: Expose this app as an MCP server
  server: {
    enabled: true,
    exposeTools: 'native',  // 'all', 'native', or ['tool1', 'tool2']
    oauth: {
      enabled: true,
      allowDynamicRegistration: true,
      accessTokenTTLSeconds: 3600,      // 1 hour
      refreshTokenTTLSeconds: 2592000,  // 30 days
    },
  },
}
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable the MCP server endpoint |
| `exposeTools` | `'all'` \| `'native'` \| `string[]` | Which tools to expose |
| `oauth.enabled` | boolean | Enable OAuth authentication |
| `oauth.allowDynamicRegistration` | boolean | Allow RFC 7591 dynamic client registration |
| `oauth.accessTokenTTLSeconds` | number | Access token lifetime (default: 3600) |
| `oauth.refreshTokenTTLSeconds` | number | Refresh token lifetime (default: 2592000) |

### Tool Exposure Modes

- **`'native'`**: Only expose built-in native tools (web-scrape, get-plan-usage, etc.)
- **`'all'`**: Expose native tools plus any tools from connected MCP servers
- **`string[]`**: Explicit list of tool names to expose

### Authentication

The MCP server supports two authentication methods:

#### 1. OAuth 2.1 (Recommended)

Full OAuth 2.1 with PKCE support for MCP clients. Compliant with:
- RFC 8414 (OAuth Authorization Server Metadata)
- RFC 9728 (OAuth Protected Resource Metadata)
- RFC 7591 (Dynamic Client Registration)

#### 2. API Keys

Use existing ChaasKit API keys with the `/mcp/**` endpoint pattern allowed.

### Connecting MCP Clients

#### Claude Desktop

Add to your Claude Desktop config (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "my-chat-app": {
      "url": "https://your-app.com/mcp",
      "transport": "streamable-http"
    }
  }
}
```

When Claude Desktop connects, it will:
1. Discover OAuth metadata automatically
2. Prompt you to authorize via the consent page
3. Store tokens for future sessions

#### MCP Inspector

1. Open MCP Inspector
2. Set URL to `http://localhost:3000/mcp`
3. Select "Streamable HTTP" transport
4. Click "Authentication" → "Guided OAuth Flow"
5. Complete the OAuth flow
6. Click "Connect"

#### Custom MCP Clients

Use the `@modelcontextprotocol/sdk` to connect:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport({
  url: 'https://your-app.com/mcp',
  // OAuth token is handled by the transport
});

const client = new Client({
  name: 'my-client',
  version: '1.0.0',
});

await client.connect(transport);
const tools = await client.listTools();
```

### OAuth Flow Details

#### Discovery Endpoints

| Endpoint | RFC | Purpose |
|----------|-----|---------|
| `/.well-known/oauth-authorization-server` | RFC 8414 | Authorization server metadata |
| `/.well-known/oauth-protected-resource` | RFC 9728 | Resource server metadata |
| `/.well-known/oauth-protected-resource/mcp` | RFC 9728 | MCP resource metadata |

#### OAuth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oauth/register` | POST | Dynamic client registration |
| `/oauth/authorize` | GET | Authorization endpoint |
| `/oauth/authorize` | POST | Process consent decision |
| `/oauth/token` | POST | Token exchange |
| `/oauth/revoke` | POST | Token revocation |

#### Authorization Flow

1. **Client Registration**: MCP client registers via `/oauth/register`
2. **Authorization Request**: Client redirects user to `/oauth/authorize`
3. **User Consent**: User sees consent page, approves or denies
4. **Authorization Code**: Server redirects back with code
5. **Token Exchange**: Client exchanges code for tokens at `/oauth/token`
6. **API Access**: Client uses access token to call `/mcp`

#### Consent Page

Users see a consent screen showing:
- Client name (from registration)
- Requested scopes (`mcp:tools`, `mcp:resources`)
- Current user email
- Approve/Deny buttons

### MCP Protocol Endpoints

The `/mcp` endpoint accepts JSON-RPC 2.0 requests:

#### Initialize

```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "my-client", "version": "1.0.0" }
  },
  "id": 1
}
```

#### List Tools

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {},
  "id": 2
}
```

#### Call Tool

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "web-scrape",
    "arguments": { "url": "https://example.com" }
  },
  "id": 3
}
```

#### List Resources

```json
{
  "jsonrpc": "2.0",
  "method": "resources/list",
  "params": {},
  "id": 4
}
```

### Security Considerations

1. **OAuth PKCE**: All OAuth flows require PKCE (code_challenge)
2. **Token Hashing**: Tokens are hashed before storage
3. **Short-Lived Tokens**: Access tokens expire (default 1 hour)
4. **Scope Limitation**: Clients can only access approved scopes
5. **User Context**: Tools execute with the authenticated user's permissions
6. **Rate Limiting**: Standard rate limits apply to MCP endpoint

### Managing Connected Applications

Users can view and revoke OAuth app access in Settings:

1. Open Settings
2. Scroll to "Connected Applications"
3. View authorized MCP clients
4. Click "Revoke" to disconnect an app

### Database Schema

The MCP server uses these database tables:

- **OAuthClient**: Registered OAuth clients
- **OAuthAuthorizationCode**: Short-lived authorization codes
- **OAuthToken**: Access and refresh tokens

### Environment Variables

```bash
# Required
API_URL=https://your-api.com  # Server URL for OAuth metadata
APP_URL=https://your-app.com  # Frontend URL for consent page

# Optional
JWT_SECRET=...  # Used for signing OAuth tokens
```

### Troubleshooting

#### OAuth flow fails at consent page

1. Ensure `APP_URL` and `API_URL` are correctly set
2. Check that the consent page route exists (`/oauth/consent`)
3. Verify `basePath` is configured correctly if used

#### Token exchange returns "invalid_grant"

1. Authorization codes expire after 10 minutes
2. Codes can only be used once
3. Verify `redirect_uri` matches exactly

#### MCP client can't discover OAuth

1. Check `/.well-known/oauth-authorization-server` returns metadata
2. Verify CORS allows the client origin
3. Ensure OAuth is enabled in config

#### Tools not appearing

1. Verify `exposeTools` includes desired tools
2. Check tool names match the `exposeTools` array
3. Ensure native tools are registered

### Custom MCP Resources

You can expose custom resources via the MCP server. See [Extensions > MCP Resources](./extensions.md#mcp-resources) for details on creating custom resources
