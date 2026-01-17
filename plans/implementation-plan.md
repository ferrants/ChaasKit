# AI ChaasKit Template - Implementation Plan

## Overview
A configurable, production-ready AI ChaasKit template that allows developers to clone, configure, and deploy a complete chat application with minimal code changes.

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React + TypeScript + Vite | Fast dev experience, excellent TypeScript support |
| **Backend** | Node.js + Express + TypeScript | Native streaming, shared types with frontend |
| **Database** | PostgreSQL + Prisma | Relational data (users, threads, messages), great ORM |
| **Auth** | Custom with Passport.js | Flexible - supports email/password, OAuth, magic link |
| **Payments** | Stripe | Subscriptions, credits, webhooks |
| **AI** | Anthropic SDK + OpenAI SDK | Direct integration with streaming support |
| **Styling** | Tailwind CSS + CSS Variables | Utility-first, runtime theme switching |
| **Monorepo** | pnpm workspaces | Fast, efficient, good for shared packages |

## Project Structure

```
chaaskit/
├── package.json                    # Root workspace config
├── pnpm-workspace.yaml
├── .env.example                    # Template for secrets
├── config/
│   └── app.config.ts               # Main configuration file
│
├── packages/
│   ├── server/                # Backend (DON'T MODIFY)
│   │   ├── src/
│   │   │   ├── api/                # Express routes
│   │   │   ├── services/           # Business logic
│   │   │   ├── agents/             # Base agent classes
│   │   │   ├── auth/               # Auth strategies
│   │   │   ├── payments/           # Stripe integration
│   │   │   ├── streaming/          # SSE streaming utilities
│   │   │   └── registry/           # Plugin registry system
│   │   └── package.json
│   │
│   ├── client/                # Frontend (DON'T MODIFY)
│   │   ├── src/
│   │   │   ├── components/         # React components
│   │   │   ├── hooks/              # Custom hooks
│   │   │   ├── contexts/           # React contexts
│   │   │   ├── pages/              # Main pages
│   │   │   └── utils/              # Utilities
│   │   └── package.json
│   │
│   ├── shared/                     # Shared types/utils (DON'T MODIFY)
│   │   ├── src/
│   │   │   ├── types/              # TypeScript interfaces
│   │   │   ├── validation/         # Zod schemas
│   │   │   └── constants/          # Shared constants
│   │   └── package.json
│   │
│   └── db/                         # Database package
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
│
├── extensions/                     # USER CUSTOMIZATION AREA
│   ├── agents/                     # Custom agent implementations
│   │   └── index.ts                # Export custom agents
│   ├── payment-plans/              # Custom pricing plans
│   │   └── index.ts
│   ├── auth-providers/             # Additional OAuth providers
│   │   └── index.ts
│   └── components/                 # UI component overrides
│       └── index.ts
│
├── public/                         # Static assets (logo, favicon)
│
└── docker/
    ├── Dockerfile
    └── docker-compose.yml
```

## Configuration Schema Design

```typescript
// config/app.config.ts
import type { AppConfig } from '@chaaskit/shared';

export const config: AppConfig = {
  app: {
    name: 'My AI Assistant',
    description: 'Your helpful AI companion',
    url: 'https://myapp.com',
  },

  ui: {
    welcomeTitle: 'Welcome to My AI Assistant',
    welcomeSubtitle: 'How can I help you today?',
    inputPlaceholder: 'Type your message...',
    samplePrompts: [
      { label: 'Explain a concept', prompt: 'Explain quantum computing simply' },
      { label: 'Write code', prompt: 'Write a Python function that...' },
    ],
    logo: '/logo.svg', // or '/logo-dark.svg' for theme-aware
  },

  // Theming configuration - define multiple themes, users can switch
  theming: {
    defaultTheme: 'light',
    allowUserThemeSwitch: true, // Show theme toggle in settings

    themes: {
      light: {
        name: 'Light',
        colors: {
          // Core palette
          primary: '#6366f1',       // Indigo - main brand color
          primaryHover: '#4f46e5',
          secondary: '#8b5cf6',     // Purple - accents

          // Backgrounds
          background: '#ffffff',
          backgroundSecondary: '#f9fafb',
          sidebar: '#f3f4f6',

          // Text
          textPrimary: '#111827',
          textSecondary: '#6b7280',
          textMuted: '#9ca3af',

          // UI elements
          border: '#e5e7eb',
          inputBackground: '#ffffff',
          inputBorder: '#d1d5db',

          // Messages
          userMessageBg: '#6366f1',
          userMessageText: '#ffffff',
          assistantMessageBg: '#f3f4f6',
          assistantMessageText: '#111827',

          // Status
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },

      dark: {
        name: 'Dark',
        colors: {
          primary: '#818cf8',
          primaryHover: '#a5b4fc',
          secondary: '#a78bfa',

          background: '#111827',
          backgroundSecondary: '#1f2937',
          sidebar: '#0f172a',

          textPrimary: '#f9fafb',
          textSecondary: '#d1d5db',
          textMuted: '#6b7280',

          border: '#374151',
          inputBackground: '#1f2937',
          inputBorder: '#4b5563',

          userMessageBg: '#4f46e5',
          userMessageText: '#ffffff',
          assistantMessageBg: '#1f2937',
          assistantMessageText: '#f9fafb',

          success: '#34d399',
          warning: '#fbbf24',
          error: '#f87171',
        },
      },

      // Users can define custom themes
      // 'ocean': { name: 'Ocean', colors: { ... } },
    },

    // Typography
    fonts: {
      sans: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, Menlo, monospace',
    },

    // Border radius scale
    borderRadius: {
      sm: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem',
      full: '9999px',
    },
  },

  fileUpload: {
    enabled: true,
    maxSizeMB: 10,
    acceptedTypes: ['.pdf', '.txt', '.png', '.jpg', '.csv'],
  },

  auth: {
    methods: ['email-password', 'google', 'github'], // Configurable
    allowUnauthenticated: false,
    magicLink: {
      enabled: true,
      expiresInMinutes: 15,
    },
  },

  agent: {
    // Use built-in agent with AI provider
    type: 'built-in',
    provider: 'anthropic', // or 'openai'
    model: 'claude-sonnet-4-20250514',
    systemPrompt: 'You are a helpful assistant...',
    maxTokens: 4096,

    // OR point to external agent
    // type: 'external',
    // endpoint: 'https://my-agent.com/api/chat',
    // headers: { 'Authorization': 'Bearer ${AGENT_API_KEY}' },
  },

  payments: {
    enabled: true,
    provider: 'stripe',
    plans: [
      {
        id: 'free',
        name: 'Free',
        type: 'free',
        params: {
          monthlyMessageLimit: 20,
        },
      },
      {
        id: 'basic',
        name: 'Basic',
        type: 'monthly',
        params: {
          priceUSD: 8,
          monthlyMessageLimit: 500,
          stripePriceId: '${STRIPE_BASIC_PRICE_ID}',
        },
      },
      {
        id: 'pro',
        name: 'Pro',
        type: 'monthly',
        params: {
          priceUSD: 25,
          monthlyMessageLimit: -1, // unlimited
          stripePriceId: '${STRIPE_PRO_PRICE_ID}',
        },
      },
      {
        id: 'credits',
        name: 'Pay as you go',
        type: 'credits',
        params: {
          pricePerCredit: 0.01,
          messagesPerCredit: 1,
        },
      },
    ],
  },

  legal: {
    privacyPolicyUrl: '/privacy',
    termsOfServiceUrl: '/terms',
  },

  userSettings: {
    // Configurable context fields shown in settings modal
    fields: [
      {
        key: 'name',
        label: 'Your Name',
        type: 'text',
        placeholder: 'Enter your name',
      },
      {
        key: 'role',
        label: 'Your Role',
        type: 'select',
        options: ['Developer', 'Designer', 'Product Manager', 'Other'],
      },
      {
        key: 'context',
        label: 'Additional Context',
        type: 'textarea',
        placeholder: 'Any context the AI should know about you...',
      },
    ],
  },
};
```

## Theming System Architecture

The theming system uses CSS custom properties (variables) that Tailwind references, enabling runtime theme switching without rebuilding CSS.

### How It Works

**1. Config → CSS Variables**
At build time, the config themes are transformed into CSS:

```css
/* Generated from config */
:root, [data-theme="light"] {
  --color-primary: 99 102 241;      /* RGB values for opacity support */
  --color-background: 255 255 255;
  --color-text-primary: 17 24 39;
  /* ... all theme colors */
}

[data-theme="dark"] {
  --color-primary: 129 140 248;
  --color-background: 17 24 39;
  --color-text-primary: 249 250 251;
}
```

**2. Tailwind Config Integration**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        background: 'rgb(var(--color-background) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        // ... mapped from config schema
      },
    },
  },
};
```

**3. Usage in Components**

```tsx
// Components use semantic Tailwind classes
<div className="bg-background text-text-primary">
  <button className="bg-primary hover:bg-primary-hover text-white">
    Send
  </button>
</div>
```

**4. Theme Switching (Runtime)**

```tsx
// ThemeProvider.tsx
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(config.theming.defaultTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

### Theme-Aware Assets

For logos and images that need to change with theme:

```typescript
// config
ui: {
  logo: {
    light: '/logo.svg',
    dark: '/logo-white.svg',
  },
}

// Component
const Logo = () => {
  const { theme } = useTheme();
  return <img src={config.ui.logo[theme]} alt={config.app.name} />;
};
```

### Adding Custom Themes

Users can define unlimited custom themes in their config:

```typescript
theming: {
  themes: {
    light: { /* ... */ },
    dark: { /* ... */ },

    // Custom brand theme
    'brand-blue': {
      name: 'Brand Blue',
      colors: {
        primary: '#0066cc',
        background: '#f0f7ff',
        // ... full color palette
      },
    },
  },
}
```

## Database Schema (Prisma)

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  name          String?
  avatarUrl     String?

  // Auth
  emailVerified Boolean   @default(false)
  oauthProvider String?
  oauthId       String?

  // Subscription
  plan          String    @default("free")
  stripeCustomerId String?
  credits       Int       @default(0)
  messagesThisMonth Int   @default(0)

  // User settings/context (JSON)
  settings      Json      @default("{}")
  themePreference String? // User's selected theme

  threads       Thread[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Thread {
  id        String    @id @default(cuid())
  title     String    @default("New Chat")
  userId    String?
  user      User?     @relation(fields: [userId], references: [id])
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id        String   @id @default(cuid())
  threadId  String
  thread    Thread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  role      String   // 'user' | 'assistant'
  content   String
  files     Json?    // Array of file metadata
  createdAt DateTime @default(now())
}
```

## Registry Pattern for Extensibility

```typescript
// packages/server/src/registry/index.ts
class Registry {
  private providers = new Map<string, Map<string, any>>();

  register(category: string, name: string, implementation: any) {
    if (!this.providers.has(category)) {
      this.providers.set(category, new Map());
    }
    this.providers.get(category)!.set(name, implementation);
  }

  get<T>(category: string, name: string): T {
    return this.providers.get(category)?.get(name);
  }
}

// Usage in extensions/payment-plans/index.ts
import { registry, BasePricingPlan } from '@chaaskit/server';

class EnterprisePlan extends BasePricingPlan {
  // Custom implementation
}

registry.register('payment-plan', 'enterprise', EnterprisePlan);
```

## Key API Endpoints

```
POST   /api/auth/register          # Email/password registration
POST   /api/auth/login             # Email/password login
POST   /api/auth/magic-link        # Send magic link
GET    /api/auth/oauth/:provider   # OAuth initiation
GET    /api/auth/callback/:provider # OAuth callback
POST   /api/auth/logout            # Logout

GET    /api/threads                # List user's threads
POST   /api/threads                # Create new thread
GET    /api/threads/:id            # Get thread with messages
PATCH  /api/threads/:id            # Rename thread
DELETE /api/threads/:id            # Delete thread

POST   /api/chat                   # Send message (SSE streaming response)
POST   /api/upload                 # File upload

GET    /api/user/settings          # Get user settings
PATCH  /api/user/settings          # Update user settings
GET    /api/user/subscription      # Get subscription status
POST   /api/payments/checkout      # Create Stripe checkout session
POST   /api/payments/webhook       # Stripe webhook handler
POST   /api/payments/buy-credits   # Purchase credits
```

## Verification Plan

1. **Local Development**
   - Run `pnpm install` and `pnpm dev`
   - Verify hot reload works for both client and server

2. **Configuration Testing**
   - Modify config values and verify UI updates
   - Test all auth methods can be enabled/disabled

3. **Chat Flow**
   - Create thread, send message, verify streaming response
   - Upload file, verify it's included in context
   - Test thread rename and delete

4. **Auth Testing**
   - Test email/password registration and login
   - Test OAuth flows (Google, GitHub)
   - Test magic link flow

5. **Payment Testing**
   - Use Stripe test mode to verify checkout
   - Verify subscription status updates
   - Test credit purchase and deduction

6. **Docker Deployment**
   - Build and run with docker-compose
   - Verify all features work in containerized environment

## Critical Files

These are the key files that will be created/modified:

**Configuration & Types**
- `config/app.config.ts` - Main configuration (themes, UI, auth, payments, agent)
- `packages/shared/src/types/config.ts` - Configuration type definitions
- `packages/shared/src/types/theme.ts` - Theme type definitions

**Theming**
- `packages/client/src/styles/theme.css` - Generated CSS variables from config
- `packages/client/src/contexts/ThemeContext.tsx` - Theme state management
- `packages/client/src/utils/generateThemeCSS.ts` - Config → CSS transformer
- `packages/client/tailwind.config.js` - Tailwind with CSS variable colors

**Chat UI**
- `packages/client/src/components/ChatInput.tsx` - Message input with file attach
- `packages/client/src/components/MessageList.tsx` - Message display with streaming
- `packages/client/src/components/ThreadSidebar.tsx` - Thread list with actions
- `packages/client/src/components/SettingsModal.tsx` - User settings + theme toggle

**Backend**
- `packages/server/src/api/chat.ts` - Chat streaming endpoint
- `packages/server/src/agents/base.ts` - Base agent class
- `packages/server/src/registry/index.ts` - Plugin registry

**Database**
- `packages/db/prisma/schema.prisma` - Database schema
