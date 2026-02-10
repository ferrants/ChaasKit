# Extensions

ChaasKit supports extensions for customizing behavior without modifying core code. Extensions live in the `extensions/` directory of your project and are automatically loaded.

## Extension Types

### Server Extensions

| Type | Directory | Purpose |
|------|-----------|---------|
| Agents | `extensions/agents/` | Custom AI agent implementations |
| Payment Plans | `extensions/payment-plans/` | Custom pricing and billing logic |
| Auth Providers | `extensions/auth-providers/` | Additional OAuth providers |
| MCP Resources | `extensions/mcp-resources/` | Custom resources for MCP server |

### Client Extensions

| Type | Directory | Purpose |
|------|-----------|---------|
| Pages | `extensions/pages/` | Custom frontend pages |
| Tools | `extensions/tools/` | Custom tool result renderers |

## Directory Structure

```
my-chat-app/
└── extensions/
    ├── agents/
    │   └── my-custom-agent.ts    # Custom agent implementation
    ├── payment-plans/
    │   └── enterprise-plan.ts    # Custom pricing plan
    ├── auth-providers/
    │   └── slack-auth.ts         # Custom OAuth provider
    ├── mcp-resources/
    │   └── user-profile.ts       # Custom MCP resource
    ├── pages/
    │   └── analytics.tsx         # Custom frontend page
    └── tools/
        └── chart-renderer.tsx    # Custom tool result renderer
```

---

## Server Extensions

Server extensions are automatically discovered and loaded from your `extensions/` directory when the server starts.

### Registry System

Extensions register themselves with the global registry:

```typescript
import { registry } from '@chaaskit/server';

// Register an extension
registry.register('category', 'name', Implementation);

// Categories: 'agent', 'payment-plan', 'auth-provider', 'mcp-resource'
```

### Custom Agents

Create custom agent implementations that wrap AI providers or connect to external services.

#### Base Agent Class

```typescript
export abstract class BaseAgent {
  abstract chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<ChatEvent>;
}
```

#### Example: Custom Agent with Pre/Post Processing

```typescript
// extensions/agents/moderated-agent.ts
import { BaseAgent, registry } from '@chaaskit/server';
import type { ChatMessage, ChatOptions, ChatEvent } from '@chaaskit/shared';

export class ModeratedAgent extends BaseAgent {
  async *chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<ChatEvent> {
    // Pre-processing: Content moderation
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') {
      const isAllowed = await this.moderateContent(lastMessage.content);
      if (!isAllowed) {
        yield { type: 'text', content: "I can't help with that request." };
        yield { type: 'done' };
        return;
      }
    }

    // Pass through to inner agent...
    yield { type: 'done' };
  }

  private async moderateContent(content: string): Promise<boolean> {
    const blockedTerms = ['harmful', 'illegal'];
    return !blockedTerms.some(term => content.toLowerCase().includes(term));
  }
}

// Register the agent
registry.register('agent', 'moderated', ModeratedAgent);
```

#### Using Custom Agents in Config

```typescript
// config/app.config.ts
agent: {
  agents: [
    {
      id: 'moderated-assistant',
      name: 'Moderated Assistant',
      type: 'custom',
      customType: 'moderated',  // Matches registry name
      config: {
        provider: 'openai',
        model: 'gpt-4o-mini',
      },
    },
  ],
}
```

### Custom Payment Plans

Create custom pricing logic for enterprise plans, usage-based billing, or special promotions.

#### Base Pricing Plan Class

```typescript
export abstract class BasePricingPlan {
  abstract id: string;
  abstract name: string;

  abstract canSendMessage(user: User): Promise<boolean>;
  abstract onMessageSent(user: User): Promise<void>;
  abstract getUsageDisplay(user: User): Promise<UsageDisplay>;
}
```

#### Example: Enterprise Plan

```typescript
// extensions/payment-plans/enterprise-plan.ts
import { BasePricingPlan, registry } from '@chaaskit/server';
import type { User, UsageDisplay } from '@chaaskit/shared';
import { db } from '@chaaskit/db';

export class EnterprisePlan extends BasePricingPlan {
  id = 'enterprise';
  name = 'Enterprise';

  private limits = {
    messagesPerDay: 1000,
    messagesPerMonth: 50000,
  };

  async canSendMessage(user: User): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyCount = await db.message.count({
      where: {
        thread: { userId: user.id },
        role: 'user',
        createdAt: { gte: today },
      },
    });

    return dailyCount < this.limits.messagesPerDay;
  }

  async onMessageSent(user: User): Promise<void> {
    // Track usage, send alerts, etc.
  }

  async getUsageDisplay(user: User): Promise<UsageDisplay> {
    // Return usage info
    return {
      used: 0,
      limit: this.limits.messagesPerMonth,
      label: '0 / 50,000 messages',
      percentage: 0,
    };
  }
}

registry.register('payment-plan', 'enterprise', EnterprisePlan);
```

### Custom Auth Providers

Add additional OAuth providers beyond the built-in Google and GitHub.

```typescript
// extensions/auth-providers/slack-auth.ts
import { BaseAuthProvider, registry } from '@chaaskit/server';
import { Strategy as SlackStrategy } from 'passport-slack-oauth2';

export class SlackAuthProvider extends BaseAuthProvider {
  name = 'slack';
  displayName = 'Slack';

  getStrategy() {
    return new SlackStrategy({
      clientID: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
      callbackURL: `${process.env.API_URL}/api/auth/callback/slack`,
    }, async (accessToken, refreshToken, profile, done) => {
      // Handle user creation/lookup
    });
  }
}

registry.register('auth-provider', 'slack', SlackAuthProvider);
```

### MCP Resources

When the MCP server export feature is enabled, you can expose custom resources that external MCP clients can read. Resources provide read-only data access via the MCP protocol.

#### Base MCP Resource Class

```typescript
export abstract class BaseMCPResource {
  /** URI for the resource (e.g., "myapp://users/profile") */
  abstract uri: string;

  /** Human-readable name for the resource */
  abstract name: string;

  /** Optional description */
  abstract description?: string;

  /** MIME type of the resource content */
  abstract mimeType?: string;

  /**
   * Read the resource content.
   * @param context - Context including the requesting user's ID
   * @returns Resource content as text or base64-encoded blob
   */
  abstract read(context: { userId?: string }): Promise<{ text?: string; blob?: string }>;
}
```

#### Example: User Profile Resource

```typescript
// extensions/mcp-resources/user-profile.ts
import { BaseMCPResource, registry } from '@chaaskit/server';
import { db } from '@chaaskit/db';

class UserProfileResource extends BaseMCPResource {
  uri = 'chatapp://user/profile';
  name = 'User Profile';
  description = 'Current user profile information';
  mimeType = 'application/json';

  async read(context: { userId?: string }): Promise<{ text?: string }> {
    if (!context.userId) {
      return { text: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const user = await db.user.findUnique({
      where: { id: context.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return {
      text: JSON.stringify(user, null, 2),
    };
  }
}

// Register the resource
registry.register('mcp-resource', 'user-profile', new UserProfileResource());
```

#### Example: Thread Summary Resource

```typescript
// extensions/mcp-resources/thread-summary.ts
import { BaseMCPResource, registry } from '@chaaskit/server';
import { db } from '@chaaskit/db';

class ThreadSummaryResource extends BaseMCPResource {
  uri = 'chatapp://threads/summary';
  name = 'Thread Summary';
  description = 'Summary of user conversation threads';
  mimeType = 'application/json';

  async read(context: { userId?: string }): Promise<{ text?: string }> {
    if (!context.userId) {
      return { text: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const threads = await db.thread.findMany({
      where: { userId: context.userId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    const summary = threads.map(t => ({
      id: t.id,
      title: t.title,
      messageCount: t._count.messages,
      lastUpdated: t.updatedAt,
    }));

    return {
      text: JSON.stringify(summary, null, 2),
    };
  }
}

registry.register('mcp-resource', 'thread-summary', new ThreadSummaryResource());
```

#### Example: Binary Resource (Image)

```typescript
// extensions/mcp-resources/avatar.ts
import { BaseMCPResource, registry } from '@chaaskit/server';
import fs from 'fs/promises';

class AvatarResource extends BaseMCPResource {
  uri = 'chatapp://user/avatar';
  name = 'User Avatar';
  description = 'User profile avatar image';
  mimeType = 'image/png';

  async read(context: { userId?: string }): Promise<{ blob?: string }> {
    if (!context.userId) {
      // Return a default avatar
      const defaultAvatar = await fs.readFile('./public/default-avatar.png');
      return { blob: defaultAvatar.toString('base64') };
    }

    // Load user-specific avatar
    const avatarPath = `./uploads/avatars/${context.userId}.png`;
    try {
      const avatar = await fs.readFile(avatarPath);
      return { blob: avatar.toString('base64') };
    } catch {
      // Return default if not found
      const defaultAvatar = await fs.readFile('./public/default-avatar.png');
      return { blob: defaultAvatar.toString('base64') };
    }
  }
}

registry.register('mcp-resource', 'avatar', new AvatarResource());
```

#### MCP Resource URIs

Use descriptive URI schemes for your resources:

| Pattern | Example | Description |
|---------|---------|-------------|
| `appname://category/item` | `chatapp://user/profile` | User-specific data |
| `appname://data/collection` | `chatapp://threads/recent` | Collections |
| `appname://config/settings` | `chatapp://config/theme` | Configuration |

#### Security Considerations

1. **User Context**: Always check `context.userId` before returning user-specific data
2. **Data Filtering**: Only expose data the user is authorized to see
3. **Error Handling**: Return safe error messages, don't leak internal details
4. **Rate Limiting**: Consider caching for expensive resource reads

---

## Client Extensions

### Custom Pages

With React Router v7, custom pages are created as route files in `app/routes/`. See the [Custom Pages](./custom-pages.md) documentation for details.

For pages within the authenticated chat app area, create files following the naming convention:

```tsx
// app/routes/chat.analytics.tsx
// Creates a route at /chat/analytics

import { ChatProviders } from '@chaaskit/client';

export default function AnalyticsPage() {
  return (
    <ChatProviders>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary">Analytics</h1>
        <p className="text-text-secondary">Your usage statistics</p>
        {/* Your analytics content */}
      </div>
    </ChatProviders>
  );
}
```

### Custom Tool Renderers

Create custom renderers for specific tool outputs. Tool renderers are registered with the client registry and used when displaying tool results in chat. Renderers receive `toolCall` and `toolResult` props, with `toolResult.structuredContent` available for native tools that emit structured data.

Native tools that return `structuredContent` can be paired with a custom renderer for rich in-chat display. See [Native Tools > Custom Tool Renderers](./native-tools.md#custom-tool-renderers) for a complete walkthrough of creating a tool + renderer pair.

```tsx
// extensions/tools/chart-renderer.tsx
import { clientRegistry } from '@chaaskit/client/extensions';

interface ChartResult {
  type: 'chart';
  data: Array<{ name: string; value: number }>;
  title?: string;
}

function ChartRenderer({ toolResult }: { toolResult: { structuredContent?: ChartResult } }) {
  const result = toolResult.structuredContent;
  if (!result) {
    return <div className="text-sm text-text-secondary">No chart data.</div>;
  }
  return (
    <div className="rounded-lg border border-border p-4">
      {result.title && (
        <h3 className="mb-4 font-semibold">{result.title}</h3>
      )}
      {/* Render chart */}
    </div>
  );
}

clientRegistry.registerTool({
  name: 'chart',
  description: 'Renders chart data',
  resultRenderer: ChartRenderer,
});

export default ChartRenderer;
```

### Using Extension Hooks

```tsx
import { useToolRenderer } from '@chaaskit/client/extensions';

function MyComponent() {
  // Get a specific tool renderer
  const chartRenderer = useToolRenderer('chart');

  return (
    // ...
  );
}
```

---

## Loading Extensions

### Server Extensions

Server extensions are automatically loaded from `extensions/` when the server starts. The loader scans:

- `extensions/agents/*.{ts,js}`
- `extensions/payment-plans/*.{ts,js}`
- `extensions/auth-providers/*.{ts,js}`
- `extensions/mcp-resources/*.{ts,js}`

Each file should register itself with the registry when imported.

### Client Extensions

Custom tool renderers need to be imported in your app. Create an entry point and import it in your `app/root.tsx`:

```typescript
// extensions/tools/index.ts
import './chart-renderer';
```

```tsx
// app/root.tsx
import '../extensions/tools';
```

---

## Best Practices

1. **Keep extensions isolated** - Don't modify core packages; use the registry pattern
2. **Type safety** - Extend base classes and implement required interfaces
3. **Error handling** - Always handle errors gracefully in extensions
4. **Environment variables** - Use env vars for secrets, don't hardcode
5. **Testing** - Test extensions independently before integrating
6. **Documentation** - Document your extensions for team members

## Troubleshooting

### Extension not loading

1. Check that the extension file is in the correct directory
2. Verify the extension calls `registry.register()`
3. Check server/browser logs for import errors

### Type errors

1. Ensure you're extending the correct base class
2. Import types from `@chaaskit/shared`
3. Run `pnpm typecheck` to catch issues

### Client extension not appearing

1. Ensure you're importing the extension file
2. Check that `showInSidebar: true` is set for pages
3. Verify `requiresAuth` matches the user's auth state

---

## Custom Server Routes

For full control over your server, you can create a custom server entry point that adds your own routes alongside the ChaasKit API.

### Custom Server Entry Point

Create `src/server.ts`:

```typescript
// src/server.ts
import { createApp, requireAuth, optionalAuth } from '@chaaskit/server';
import { db } from '@chaaskit/db';
import { Router } from 'express';
import { config } from '../config/app.config.js';

async function start() {
  // Create the base app with all ChaasKit functionality
  const app = await createApp({ config });

  // Add your custom routes
  const customRouter = Router();

  // Public route
  customRouter.get('/api/custom/hello', (req, res) => {
    res.json({ message: 'Hello from custom route!' });
  });

  // Protected route - requires authentication
  customRouter.get('/api/custom/profile', requireAuth, (req, res) => {
    res.json({
      userId: req.user!.id,
      email: req.user!.email,
    });
  });

  // Route with database access
  customRouter.get('/api/custom/stats', requireAuth, async (req, res) => {
    const threadCount = await db.thread.count({
      where: { userId: req.user!.id },
    });
    res.json({ threads: threadCount });
  });

  // Webhook handler
  customRouter.post('/api/custom/webhook', (req, res) => {
    // Handle webhooks
    res.json({ received: true });
  });

  // Mount your custom router
  app.use(customRouter);

  // Start the server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch(console.error);
```

### Update package.json

```json
{
  "scripts": {
    "dev:server": "tsx watch src/server.ts",
    "dev:client": "vite",
    "dev": "concurrently \"pnpm dev:server\" \"pnpm dev:client\"",
    "start": "node dist/server.js"
  }
}
```

### Available Middleware

| Middleware | Purpose |
|------------|---------|
| `requireAuth` | Requires authentication, adds `req.user` |
| `optionalAuth` | Adds `req.user` if authenticated, allows anonymous |

### Adding Marketing Pages (with basePath)

When using `basePath` to run the chat app under a sub-path (e.g., `/app`), you can serve marketing pages from the root:

```typescript
import express from 'express';
import path from 'path';

// In your server setup after createApp()

// Serve marketing pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/marketing/index.html'));
});

app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/marketing/pricing.html'));
});

// Or serve static marketing site
app.use(express.static(path.join(__dirname, '../public/marketing')));

// Chat app is served under /app/* (via basePath config)
```
