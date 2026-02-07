# Third-Party Installable Extensions for ChaasKit

## Overview

Enable a community extension ecosystem where developers can publish npm packages that add tools, pages, agents, API routes, or other functionality to ChaasKit apps.

## Current State

The extension system works for **local extensions** in the `extensions/` directory:
- Server: `loadExtensions()` globs `extensions/agents/*.ts` and imports them
- Client: Manual import + `clientRegistry.registerPage()`
- Extensions self-register with the singleton registry

**Gaps for npm packages:**
1. No discovery mechanism for `node_modules` packages
2. No manifest/config to declare extensions
3. Client extensions require manual imports (no auto-discovery)
4. Hardcoded paths assume local `extensions/` directory

## Proposed Solution

### 1. Extension Package Convention

Extensions are identified by a `chaaskit` field in `package.json` (no naming convention required):

```json
{
  "name": "my-weather-tools",
  "chaaskit": {
    "type": "extension",
    "server": "./dist/server/index.js",
    "client": "./dist/client/index.js"
  }
}
```

### 2. Configuration in app.config.ts

Users enable extensions in their config:

```typescript
// config/app.config.ts
export default {
  extensions: [
    'chaaskit-weather-tools',
    'chaaskit-slack-notifications',
    {
      package: 'chaaskit-analytics',
      config: { trackingId: 'UA-...' }
    }
  ],
  // ... rest of config
}
```

### 3. Server-Side Loading

Update `loadExtensions()` to also load from npm packages:

```typescript
// packages/server/src/extensions/loader.ts

export async function loadExtensions(basePath: string, config: AppConfig) {
  // 1. Load local extensions (existing behavior)
  await loadLocalExtensions(basePath);

  // 2. Load npm package extensions (NEW)
  for (const ext of config.extensions || []) {
    const packageName = typeof ext === 'string' ? ext : ext.package;
    const extConfig = typeof ext === 'string' ? {} : ext.config;

    await loadPackageExtension(packageName, extConfig);
  }
}

async function loadPackageExtension(packageName: string, config: unknown) {
  // Resolve package.json
  const pkgPath = require.resolve(`${packageName}/package.json`);
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

  if (pkg.chaaskit?.server) {
    const serverEntry = require.resolve(`${packageName}/${pkg.chaaskit.server}`);
    const module = await import(serverEntry);

    // Call register function if exported
    if (module.register) {
      await module.register(registry, config);
    }
  }
}
```

### 4. Client-Side Loading

Generate a virtual module that imports all client extensions:

```typescript
// packages/client/src/extensions/packageLoader.ts

// Called during app initialization
export async function loadPackageExtensions(extensionNames: string[]) {
  for (const name of extensionNames) {
    try {
      // Dynamic import of client entry
      const module = await import(`${name}/client`);
      if (module.register) {
        module.register(clientRegistry);
      }
    } catch (e) {
      console.warn(`Failed to load client extension: ${name}`, e);
    }
  }
}
```

For build-time (Vite), generate imports:

```typescript
// vite.config.ts plugin
function chaaskitExtensionsPlugin(extensions: string[]) {
  return {
    name: 'chaaskit-extensions',
    resolveId(id) {
      if (id === 'virtual:chaaskit-extensions') return id;
    },
    load(id) {
      if (id === 'virtual:chaaskit-extensions') {
        return extensions.map(ext =>
          `import '${ext}/client';`
        ).join('\n');
      }
    }
  };
}
```

### 5. Extension API

**Server Extension Structure:**

```typescript
// chaaskit-weather-tools/src/server/index.ts
import { registry, defineExtension } from '@chaaskit/server';
import type { ExtensionContext } from '@chaaskit/server';

export const register = defineExtension({
  name: 'weather-tools',

  // Called when extension loads
  async setup(ctx: ExtensionContext) {
    // Register MCP tools
    ctx.registerTool({
      name: 'get_weather',
      description: 'Get current weather for a location',
      inputSchema: { /* ... */ },
      handler: async (input) => {
        // Tool implementation
        return { temperature: 72, conditions: 'sunny' };
      }
    });

    // Register custom agent (optional)
    ctx.registerAgent('weather-agent', WeatherAgent);
  },

  // Called on shutdown
  async teardown(ctx: ExtensionContext) {
    // Cleanup
  }
});
```

**Client Extension Structure:**

```typescript
// chaaskit-weather-tools/src/client/index.ts
import { clientRegistry, defineClientExtension } from '@chaaskit/client';

export const register = defineClientExtension({
  name: 'weather-tools',

  setup(ctx) {
    // Register tool result renderer
    ctx.registerToolRenderer('get_weather', WeatherResultCard);

    // Register custom page (optional)
    ctx.registerPage({
      id: 'weather-dashboard',
      path: '/weather',
      label: 'Weather',
      icon: 'Cloud',
      component: WeatherDashboard,
      showInSidebar: true,
    });
  }
});
```

### 6. Extension API Routes

Extensions can expose API functionality in two ways:

**Option A: Direct Route Registration**

Extensions register routes that get mounted under `/api/ext/<extension-name>/`:

```typescript
// chaaskit-weather-tools/src/server/index.ts
export const register = defineExtension({
  name: 'weather-tools',

  async setup(ctx: ExtensionContext) {
    // Register API routes
    ctx.registerRoutes((router) => {
      // Mounted at /api/ext/weather-tools/forecast
      router.get('/forecast', async (req, res) => {
        const { lat, lon } = req.query;
        const forecast = await getForecast(lat, lon);
        res.json(forecast);
      });

      router.post('/alerts/subscribe', async (req, res) => {
        // Uses req.user from auth middleware (automatically applied)
        await subscribeToAlerts(req.user.id, req.body.location);
        res.json({ success: true });
      });
    });
  }
});
```

**Option B: Exported Functions (User Wires Routes)**

Extensions export functions that users can wire into their own routes:

```typescript
// chaaskit-weather-tools/src/server/index.ts
export { getForecast, subscribeToAlerts } from './api/weather';

// User's extensions/routes/weather.ts
import { Router } from 'express';
import { getForecast } from 'chaaskit-weather-tools/server';

const router = Router();
router.get('/weather/forecast', async (req, res) => {
  const forecast = await getForecast(req.query.lat, req.query.lon);
  res.json(forecast);
});

export default router;
```

**User Custom Routes (extensions/routes/)**

Users can add their own routes that use extension functions:

```typescript
// extensions/routes/index.ts - auto-loaded by server
import { Router } from 'express';
import customWeather from './weather';

const router = Router();
router.use('/custom', customWeather);

export default router;
```

### 7. ExtensionContext Full API

```typescript
interface ExtensionContext {
  // Tool registration
  registerTool(tool: ToolDefinition): void;

  // Agent registration
  registerAgent(name: string, agent: typeof BaseAgent): void;

  // MCP resource registration
  registerMCPResource(resource: MCPResourceDefinition): void;

  // API route registration (mounted at /api/ext/<name>/)
  registerRoutes(setup: (router: Router) => void): void;

  // Extension config (from app.config.ts)
  config: unknown;

  // Full app config (read-only)
  appConfig: AppConfig;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (input: unknown, ctx: ToolContext) => Promise<ToolResult>;
  outputTemplate?: string;  // React component for rich results
  requiresConfirmation?: boolean;
}
```

### 8. Example Extension Package

```
chaaskit-weather-tools/
├── package.json
├── src/
│   ├── server/
│   │   ├── index.ts        # register() export
│   │   ├── api/
│   │   │   └── weather.ts  # Exported functions
│   │   └── tools/
│   │       └── weather.ts  # Tool implementation
│   └── client/
│       ├── index.ts        # register() export
│       └── components/
│           └── WeatherCard.tsx  # Result renderer
├── dist/                   # Built output
└── tsconfig.json
```

**package.json:**
```json
{
  "name": "chaaskit-weather-tools",
  "version": "1.0.0",
  "chaaskit": {
    "type": "extension",
    "server": "./dist/server/index.js",
    "client": "./dist/client/index.js"
  },
  "exports": {
    "./server": "./dist/server/index.js",
    "./client": "./dist/client/index.js"
  },
  "peerDependencies": {
    "@chaaskit/server": "^1.0.0",
    "@chaaskit/client": "^1.0.0"
  }
}
```

## Implementation Phases

### Phase 1: Extension Types & Config (1 week)
- Add `extensions` field to AppConfig type
- Create ExtensionDefinition types in shared
- Add permission types and validation
- Create config schema validation (JSON Schema)
- Update config loader to parse extensions array

### Phase 2: Server Extension Loading (1 week)
- Create `ExtensionContext` class with permission checks
- Create `defineExtension()` helper
- Update `loadExtensions()` to load npm packages
- Add `registerTool()` method to context (namespaced)
- Implement permission validation on load
- Export new APIs from @chaaskit/server

### Phase 3: Security Infrastructure (1 week)
- Implement scoped database access (not raw Prisma)
- Implement network request proxy with logging
- Add audit logging for extension actions
- Implement circuit breaker for failing extensions
- Add extension load failure handling (graceful degradation)

### Phase 4: Client Extension Loading (1 week)
- Create `ClientExtensionContext` class (restricted)
- Create `defineClientExtension()` helper
- Create Vite plugin for extension imports
- Add ErrorBoundary wrapper for extension components
- Create `loadPackageExtensions()` function
- Export new APIs from @chaaskit/client

### Phase 5: Extension API Routes (1 week)
- Add `registerRoutes()` to ExtensionContext
- Mount extension routes at `/api/ext/<name>/`
- Apply auth middleware automatically
- Apply rate limiting per extension
- Add request logging with extension context
- Add user custom routes loading from `extensions/routes/`

### Phase 6: Tool Registration System (1 week)
- Unify native tools and extension tools
- Namespace tools by extension
- Add tool output templates support
- Connect to MCP tool execution flow
- Add tool result UI rendering with sanitization

### Phase 7: Testing & Documentation (1 week)
- Create `@chaaskit/testing` package
- Create `docs/extensions-development.md`
- Create `docs/extension-security.md`
- Create example extension package
- Add to create-chaaskit templates
- Document permission model and best practices

## Files to Modify

**packages/shared:**
- `src/types/config.ts` - Add extensions config
- `src/types/extensions.ts` - NEW (types, permissions)
- `src/types/extension-permissions.ts` - NEW (permission enum/types)
- `src/validation/extension-config.ts` - NEW (config schema validation)

**packages/server:**
- `src/extensions/loader.ts` - Add npm loading + user routes + error handling
- `src/extensions/context.ts` - NEW (includes registerRoutes, permission checks)
- `src/extensions/define.ts` - NEW
- `src/extensions/permissions.ts` - NEW (permission validation)
- `src/extensions/scoped-db.ts` - NEW (restricted database access)
- `src/extensions/circuit-breaker.ts` - NEW (failure handling)
- `src/extensions/audit.ts` - NEW (extension action logging)
- `src/app.ts` - Mount extension routes at /api/ext/*
- `src/middleware/extension-rate-limit.ts` - NEW
- `src/index.ts` - Export APIs

**packages/client:**
- `src/extensions/packageLoader.ts` - NEW
- `src/extensions/context.ts` - NEW (restricted context)
- `src/extensions/define.ts` - NEW
- `src/extensions/Sandbox.tsx` - NEW (ErrorBoundary wrapper)
- `vite.config.lib.ts` - Add plugin
- `src/index.ts` - Export APIs

**packages/testing:** - NEW PACKAGE
- `src/index.ts` - Export test utilities
- `src/test-context.ts` - createTestContext()
- `src/mocks.ts` - mockTool, mockFetch, etc.

**packages/create-chaaskit:**
- `src/templates/extensions/routes/` - NEW template directory

**docs:**
- `docs/extensions-development.md` - NEW (full guide)
- `docs/extensions-api.md` - NEW (API route guide)
- `docs/extension-security.md` - NEW (security model, permissions)
- `docs/extension-testing.md` - NEW (testing guide)

## Security Model

### Permission System

Extensions declare required permissions in their manifest:

```json
{
  "name": "chaaskit-weather-tools",
  "chaaskit": {
    "type": "extension",
    "server": "./dist/server/index.js",
    "client": "./dist/client/index.js",
    "permissions": [
      "tools:register",
      "routes:register",
      "database:read",
      "network:external"
    ]
  }
}
```

**Available Permissions:**

| Permission | Description |
|------------|-------------|
| `tools:register` | Register native tools |
| `tools:execute` | Execute other tools |
| `routes:register` | Add API routes |
| `database:read` | Read from database (via provided API, not raw Prisma) |
| `database:write` | Write to database |
| `network:external` | Make outbound HTTP requests |
| `storage:read` | Read from S3/storage |
| `storage:write` | Write to S3/storage |
| `users:read` | Access user data |
| `config:read` | Read app config |

Users must approve permissions when adding extensions:

```typescript
// config/app.config.ts
extensions: [
  {
    package: 'chaaskit-weather-tools',
    permissions: ['tools:register', 'network:external'], // Explicit approval
    config: { apiKey: '...' }
  }
]
```

### Extension Context Restrictions

```typescript
interface ExtensionContext {
  // Scoped database access (not raw Prisma)
  db: {
    // Only if 'database:read' permission granted
    query<T>(model: string, where: object): Promise<T[]>;
    findOne<T>(model: string, id: string): Promise<T | null>;

    // Only if 'database:write' permission granted
    create<T>(model: string, data: object): Promise<T>;
    update<T>(model: string, id: string, data: object): Promise<T>;
  };

  // Scoped network access (only if 'network:external' granted)
  fetch: typeof fetch; // Proxy that logs all requests

  // Read-only, frozen copy of config
  appConfig: Readonly<AppConfig>;

  // Extension's own config (validated against schema if provided)
  config: ExtensionConfig;
}
```

### API Route Security

Extension routes automatically receive:

```typescript
ctx.registerRoutes((router) => {
  // All routes automatically have:
  // - Authentication middleware (req.user available)
  // - Rate limiting (100 req/min per user per extension)
  // - Request logging with extension context
  // - Input sanitization middleware

  router.post('/action', async (req, res) => {
    // req.user guaranteed if route requires auth
    // req.body sanitized
  });
});
```

Extensions can opt-out of auth for specific routes:

```typescript
router.get('/public-data', { auth: false }, handler);
```

### Audit Logging

All extension actions are logged:

```typescript
// Automatic logging
{
  event: 'extension.tool_execute',
  extension: 'chaaskit-weather-tools',
  tool: 'get_weather',
  userId: 'user_123',
  timestamp: '2024-...',
  duration: 150,
  success: true
}

{
  event: 'extension.route_access',
  extension: 'chaaskit-weather-tools',
  path: '/api/ext/weather-tools/forecast',
  method: 'GET',
  userId: 'user_123',
  ip: '...'
}

{
  event: 'extension.network_request',
  extension: 'chaaskit-weather-tools',
  url: 'https://api.weather.com/...',
  method: 'GET'
}
```

### Client-Side Isolation

Client extensions run in a restricted context:

```typescript
interface ClientExtensionContext {
  // No direct access to auth tokens
  // No access to localStorage/sessionStorage
  // No access to document.cookie

  // Provided APIs only:
  currentUser: { id: string; email: string }; // Limited user info
  theme: ThemeContext;
  navigate: (path: string) => void;

  // Component rendering must use provided wrapper
  registerToolRenderer(name: string, component: React.FC<ToolResultProps>);
}
```

Tool result renderers are wrapped in an error boundary and sanitized:

```typescript
<ExtensionSandbox extension="weather-tools">
  <ErrorBoundary fallback={<ToolResultFallback />}>
    <WeatherResultCard {...props} />
  </ErrorBoundary>
</ExtensionSandbox>
```

---

## Conflict Resolution

### Tool Name Conflicts

Tools are namespaced by extension:

```typescript
// Internal tool name: weather-tools:get_weather
ctx.registerTool({
  name: 'get_weather', // User sees this
  // ...
});

// If conflict, later extension fails to load with clear error
// Error: Tool 'get_weather' already registered by 'other-extension'
```

### Route Conflicts

Routes are already namespaced: `/api/ext/<extension-name>/...`

### Load Order

Extensions load in config order. Explicit ordering:

```typescript
extensions: [
  { package: 'base-extension', priority: 0 },   // Loads first
  { package: 'dependent-ext', priority: 10 },   // Loads after
]
```

---

## Versioning & Compatibility

### API Stability

```typescript
// @chaaskit/server exports versioned context
import { ExtensionContextV1 } from '@chaaskit/server';

// Extensions declare minimum version
{
  "chaaskit": {
    "minVersion": "1.0.0",
    "apiVersion": "v1"
  }
}
```

### Breaking Changes

ChaasKit follows semver for extension APIs:
- Patch: Bug fixes, no API changes
- Minor: New APIs added, existing APIs unchanged
- Major: Breaking changes, migration guide provided

### Deprecation

```typescript
// Deprecated APIs warn but continue working
ctx.registerTool(...); // Warns: "registerTool is deprecated, use registerNativeTool"
```

---

## Error Handling

### Extension Load Failures

```typescript
// Extension fails to load
{
  error: 'Extension chaaskit-weather-tools failed to load',
  reason: 'Missing required permission: network:external',
  action: 'Extension disabled. Add permission to config to enable.'
}

// App continues without failed extension
// Admin notified via configured channel
```

### Runtime Failures

```typescript
// Tool execution failure
try {
  result = await extension.tool.handler(input);
} catch (error) {
  // Log with extension context
  audit.log({
    event: 'extension.tool_error',
    extension: 'weather-tools',
    tool: 'get_weather',
    error: error.message,
    // Stack trace NOT exposed to user
  });

  // Return safe error to user
  return {
    isError: true,
    content: 'Weather tool temporarily unavailable',
  };
}
```

### Circuit Breaker

Extensions that fail repeatedly are disabled:

```typescript
// After 5 failures in 1 minute, extension is suspended
{
  event: 'extension.suspended',
  extension: 'chaaskit-weather-tools',
  reason: 'Too many failures (5 in 60s)',
  resumeAt: '2024-... +5 minutes'
}
```

---

## Configuration Validation

Extensions can declare config schema:

```json
{
  "chaaskit": {
    "configSchema": {
      "type": "object",
      "required": ["apiKey"],
      "properties": {
        "apiKey": { "type": "string", "minLength": 10 },
        "units": { "type": "string", "enum": ["metric", "imperial"], "default": "metric" }
      }
    }
  }
}
```

Config is validated on load:

```typescript
// Invalid config
extensions: [
  { package: 'chaaskit-weather-tools', config: { apiKey: 'short' } }
]
// Error: Extension config validation failed:
//   apiKey: String must be at least 10 characters
```

---

## Testing Utilities

```typescript
// @chaaskit/testing package
import { createTestContext, mockTool } from '@chaaskit/testing';

describe('Weather Extension', () => {
  it('registers get_weather tool', async () => {
    const ctx = createTestContext();
    await register(ctx);

    expect(ctx.tools).toContainKey('get_weather');
  });

  it('handles API errors gracefully', async () => {
    const ctx = createTestContext({
      fetch: mockFetch({ status: 500 })
    });

    const result = await ctx.tools['get_weather'].handler({ city: 'NYC' });
    expect(result.isError).toBe(true);
  });
});
```

---

## Verification

### Functional Tests
1. Create test extension package locally
2. Install in test project with `pnpm add ./path/to/extension`
3. Add to `config/app.config.ts` extensions array
4. Verify server tool registers and executes
5. Verify client component renders tool results
6. Verify page appears in sidebar
7. Verify extension API routes work at `/api/ext/<name>/`
8. Test extension config passes through
9. Test user custom routes with extension functions
10. Test extension uninstall/removal

### Security Tests
11. Verify extension without permission cannot access database
12. Verify extension cannot access raw Prisma client
13. Verify extension network requests are logged
14. Verify extension cannot read other users' data
15. Verify auth middleware is applied to extension routes
16. Verify rate limiting works per extension
17. Verify circuit breaker disables failing extension
18. Verify client extension cannot access auth tokens
19. Verify tool name conflicts are handled (clear error)
20. Verify invalid config schema fails with helpful error

### Error Handling Tests
21. Test extension load failure (missing permission)
22. Test extension runtime failure (tool throws)
23. Test graceful degradation (app works without failed extension)
24. Test circuit breaker recovery after timeout
25. Test client component error boundary
