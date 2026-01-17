# Native Tools

Native tools are built-in tools that run directly in your application, without requiring external MCP servers. They provide capabilities like web scraping, file processing, or custom integrations that are part of your core server.

## Overview

Unlike MCP tools (which connect to external servers), native tools:
- Run in the same process as your server
- Have no external dependencies
- Are opt-in per agent (must be explicitly enabled)
- Use the `native:` prefix in configuration

## Available Native Tools

| Tool | Description | Widget |
|------|-------------|--------|
| `web-scrape` | Fetches a URL and returns the content as plain text. Supports HTML, JSON, and plain text responses. | No |
| `get-plan-usage` | Returns the current user's plan information and usage statistics. | Yes |

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

## Creating New Native Tools

Native tools are defined in `packages/server/src/tools/`. Each tool is a module that exports a `NativeTool` object.

### Step 1: Create the Tool File

Create a new file in `packages/server/src/tools/`:

```typescript
// packages/server/src/tools/my-tool.ts
import type { NativeTool, ToolResult, ToolContext } from './types.js';

export const myTool: NativeTool = {
  name: 'my-tool',

  description: 'A description of what this tool does. This is shown to the LLM.',

  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Description of param1',
      },
      param2: {
        type: 'number',
        description: 'Description of param2',
        default: 10,
      },
    },
    required: ['param1'],
  },

  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const param1 = input.param1 as string;
    const param2 = (input.param2 as number) || 10;

    try {
      // Your tool logic here
      const result = await doSomething(param1, param2);

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
};
```

### Step 2: Register the Tool

Add your tool to the registry in `packages/server/src/tools/index.ts`:

```typescript
import { myTool } from './my-tool.js';

// Register built-in native tools
nativeToolRegistry.set('web-scrape', webScrapeTool);
nativeToolRegistry.set('my-tool', myTool);  // Add this line
```

### Step 3: Configure Agent Access

Enable the tool for agents that should have access:

```typescript
// config/app.config.ts
{
  id: 'my-agent',
  name: 'My Agent',
  // ...
  allowedTools: ['native:my-tool'],
}
```

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
- Validate URLs to prevent SSRF attacks (e.g., block internal IPs)
- Sanitize file paths if your tool accesses the filesystem
- Consider rate limiting to prevent abuse
- Use the `context.userId` to implement per-user restrictions if needed
- When exposing via MCP server, tools run with the authenticated user's permissions
