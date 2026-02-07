# MCP Server Implementation Summary

Completed: 2026-01-25

## Overview

Added an MCP server to chaaskit, allowing external MCP clients (Claude Desktop, MCP Inspector, OpenAI, etc.) to connect and use tools provided by this application.

## Features Implemented

### Authentication
- **API Key Auth**: Uses existing API key system with Bearer tokens
- **OAuth 2.1 with PKCE**: Full OAuth flow for MCP clients
- **Dynamic Client Registration**: RFC 7591 compliant

### MCP Protocol Support
- JSON-RPC 2.0 endpoint at `POST /mcp`
- Methods: `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `ping`
- RFC 9728 protected resource metadata at `/mcp/.well-known/oauth-protected-resource`

### OAuth 2.1 Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/oauth-authorization-server` | GET | RFC 8414 metadata |
| `/oauth/register` | POST | Dynamic client registration |
| `/oauth/authorize` | GET/POST | Authorization with consent |
| `/oauth/token` | POST | Token exchange/refresh |
| `/oauth/revoke` | POST | Token revocation |
| `/api/oauth/apps` | GET | List user's authorized apps |
| `/api/oauth/apps/:clientId` | DELETE | Revoke app access |

### Extension Support
- Extensions can register MCP resources via `registry.register('mcp-resource', ...)`
- Extensions can register tools via `registerNativeTool()` (existing)
- Auto-discovery from `extensions/mcp-resources/` directory

### Client UI
- OAuth consent page at `/oauth/consent`
- Connected Applications section in Settings modal
- Revoke access functionality

## Files Created

### Server
- `packages/server/src/mcp/server.ts` - MCP JSON-RPC handler
- `packages/server/src/middleware/mcpServerAuth.ts` - Auth middleware
- `packages/server/src/api/mcp-server.ts` - MCP route
- `packages/server/src/oauth/server.ts` - OAuth 2.1 logic
- `packages/server/src/api/oauth.ts` - OAuth endpoints

### Client
- `packages/client/src/pages/OAuthConsentPage.tsx` - OAuth consent UI
- `packages/client/src/components/OAuthAppsSection.tsx` - Apps management

## Files Modified

- `packages/db/prisma/schema/base.prisma` - Added OAuthClient, OAuthAuthorizationCode, OAuthToken models
- `packages/shared/src/types/mcp.ts` - Added MCPServerExportConfig, MCPServerOAuthConfig
- `packages/shared/src/types/config.ts` - Added `server` to MCPConfig
- `packages/server/src/app.ts` - Registered MCP and OAuth routes
- `packages/server/src/registry/index.ts` - Added `mcp-resource` category, BaseMCPResource
- `packages/server/src/extensions/loader.ts` - Added mcp-resources path
- `packages/client/src/components/SettingsModal.tsx` - Added OAuthAppsSection
- `packages/client/src/App.tsx` - Added /oauth/consent route

## Configuration

Enable in `config/app.config.ts`:

```typescript
mcp: {
  servers: [],
  allowUserServers: false,
  toolTimeout: 30000,
  server: {
    enabled: true,
    exposeTools: 'native',  // 'all' | 'native' | string[]
    oauth: {
      enabled: true,
      allowDynamicRegistration: true,
      accessTokenTTLSeconds: 3600,
      refreshTokenTTLSeconds: 2592000, // 30 days
    },
  },
},
```

Also add `/mcp/**` to `api.allowedEndpoints` for API key access.

## Usage Examples

### Test with curl

```bash
# Initialize
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Call a tool
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get-plan-usage","arguments":{}}}'
```

### Dynamic Client Registration

```bash
curl -X POST http://localhost:3000/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My MCP Client",
    "redirect_uris": ["http://localhost:8080/callback"],
    "grant_types": ["authorization_code", "refresh_token"]
  }'
```

## Creating MCP Resource Extensions

```typescript
// extensions/mcp-resources/my-resource.ts
import { registry, BaseMCPResource } from '@chaaskit/server';

class MyResource extends BaseMCPResource {
  uri = 'myapp://my-resource';
  name = 'My Resource';
  description = 'A custom MCP resource';
  mimeType = 'application/json';

  async read(context: { userId?: string }) {
    return {
      text: JSON.stringify({ hello: 'world' }),
    };
  }
}

registry.register('mcp-resource', 'my-resource', new MyResource());
```

## Security Notes

- All MCP requests require authentication (API key or OAuth token)
- OAuth uses PKCE (S256) for authorization code flow
- Tokens are hashed with SHA-256 before storage
- Client secrets (if used) are hashed with bcrypt
- 401 responses include `WWW-Authenticate` header with authorization server URL
