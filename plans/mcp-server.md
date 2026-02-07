# MCP Server Implementation Plan

## Overview

Add an MCP server to chaaskit, allowing external MCP clients (Claude Desktop, MCP Inspector, OpenAI, etc.) to connect and use tools provided by this application.

## Phases

### Phase 1: Core MCP Server with API Key Auth (3 days)

#### 1.1 Database Schema
**File:** `packages/db/prisma/schema/base.prisma`

Add OAuth models (needed for Phase 2, but add now to avoid migration later):

```prisma
model OAuthClient {
  id                String    @id @default(cuid())
  clientId          String    @unique
  clientSecretHash  String?   // bcrypt hash (confidential clients only)
  clientName        String
  clientUri         String?
  redirectUris      String    // JSON array
  grantTypes        String    @default("[\"authorization_code\",\"refresh_token\"]")
  tokenEndpointAuth String    @default("none")
  userId            String?
  user              User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt         DateTime  @default(now())
  tokens            OAuthToken[]
  authCodes         OAuthAuthorizationCode[]
  @@index([clientId])
}

model OAuthAuthorizationCode {
  id              String      @id @default(cuid())
  code            String      @unique
  clientId        String
  client          OAuthClient @relation(fields: [clientId], references: [id], onDelete: Cascade)
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  redirectUri     String
  scope           String?
  codeChallenge   String
  codeChallengeMethod String  @default("S256")
  expiresAt       DateTime
  createdAt       DateTime    @default(now())
  @@index([code])
}

model OAuthToken {
  id               String      @id @default(cuid())
  tokenHash        String      @unique
  refreshTokenHash String?     @unique
  clientId         String
  client           OAuthClient @relation(fields: [clientId], references: [id], onDelete: Cascade)
  userId           String
  user             User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  scope            String?
  expiresAt        DateTime
  refreshExpiresAt DateTime?
  revokedAt        DateTime?
  createdAt        DateTime    @default(now())
  @@index([tokenHash])
  @@index([userId])
}
```

Add relations to User model.

#### 1.2 Configuration Types
**File:** `packages/shared/src/types/config.ts`

```typescript
export interface MCPServerConfig {
  enabled: boolean;
  exposeTools?: 'all' | 'native' | string[];
}

export interface MCPServerOAuthConfig {
  enabled: boolean;
  allowDynamicRegistration: boolean;
  accessTokenTTLSeconds?: number;  // default 3600
  refreshTokenTTLSeconds?: number; // default 30 days
}

// In MCPConfig:
server?: MCPServerConfig & {
  oauth?: MCPServerOAuthConfig;
};
```

#### 1.3 MCP Server Handler
**New file:** `packages/server/src/mcp/server.ts`

JSON-RPC 2.0 handler implementing MCP protocol:
- `initialize` - Return server info and capabilities
- `tools/list` - Return available tools (native + extension-registered tools)
- `tools/call` - Execute a tool
- `resources/list` - Return available resources (from extensions)
- `resources/read` - Read a resource
- `ping` - Health check

Key function: `nativeToolsToMCPTools()` - Convert native tools to MCP format.

**Important:** Uses `getAllNativeTools()` from `tools/index.ts` which includes both built-in tools AND any tools registered via `registerNativeTool()` by extensions. This means extensions that already register tools will automatically have them exposed via MCP.

#### 1.4 MCP Server Auth Middleware
**New file:** `packages/server/src/middleware/mcpServerAuth.ts`

- Check `Authorization: Bearer <token>` header
- Try API key validation first (reuse logic from `apiKeyAuth.ts`)
- Return 401 with `WWW-Authenticate` header if not authorized
- Phase 2 adds OAuth token validation

#### 1.5 MCP Server Route
**New file:** `packages/server/src/api/mcp-server.ts`

- `POST /mcp` - JSON-RPC endpoint (requires auth)
- `GET /mcp/.well-known/oauth-protected-resource` - RFC 9728 metadata

**Modify:** `packages/server/src/app.ts` - Register route

---

### Phase 2: OAuth 2.1 Server (3 days)

#### 2.1 OAuth Server Module
**New file:** `packages/server/src/oauth/server.ts`

Core OAuth logic:
- `generateAuthorizationCode()` - Create auth code with PKCE
- `exchangeCodeForTokens()` - Validate code, return access/refresh tokens
- `refreshAccessToken()` - Issue new access token
- `revokeToken()` - Revoke access/refresh token
- `validateAccessToken()` - Validate and return token info

Use `bcrypt` for hashing tokens (consistent with API keys).

#### 2.2 OAuth Endpoints
**New file:** `packages/server/src/api/oauth.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/oauth-authorization-server` | GET | RFC 8414 metadata |
| `/oauth/register` | POST | RFC 7591 dynamic client registration |
| `/oauth/authorize` | GET/POST | Authorization endpoint (user consent) |
| `/oauth/token` | POST | Token exchange/refresh |
| `/oauth/revoke` | POST | Token revocation |
| `/api/oauth/apps` | GET | List user's authorized apps |
| `/api/oauth/apps/:clientId` | DELETE | Revoke app access |

#### 2.3 OAuth Consent Page
**New file:** `packages/client/src/pages/OAuthConsentPage.tsx`

Shows client name, requested scopes, approve/deny buttons.

#### 2.4 Update MCP Auth Middleware

Add OAuth token validation to `mcpServerAuth.ts`.

---

### Phase 3: MCP Resource Extensions (1 day)

**Note on Tools:** Extensions can already register tools via `registerNativeTool()` (see `packages/server/src/tools/index.ts`). These are automatically picked up by `getAllNativeTools()` and will be exposed via MCP. No changes needed for tool extensions.

#### 3.1 Registry Category for Resources
**Modify:** `packages/server/src/registry/index.ts`

Add `'mcp-resource'` category and `BaseMCPResource` base class:

```typescript
export abstract class BaseMCPResource {
  abstract uri: string;
  abstract name: string;
  abstract description?: string;
  abstract mimeType?: string;
  abstract read(context: { userId?: string }): Promise<{ text?: string; blob?: string }>;
}
```

#### 3.2 Extension Loader
**Modify:** `packages/server/src/extensions/loader.ts`

Add `extensions/mcp-resources/` to auto-discovery paths.

#### 3.3 MCP Server Integration

Update `resources/list` and `resources/read` in server.ts to use registry.

#### 3.4 Document Extension Pattern
Update `docs/extensions.md` with MCP resource extension example.

---

### Phase 4: Client UI (1 day)

#### 4.1 OAuth Apps in Settings
**New file:** `packages/client/src/components/OAuthAppsSection.tsx`

- List connected OAuth applications
- Show client name, authorized date, scopes
- Revoke access button

**Modify:** `packages/client/src/components/SettingsModal.tsx`

Add OAuth apps section (when `config.mcp?.server?.oauth?.enabled`).

---

## File Summary

### New Files
- `packages/server/src/mcp/server.ts` - MCP server handler
- `packages/server/src/middleware/mcpServerAuth.ts` - MCP auth middleware
- `packages/server/src/api/mcp-server.ts` - MCP server route
- `packages/server/src/oauth/server.ts` - OAuth server logic
- `packages/server/src/api/oauth.ts` - OAuth endpoints
- `packages/client/src/pages/OAuthConsentPage.tsx` - Consent UI
- `packages/client/src/components/OAuthAppsSection.tsx` - Apps management

### Modified Files
- `packages/db/prisma/schema/base.prisma` - Add OAuth models
- `packages/shared/src/types/config.ts` - Add MCP server config types
- `packages/server/src/app.ts` - Register routes
- `packages/server/src/registry/index.ts` - Add mcp-resource category
- `packages/server/src/extensions/loader.ts` - Add mcp-resources path
- `packages/client/src/components/SettingsModal.tsx` - Add OAuth apps
- `packages/client/src/App.tsx` - Add consent route

---

## Verification

### Phase 1 Testing
1. Configure `mcp.server.enabled: true` in app.config.ts
2. Create an API key via UI
3. Test with MCP Inspector or curl:
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Authorization: Bearer sk-..." \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
   ```
4. Verify `tools/list` returns native tools
5. Verify `tools/call` executes a tool

### Phase 2 Testing
1. Enable OAuth: `mcp.server.oauth.enabled: true`
2. Test dynamic client registration via curl
3. Complete OAuth flow manually or with MCP Inspector
4. Verify tokens work for MCP requests
5. Test revocation via UI

### Phase 3 Testing
1. Create `extensions/mcp-resources/test-resource.ts`
2. Verify it appears in `resources/list`
3. Verify `resources/read` returns content

### Phase 4 Testing
1. Authorize an OAuth app
2. Verify it appears in Settings > Connected Applications
3. Revoke and verify access is removed
