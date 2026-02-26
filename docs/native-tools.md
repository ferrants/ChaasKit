# Native Tools

Native tools are built-in tools that run directly in your application, without requiring external MCP servers. They provide capabilities like web scraping, file processing, or custom integrations that are part of your core server.

## Overview

Unlike MCP tools (which connect to external servers), native tools:
- Run in the same process as your server
- Have no external dependencies
- Are opt-in per agent (must be explicitly enabled)
- Use the `native:` prefix in configuration
- Can declaratively require per-user or per-team credentials (see [Credential-Backed Tools](#credential-backed-tools))

## Available Native Tools

| Tool | Description | Widget | Custom Renderer |
|------|-------------|--------|-----------------|
| `web-scrape` | Fetches a URL and returns the content as plain text. Supports HTML, JSON, and plain text responses. | No | No |
| `get-plan-usage` | Returns the current user's plan information and usage statistics. | Yes | No |
| `list_documents` | Lists documents accessible to the current user (personal, team, project). | No | Yes |
| `read_document` | Reads document content with pagination support. | No | Yes |
| `search_in_document` | Searches text within a document, returning matching lines with context. | No | Yes |
| `save_document` | Saves content as a new document for the current user. | No | Yes |

## Configuration

Native tools are enabled per-agent using the `allowedTools` configuration:

```typescript
// config/app.config.ts
agent: {
  agents: [
    {
      id: 'general',
      name: 'General Assistant',
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a helpful assistant.',
      maxTokens: 4096,
      isDefault: true,
      // No allowedTools = all MCP tools, but NO native tools
    },
    {
      id: 'research-assistant',
      name: 'Research Assistant',
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: 'You are a research assistant that can fetch and analyze web content.',
      maxTokens: 8192,
      // Enable native web-scrape tool + all tools from a specific MCP server
      allowedTools: ['native:web-scrape', 'search-server:*'],
    },
  ],
}
```

### Tool Pattern Syntax

- `native:*` - All native tools
- `native:tool-name` - Specific native tool (e.g., `native:web-scrape`)
- `mcp-server:*` - All tools from an MCP server
- `mcp-server:tool-name` - Specific tool from an MCP server

### Default Behavior

- **No `allowedTools`**: Agent has access to all MCP tools but NO native tools
- **With `allowedTools`**: Agent only has access to tools matching the specified patterns

## Creating Custom Native Tools

You can create your own native tools in your project and register them at runtime using `registerNativeTool()` from `@chaaskit/server`.

### Step 1: Create the Tool File

Create a new file in your project's `extensions/` directory (or anywhere in your project):

```typescript
// extensions/agents/weather-tool.ts
import { registerNativeTool } from '@chaaskit/server';
import type { NativeTool, ToolResult, ToolContext } from '@chaaskit/server';

const weatherTool: NativeTool = {
  name: 'get-weather',

  description: 'Gets the current weather for a given city. Returns temperature, conditions, and forecast.',

  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'The city name to get weather for',
      },
      units: {
        type: 'string',
        description: 'Temperature units: "celsius" or "fahrenheit"',
        default: 'celsius',
      },
    },
    required: ['city'],
  },

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const city = input.city as string;
    const units = (input.units as string) || 'celsius';

    try {
      const response = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${encodeURIComponent(city)}`
      );
      const data = await response.json();

      const temp = units === 'fahrenheit' ? data.current.temp_f : data.current.temp_c;
      const text = `Weather in ${city}: ${temp}° ${units}, ${data.current.condition.text}`;

      return {
        content: [{ type: 'text', text }],
        // Optional: structured data for a custom client renderer
        structuredContent: {
          city,
          temperature: temp,
          units,
          condition: data.current.condition.text,
          icon: data.current.condition.icon,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Error fetching weather: ${message}` }],
        isError: true,
      };
    }
  },
};

// Register the tool - it becomes available immediately
registerNativeTool(weatherTool);
```

The tool file is automatically loaded by ChaasKit's extension loader when it's placed in `extensions/agents/`. Alternatively, you can import it explicitly in a custom server entry point.

### Step 2: Configure Agent Access

Enable the tool for agents that should have access:

```typescript
// config/app.config.ts
{
  id: 'my-agent',
  name: 'My Agent',
  // ...
  allowedTools: ['native:get-weather'],
  // Or use 'native:*' to enable all native tools
}
```

### Step 3 (Optional): Add a Custom Client Renderer

If your tool returns `structuredContent`, you can create a React component to render it in the chat UI. See [Custom Tool Renderers](#custom-tool-renderers) below.

### How Extension Loading Works

Server extensions in `extensions/agents/` are automatically imported when the server starts. Each file should call `registerNativeTool()` at the top level so the tool is registered as a side effect of the import. This is the same pattern used for custom agents (which call `registry.register('agent', ...)`).

If you need more control over loading order, you can use a custom server entry point and import the tool file explicitly:

```typescript
// src/server.ts
import { createApp } from '@chaaskit/server';
import './my-tools/weather.js'; // Registers the tool on import

const app = await createApp();
```

## Credential-Backed Tools

Native tools can declaratively require per-user or per-team credentials. The platform handles encrypted storage, settings UI, and automatic credential resolution — reusing the same infrastructure as MCP server credentials.

This is useful when building tools that call third-party APIs (Jira, Slack, GitHub, etc.) where each user or team needs their own credentials.

### How It Works

1. Register a **credential config** with `registerNativeCredential()` — defines what credential is needed
2. Register **tools** with `credentialId` referencing the config — tools get credentials auto-injected
3. The credential appears in **User Settings** or **Team Settings** alongside MCP credentials
4. At execution, the platform looks up, decrypts, and passes the credential via `context.credential`
5. Tools with missing credentials are **hidden from the LLM** (or return an error, configurable)

### Example: Jira Integration

```typescript
// extensions/agents/jira.ts
import { registerNativeCredential, registerNativeTool } from '@chaaskit/server';

// 1. Register the credential requirement (one per integration)
registerNativeCredential({
  id: 'jira',
  name: 'Jira',
  authMode: 'team-apikey',
  userInstructions: 'Enter your Jira API token (Atlassian Settings > API tokens)',
});

// 2. Register tools that reference it
registerNativeTool({
  name: 'jira-create-issue',
  description: 'Create a Jira issue',
  credentialId: 'jira',  // References the credential config above
  inputSchema: {
    type: 'object',
    properties: {
      project: { type: 'string', description: 'Project key (e.g., PROJ)' },
      summary: { type: 'string', description: 'Issue title' },
    },
    required: ['project', 'summary'],
  },
  async execute(input, context) {
    // context.credential is auto-populated with decrypted data
    const { apiKey } = context.credential!;
    const res = await fetch('https://yoursite.atlassian.net/rest/api/3/issue', {
      headers: {
        Authorization: `Basic ${Buffer.from(`email@example.com:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        fields: {
          project: { key: input.project as string },
          summary: input.summary as string,
          issuetype: { name: 'Task' },
        },
      }),
    });
    return { content: [{ type: 'text', text: await res.text() }] };
  },
});

// Multiple tools can share the same credential
registerNativeTool({
  name: 'jira-search',
  description: 'Search Jira issues with JQL',
  credentialId: 'jira',
  inputSchema: {
    type: 'object',
    properties: {
      jql: { type: 'string', description: 'JQL query string' },
    },
    required: ['jql'],
  },
  async execute(input, context) {
    const { apiKey } = context.credential!;
    // ... search implementation
    return { content: [{ type: 'text', text: 'results...' }] };
  },
});
```

### NativeCredentialConfig

```typescript
interface NativeCredentialConfig {
  /** Unique ID (used as serverId in MCPCredential table) */
  id: string;
  /** Display name in settings UI (e.g., "Jira", "Slack") */
  name: string;
  /** Authentication mode */
  authMode: MCPAuthMode;  // 'user-apikey' | 'user-oauth' | 'team-apikey' | 'team-oauth'
  /** Help text shown to users in settings */
  userInstructions?: string;
  /** OAuth configuration (required for oauth auth modes) */
  oauth?: MCPOAuthConfig;
  /** When credential is missing: 'hide' removes tool from LLM, 'error' returns error on use. Default: 'hide' */
  whenMissing?: 'hide' | 'error';
}
```

### Authentication Modes

All four MCP auth modes are supported:

| Mode | Scope | Configured by | Shows in |
|------|-------|---------------|----------|
| `user-apikey` | Per user | Each user | User Settings |
| `user-oauth` | Per user | Each user | User Settings |
| `team-apikey` | Per team | Team admin | Team Settings |
| `team-oauth` | Per team | Team admin | Team Settings |

### Missing Credential Behavior

The `whenMissing` option controls what happens when a tool's credential is not configured:

- **`'hide'`** (default): Tool is excluded from the LLM's tool list. The AI won't know the tool exists.
- **`'error'`**: Tool is included but returns a helpful error when called, e.g., *"Jira is not connected. Please configure it in Team Settings."*

For full details, see [MCP Integration > Native Tool Credentials](./mcp.md#native-tool-credentials).

## Type Definitions

### NativeTool

```typescript
interface NativeTool {
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
```

### NativeToolMeta

Metadata for configuring tool widgets:

```typescript
interface NativeToolMeta {
  /** Inline HTML template for widget rendering */
  'ui/template'?: string;

  /** File path relative to tools/templates/ for widget rendering */
  'ui/templateFile'?: string;

  /** Additional metadata keys */
  [key: string]: unknown;
}
```

### ToolContext

The context object passed to every tool execution:

```typescript
interface ToolContext {
  userId?: string;    // Current user's ID (if authenticated)
  threadId?: string;  // Current thread ID
  agentId?: string;   // Current agent ID
  teamId?: string;    // Current team ID (if team thread)
  credential?: ResolvedCredential;  // Auto-populated if tool has credentialId
}

interface ResolvedCredential {
  apiKey?: string;       // For apikey auth modes
  accessToken?: string;  // For oauth auth modes
  refreshToken?: string;
  tokenType?: string;
}
```

### ToolResult

The result returned from tool execution:

```typescript
interface ToolResult {
  content: MCPContentItem[];  // Array of content items (text, images, etc.)
  isError?: boolean;          // Set to true if the tool encountered an error
  structuredContent?: Record<string, unknown>;  // Structured data for widget rendering
}

// Content item types
type MCPContentItem =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; text?: string; blob?: string } };
```

## Example: Web Scrape Tool

Here's the built-in `web-scrape` tool as a reference implementation:

```typescript
// packages/server/src/tools/web-scrape.ts
export const webScrapeTool: NativeTool = {
  name: 'web-scrape',

  description: 'Fetches the content of a web page and returns it as plain text.',

  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL of the web page to fetch',
      },
      maxLength: {
        type: 'number',
        description: 'Maximum characters to return (default: 50000)',
        default: 50000,
      },
    },
    required: ['url'],
  },

  async execute(input: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const url = input.url as string;
    const maxLength = (input.maxLength as number) || 50000;

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return {
        content: [{ type: 'text', text: `Invalid URL: ${url}` }],
        isError: true,
      };
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        content: [{ type: 'text', text: `Invalid protocol: ${parsedUrl.protocol}` }],
        isError: true,
      };
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ChatBot/1.0)',
        },
      });

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: `HTTP error: ${response.status}` }],
          isError: true,
        };
      }

      const html = await response.text();
      const text = htmlToText(html);  // Convert HTML to plain text

      return {
        content: [{ type: 'text', text: truncateText(text, maxLength) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to fetch: ${error.message}` }],
        isError: true,
      };
    }
  },
};
```

## Widget Support

Native tools can render rich UI widgets instead of plain text output. This is useful for displaying structured data like charts, forms, or interactive components.

### How Widgets Work

1. Tool returns `structuredContent` with data for the widget
2. Tool specifies an HTML template via `_meta`
3. Template is rendered in a sandboxed iframe
4. Template accesses data via `window.openai` global object

### Creating a Tool with a Widget

#### Step 1: Add `_meta` to Your Tool

Specify a template using either inline HTML or a file reference:

```typescript
// Using a template file (recommended for complex widgets)
export const myTool: NativeTool = {
  name: 'my-tool',
  description: 'Does something useful',
  inputSchema: { type: 'object', properties: {}, required: [] },
  _meta: {
    'ui/templateFile': 'my-tool.html',  // Relative to tools/templates/
  },
  async execute(input, context) {
    // ...
  },
};

// Using inline HTML (for simple widgets)
export const simpleTool: NativeTool = {
  name: 'simple-tool',
  _meta: {
    'ui/template': '<div id="output"></div><script>document.getElementById("output").textContent = JSON.stringify(window.openai.toolOutput);</script>',
  },
  // ...
};
```

#### Step 2: Return `structuredContent`

Your tool's `execute` function should return both `content` (for the LLM) and `structuredContent` (for the widget):

```typescript
async execute(input, context): Promise<ToolResult> {
  const data = await fetchSomeData();

  return {
    // Text content for the LLM to read
    content: [{ type: 'text', text: `Found ${data.count} items` }],

    // Structured data for the widget to render
    structuredContent: {
      count: data.count,
      items: data.items,
      timestamp: new Date().toISOString(),
    },
  };
}
```

#### Step 3: Create the HTML Template

Create your template file in `packages/server/src/tools/templates/`:

```html
<!-- packages/server/src/tools/templates/my-tool.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      /* Background is automatically set based on theme */
    }
    .card {
      border-radius: 8px;
      padding: 16px;
      background: rgba(99, 102, 241, 0.1);
    }
    .card.dark {
      background: rgba(129, 140, 248, 0.1);
    }
  </style>
</head>
<body>
  <div id="card" class="card">
    <div id="content">Loading...</div>
  </div>

  <script>
    (function() {
      // Access data from window.openai
      const data = window.openai?.toolOutput || {};
      const theme = window.openai?.theme || 'light';

      // Apply theme
      const card = document.getElementById('card');
      if (theme === 'dark') {
        card.classList.add('dark');
      }

      // Render content
      document.getElementById('content').textContent = `Found ${data.count} items`;
    })();
  </script>
</body>
</html>
```

### The `window.openai` API

Widgets have access to a global `window.openai` object with the following properties and methods:

```typescript
window.openai = {
  // Data
  theme: 'light' | 'dark',           // Current app theme
  toolInput: { ... },                 // Original tool arguments
  toolOutput: { ... },                // structuredContent from tool result
  locale: 'en-US',                    // Browser locale
  maxHeight: 800,                     // Maximum render height

  // Device info
  userAgent: {
    device: { type: 'desktop' | 'mobile' },
    capabilities: { hover: boolean, touch: boolean }
  },

  // Methods
  openExternal: ({ href }) => void,   // Open URL in new tab
  callTool: (name, args) => Promise,  // Call another tool (stub)
  sendFollowUpMessage: (args) => Promise,  // Send message (stub)
};
```

### Theme Support

The app automatically injects theme-appropriate styles into the iframe:

- **Light mode**: White background (`#ffffff`)
- **Dark mode**: Dark background (`#111827`)

Your widget should check `window.openai.theme` and apply appropriate styles:

```javascript
if (window.openai.theme === 'dark') {
  document.body.classList.add('dark');
  // Apply dark mode styles
}
```

### Example: Plan Usage Widget

Here's the complete implementation of the `get-plan-usage` tool with a widget:

**Tool (`packages/server/src/tools/get-plan-usage.ts`):**

```typescript
import { db } from '@chaaskit/db';
import { getConfig } from '../config/loader.js';
import { getBillingContext } from '../services/usage.js';
import type { NativeTool } from './types.js';

export const getPlanUsageTool: NativeTool = {
  name: 'get-plan-usage',
  description: 'Get the current user\'s plan information and usage statistics.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  _meta: {
    'ui/templateFile': 'get-plan-usage.html',
  },

  async execute(input, context) {
    const config = getConfig();

    if (!config.payments.enabled) {
      return {
        content: [{ type: 'text', text: 'Payments are not enabled.' }],
        structuredContent: {
          planName: 'Free',
          messagesUsed: 0,
          messageLimit: null,
          credits: null,
        },
      };
    }

    if (!context.userId) {
      return {
        content: [{ type: 'text', text: 'User not authenticated.' }],
        isError: true,
      };
    }

    const billingContext = await getBillingContext(context.userId);
    if (!billingContext) {
      return {
        content: [{ type: 'text', text: 'Unable to retrieve billing info.' }],
        isError: true,
      };
    }

    const planConfig = config.payments.plans.find(p => p.id === billingContext.plan);
    const planName = planConfig?.name || billingContext.plan;

    return {
      content: [{
        type: 'text',
        text: `Plan: ${planName}\nMessages: ${billingContext.messagesThisMonth}/${billingContext.monthlyLimit}`,
      }],
      structuredContent: {
        planName,
        planId: billingContext.plan,
        billingContext: billingContext.type,
        messagesUsed: billingContext.messagesThisMonth,
        messageLimit: billingContext.monthlyLimit === -1 ? null : billingContext.monthlyLimit,
        credits: billingContext.credits,
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      },
    };
  },
};
```

**Template (`packages/server/src/tools/templates/get-plan-usage.html`):**

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
    }
    .card {
      border-radius: 12px;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      max-width: 360px;
    }
    .card.dark {
      background: linear-gradient(135deg, #434343 0%, #000000 100%);
    }
    .plan-name { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .usage-section {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 12px;
      margin: 16px 0 12px;
    }
    .progress-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-fill {
      height: 100%;
      background: white;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div id="card" class="card">
    <div id="plan-name" class="plan-name">Loading...</div>
    <div class="usage-section">
      <div id="usage-text">-</div>
      <div class="progress-bar">
        <div id="progress" class="progress-fill" style="width: 0%"></div>
      </div>
    </div>
  </div>
  <script>
    (function() {
      const data = window.openai?.toolOutput || {};
      const theme = window.openai?.theme || 'light';

      if (theme === 'dark') {
        document.getElementById('card').classList.add('dark');
      }

      document.getElementById('plan-name').textContent = data.planName || 'Unknown';

      const used = data.messagesUsed || 0;
      const limit = data.messageLimit;

      if (limit) {
        document.getElementById('usage-text').textContent = `${used} / ${limit} messages`;
        document.getElementById('progress').style.width = Math.min((used / limit) * 100, 100) + '%';
      } else {
        document.getElementById('usage-text').textContent = `${used} messages (unlimited)`;
      }
    })();
  </script>
</body>
</html>
```

### Widget Best Practices

1. **Always provide `content`**: The LLM needs text content to understand the result
2. **Keep templates self-contained**: All styles and scripts should be inline
3. **Support both themes**: Check `window.openai.theme` and apply appropriate styles
4. **Handle missing data**: Your template should gracefully handle undefined values
5. **Use semantic HTML**: Helps with accessibility and debugging
6. **Minimize JavaScript**: Keep widget logic simple and fast
7. **Test both themes**: Verify your widget looks good in light and dark mode

## Custom Tool Renderers

Native tools have three rendering options in the chat UI, in order of priority:

1. **Custom React renderer** - A React component registered via the client extension system. Best for tools that need interactive UI or tight integration with your app.
2. **HTML widget template** - An HTML file rendered in a sandboxed iframe via `_meta`. Best for self-contained visualizations. See [Widget Support](#widget-support) above.
3. **Plain text fallback** - The `content` array is displayed as formatted text.

### Creating a React Renderer

For native tools that return `structuredContent`, you can register a custom React component that renders the result inline in the chat:

```tsx
// extensions/tools/weather-renderer.tsx
import { clientRegistry } from '@chaaskit/client/extensions';

function WeatherRenderer({ toolResult }: { toolResult: { structuredContent?: Record<string, unknown> } }) {
  const data = toolResult.structuredContent as {
    city: string;
    temperature: number;
    units: string;
    condition: string;
  } | undefined;

  if (!data) return null;

  return (
    <div className="rounded-lg border border-border p-4 bg-surface">
      <div className="text-lg font-semibold text-text-primary">{data.city}</div>
      <div className="text-3xl font-bold text-text-primary mt-1">
        {data.temperature}° {data.units === 'fahrenheit' ? 'F' : 'C'}
      </div>
      <div className="text-text-secondary mt-1">{data.condition}</div>
    </div>
  );
}

clientRegistry.registerTool({
  name: 'get-weather',       // Must match the native tool name
  description: 'Weather display',
  resultRenderer: WeatherRenderer,
});
```

Import the renderer in your app so it's registered at load time:

```tsx
// app/root.tsx (add near the top)
import '../extensions/tools/weather-renderer';
```

The renderer receives `toolCall` (the tool invocation) and `toolResult` (the result including `structuredContent`). See [Extensions > Custom Tool Renderers](./extensions.md#custom-tool-renderers) for more details.

### Choosing Between Widgets and React Renderers

| Feature | HTML Widget (`_meta`) | React Renderer |
|---------|----------------------|----------------|
| Sandboxed | Yes (iframe) | No (runs in app) |
| Access to app state | No | Yes (hooks, context, etc.) |
| Styling | Self-contained CSS | Tailwind utility classes |
| Best for | Self-contained visualizations | Interactive UI, app integration |
| Defined in | Server-side (tool's `_meta`) | Client-side (extension) |

## Tool Confirmation

Native tools participate in the same tool confirmation system as MCP tools. When tool confirmation is enabled, users are prompted to approve or reject tool calls before execution.

The confirmation system uses the tool ID format `native:tool-name`. Configure it in your app config:

```typescript
// config/app.config.ts
agent: {
  toolConfirmation: {
    mode: 'all',       // Require confirmation for all tools
    // mode: 'none',   // No confirmation (default)
    // mode: 'whitelist', allowList: ['native:web-scrape'],  // Only these need confirmation
    // mode: 'blacklist', denyList: ['native:web-scrape'],   // All except these need confirmation
  },
}
```

Users can also "always allow" specific tools, which persists in their settings.

## Best Practices

1. **Validate inputs**: Always validate and sanitize user inputs before processing
2. **Handle errors gracefully**: Return `isError: true` with a helpful message instead of throwing
3. **Use timeouts**: Set reasonable timeouts for external requests
4. **Respect rate limits**: If your tool calls external APIs, implement rate limiting
5. **Keep descriptions clear**: The LLM uses the description to decide when to use the tool
6. **Document parameters**: Provide clear descriptions for each input parameter

## Exposing Native Tools via MCP Server

When you enable the MCP server export feature, your native tools can be accessed by external MCP clients like Claude Desktop or MCP Inspector. This allows other applications to use your app's tools.

### Configuration

```typescript
// config/app.config.ts
mcp: {
  server: {
    enabled: true,
    exposeTools: 'native',  // Expose native tools via MCP
    oauth: {
      enabled: true,
      allowDynamicRegistration: true,
    },
  },
}
```

### Exposure Options

- **`'native'`**: Only expose native tools (recommended)
- **`'all'`**: Expose native tools plus tools from connected MCP servers
- **`string[]`**: Explicit list, e.g., `['web-scrape', 'get-plan-usage']`

### How It Works

1. External MCP client connects to `/mcp` endpoint
2. Client authenticates via OAuth or API key
3. Client calls `tools/list` to discover available tools
4. Client calls `tools/call` to execute a tool
5. Tool runs with the authenticated user's context

### User Context in External Calls

When a tool is called via the MCP server, the `context` object includes the authenticated user's ID:

```typescript
async execute(input, context) {
  // context.userId is set from the OAuth token or API key
  if (!context.userId) {
    return {
      content: [{ type: 'text', text: 'Authentication required' }],
      isError: true,
    };
  }

  // Tool has access to user's data
  const userData = await db.user.findUnique({ where: { id: context.userId } });
  // ...
}
```

See [MCP Integration > MCP Server Export](./mcp.md#mcp-server-export) for full documentation.

## Security Considerations

- Native tools run with server privileges - be careful about what capabilities you expose
- Validate URLs to prevent SSRF attacks (e.g., block internal IPs). The built-in `web-scrape` tool blocks private and link-local hosts.
- Sanitize file paths if your tool accesses the filesystem
- Consider rate limiting to prevent abuse
- Use the `context.userId` to implement per-user restrictions if needed
- When exposing via MCP server, tools run with the authenticated user's permissions
