# Migration Plan: React Router v7 Framework Mode

## Overview

Migrate the scaffolded consumer app template from Vite SPA to React Router v7 (framework mode), enabling:
- **SSR for marketing pages** - SEO-friendly landing, docs, pricing, legal pages
- **SSR for public pages** - Login, register, shared threads
- **Form actions for auth** - Login/register work without JavaScript
- **Client-side chat app** - Authenticated chat with SSE streaming (hydrates after SSR shell)
- **Single source of truth** - No duplicate page implementations

## Background

React Router v7 merged with Remix. What was planned as Remix v3 is now React Router v7. The framework mode provides all Remix features (loaders, actions, SSR, file-based routing) under the React Router package.

References:
- [Merging Remix and React Router](https://remix.run/blog/merging-remix-and-react-router)
- [Picking a Mode | React Router](https://reactrouter.com/start/modes)

## Current Architecture

```
consumer-app/
├── src/main.tsx           # Vite entry, calls renderApp()
├── config/app.config.ts   # Configuration
├── index.html             # Vite HTML template
└── vite.config.ts

Processes:
├── chaaskit-server (port 3000)  # Express API + built-in SSR
└── vite (port 5173)             # Client SPA
```

## Target Architecture

```
consumer-app/
├── app/
│   ├── root.tsx                 # React Router root layout
│   ├── entry.client.tsx         # Client hydration
│   ├── entry.server.tsx         # Server rendering
│   └── routes/
│       ├── _index.tsx           # Marketing page (SSR)
│       ├── login.tsx            # Login (SSR + form action)
│       ├── register.tsx         # Register (SSR + form action)
│       ├── shared.$shareId.tsx  # Shared threads (SSR + data loader)
│       ├── terms.tsx            # Terms of service (SSR)
│       ├── privacy.tsx          # Privacy policy (SSR)
│       ├── pricing.tsx          # Pricing page (SSR)
│       ├── docs.tsx             # Documentation (SSR)
│       └── chat.tsx             # Chat app (SSR shell + client hydration)
├── config/app.config.ts
├── public/
└── package.json

Processes:
├── react-router dev (port 5173) # React Router dev server (SSR + HMR)
└── chaaskit-server (port 3000)  # Express API only
```

## Implementation Phases

### Phase 1: Update @chaaskit/client Exports

The client package needs to export components that work in React Router routes.

**1.1 Export page components individually:**

```tsx
// packages/client/src/index.tsx

// Export individual pages for React Router routes
export { default as ChatPage } from './pages/ChatPage';
export { default as LoginPage } from './pages/LoginPage';
export { default as RegisterPage } from './pages/RegisterPage';
export { default as SharedThreadPage } from './pages/SharedThreadPage';
export { default as PricingPage } from './pages/PricingPage';
// ... etc

// Export the providers wrapper for chat routes
export function ChatProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider>
      <ThemeProvider>
        <AuthProvider>
          <TeamProvider>
            <ProjectProvider>
              {children}
            </ProjectProvider>
          </TeamProvider>
        </AuthProvider>
      </ThemeProvider>
    </ConfigProvider>
  );
}
```

**1.2 Make pages SSR-compatible:**

Audit each page for browser-only APIs:
- `window`, `document`, `localStorage` must be guarded with `typeof window !== 'undefined'`
- Move side effects to `useEffect`
- Ensure initial render produces valid HTML

**1.3 Export SSR utilities:**

```tsx
// packages/client/src/ssr.ts
export { generateThemeCSS, getThemeVariables } from './utils/theme';
export { SSRMessageList } from './components/SSRMessageList';
export { SSRMarkdownRenderer } from './components/content/SSRMarkdownRenderer';
```

### Phase 2: Update @chaaskit/server

**2.1 Remove built-in SSR pages:**

Delete or deprecate:
- `src/ssr/pages/LoginPage.tsx`
- `src/ssr/pages/RegisterPage.tsx`
- `src/ssr/pages/TermsPage.tsx`
- `src/ssr/pages/PrivacyPage.tsx`
- `src/ssr/renderer.tsx`

Keep only the data loading functions.

**2.2 Keep API-only mode:**

The server works as pure API when React Router handles rendering:
```ts
// No SSR middleware needed - React Router handles all rendering
// Server only provides /api/* endpoints
```

**2.3 Export data loaders for React Router:**

```ts
// packages/server/src/loaders/index.ts
export { loadSharedThread } from './sharedThread';
export { loadPricingData } from './pricing';

// These can be imported by React Router route loaders
```

**2.4 Export auth utilities for form actions:**

```ts
// packages/server/src/auth/index.ts
export { validateLogin, validateRegistration } from './validators';
export { createSession, setSessionCookie } from './session';

// React Router actions can use these for server-side auth
```

### Phase 3: Create React Router Template Files

**3.1 `app/root.tsx`:**

```tsx
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from 'react-router';
import type { Route } from './+types/root';
import { config } from '../config/app.config';
import { generateThemeCSS } from '@chaaskit/client/ssr';

export async function loader({}: Route.LoaderArgs) {
  return { config };
}

export default function Root({ loaderData }: Route.ComponentProps) {
  const { config } = loaderData;
  const themeCSS = generateThemeCSS(config, config.theming.defaultTheme);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
        <ThemeScript />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            const theme = localStorage.getItem('theme') || 'light';
            document.documentElement.dataset.theme = theme;
          })();
        `,
      }}
    />
  );
}
```

**3.2 `app/routes/_index.tsx` (Marketing page):**

```tsx
import type { Route } from './+types/_index';
import MarketingPage from '~/pages/MarketingPage';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'My Chat App - AI-powered conversations' },
    { name: 'description', content: 'Build AI chat apps with ChaasKit' },
  ];
}

export default function Index() {
  return <MarketingPage appPath="/chat" />;
}
```

**3.3 `app/routes/chat.tsx` (Chat app):**

```tsx
import { ClientOnly } from '~/components/ClientOnly';
import { ChatProviders, ChatPage } from '@chaaskit/client';
import '@chaaskit/client/styles';
import type { Route } from './+types/chat';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Chat' }];
}

export default function Chat() {
  return (
    <ClientOnly fallback={<ChatLoadingSkeleton />}>
      {() => (
        <ChatProviders>
          <ChatPage />
        </ChatProviders>
      )}
    </ClientOnly>
  );
}

function ChatLoadingSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '256px', background: 'var(--color-sidebar)' }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    </div>
  );
}
```

**3.4 `app/routes/shared.$shareId.tsx` (Shared thread with SSR):**

```tsx
import type { Route } from './+types/shared.$shareId';
import { loadSharedThread } from '@chaaskit/server/loaders';
import { SSRMessageList } from '@chaaskit/client/ssr';
import { config } from '../../config/app.config';

export async function loader({ params }: Route.LoaderArgs) {
  const data = await loadSharedThread(params.shareId!);
  return { ...data, config };
}

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.thread?.title || 'Shared Thread'} | ${data?.config?.app?.name}` },
  ];
}

export default function SharedThread({ loaderData }: Route.ComponentProps) {
  const { thread, config } = loaderData;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
      <header style={{
        borderBottom: '1px solid var(--color-border)',
        padding: '1rem',
        backgroundColor: 'var(--color-background-secondary)'
      }}>
        <h1 style={{ margin: 0, color: 'var(--color-text-primary)' }}>{thread.title}</h1>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)' }}>
          Shared conversation from {config.app.name}
        </p>
      </header>
      <main style={{ maxWidth: '48rem', margin: '0 auto', padding: '1rem' }}>
        <SSRMessageList messages={thread.messages} />
      </main>
    </div>
  );
}
```

**3.5 `app/routes/login.tsx` (Form action - works without JS):**

```tsx
import { Form, redirect, useActionData, useNavigation } from 'react-router';
import type { Route } from './+types/login';
import { config } from '../../config/app.config';

export async function loader({}: Route.LoaderArgs) {
  return { config };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  // Call the chaaskit-server API
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const res = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json();
    return { error: error.error || 'Login failed' };
  }

  const data = await res.json();

  // Get the redirect URL from query params or default to /chat
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirect') || '/chat';

  // Forward the session cookie from the API response
  const setCookie = res.headers.get('set-cookie');

  return redirect(redirectTo, {
    headers: setCookie ? { 'Set-Cookie': setCookie } : {},
  });
}

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Sign In' }];
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const { config } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-background)',
      padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: '28rem' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          {config.ui?.logo && (
            <img
              src={typeof config.ui.logo === 'string' ? config.ui.logo : config.ui.logo.light}
              alt={config.app.name}
              style={{
                height: '4rem',
                width: '4rem',
                marginLeft: 'auto',
                marginRight: 'auto',
                marginBottom: '1rem',
                borderRadius: '0.5rem',
                objectFit: 'contain',
              }}
            />
          )}
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: 'var(--color-text-primary)',
            margin: 0
          }}>
            Welcome back
          </h1>
          <p style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)' }}>
            Sign in to {config.app.name}
          </p>
        </div>

        <Form method="post" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text-primary)'
              }}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              style={{
                marginTop: '0.25rem',
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-input-border)',
                backgroundColor: 'var(--color-input-background)',
                padding: '0.5rem 1rem',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text-primary)'
              }}
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              style={{
                marginTop: '0.25rem',
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-input-border)',
                backgroundColor: 'var(--color-input-background)',
                padding: '0.5rem 1rem',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {actionData?.error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '0.5rem',
              color: 'rgb(239, 68, 68)',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}>
              {actionData.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--color-primary)',
              padding: '0.5rem 1rem',
              fontWeight: 500,
              color: 'white',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </Form>

        <p style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--color-text-secondary)'
        }}>
          Don't have an account?{' '}
          <a href="/register" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
```

**3.6 `app/routes/register.tsx` (Form action - works without JS):**

```tsx
import { Form, redirect, useActionData, useNavigation } from 'react-router';
import type { Route } from './+types/register';
import { config } from '../../config/app.config';

export async function loader({}: Route.LoaderArgs) {
  return { config };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const res = await fetch(`${apiUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    const error = await res.json();
    return { error: error.error || 'Registration failed' };
  }

  const data = await res.json();

  // Handle email verification flow
  if (data.requiresVerification) {
    return redirect('/verify-email');
  }

  // Forward the session cookie and redirect to chat
  const setCookie = res.headers.get('set-cookie');
  return redirect('/chat', {
    headers: setCookie ? { 'Set-Cookie': setCookie } : {},
  });
}

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Create Account' }];
}

export default function Register({ loaderData, actionData }: Route.ComponentProps) {
  const { config } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-background)',
      padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: '28rem' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          {config.ui?.logo && (
            <img
              src={typeof config.ui.logo === 'string' ? config.ui.logo : config.ui.logo.light}
              alt={config.app.name}
              style={{
                height: '4rem',
                width: '4rem',
                marginLeft: 'auto',
                marginRight: 'auto',
                marginBottom: '1rem',
                borderRadius: '0.5rem',
                objectFit: 'contain',
              }}
            />
          )}
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: 'var(--color-text-primary)',
            margin: 0
          }}>
            Create an account
          </h1>
          <p style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)' }}>
            Get started with {config.app.name}
          </p>
        </div>

        <Form method="post" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              htmlFor="name"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text-primary)'
              }}
            >
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              style={{
                marginTop: '0.25rem',
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-input-border)',
                backgroundColor: 'var(--color-input-background)',
                padding: '0.5rem 1rem',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text-primary)'
              }}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              style={{
                marginTop: '0.25rem',
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-input-border)',
                backgroundColor: 'var(--color-input-background)',
                padding: '0.5rem 1rem',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text-primary)'
              }}
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              minLength={8}
              style={{
                marginTop: '0.25rem',
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-input-border)',
                backgroundColor: 'var(--color-input-background)',
                padding: '0.5rem 1rem',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {actionData?.error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '0.5rem',
              color: 'rgb(239, 68, 68)',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}>
              {actionData.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--color-primary)',
              padding: '0.5rem 1rem',
              fontWeight: 500,
              color: 'white',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </Form>

        <p style={{
          marginTop: '1rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)'
        }}>
          By signing up, you agree to our{' '}
          <a href={config.legal?.termsOfServiceUrl || '/terms'} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
            Terms of Service
          </a>{' '}
          and{' '}
          <a href={config.legal?.privacyPolicyUrl || '/privacy'} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
            Privacy Policy
          </a>
        </p>

        <p style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--color-text-secondary)'
        }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
```

### Phase 4: Update create-chaaskit Templates

**4.1 New `package.json`:**

```json
{
  "name": "{{PROJECT_NAME}}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "prisma": {
    "schema": "prisma/schema"
  },
  "scripts": {
    "dev": "concurrently \"chaaskit-server\" \"react-router dev\"",
    "build": "react-router build",
    "start": "NODE_ENV=production concurrently \"chaaskit-server\" \"react-router-serve ./build/server/index.js\"",
    "typecheck": "react-router typegen && tsc --noEmit",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:sync": "chaaskit-server db:sync"
  },
  "dependencies": {
    "@chaaskit/server": "^0.1.0",
    "@chaaskit/client": "^0.1.0",
    "@chaaskit/db": "^0.1.0",
    "@chaaskit/shared": "^0.1.0",
    "@prisma/client": "^6.0.0",
    "@react-router/node": "^7.1.0",
    "@react-router/serve": "^7.1.0",
    "concurrently": "^9.2.1",
    "isbot": "^5.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router": "^7.1.0"
  },
  "devDependencies": {
    "@react-router/dev": "^7.1.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "prisma": "^6.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vite-tsconfig-paths": "^5.0.0"
  }
}
```

**4.2 New `react-router.config.ts`:**

```ts
import type { Config } from '@react-router/dev/config';

export default {
  // SSR enabled by default
  ssr: true,

  // Future flags for v7 compatibility
  future: {
    unstable_optimizeDeps: true,
  },
} satisfies Config;
```

**4.3 New `vite.config.ts`:**

```ts
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    reactRouter(),
    tsconfigPaths(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/mcp': 'http://localhost:3000',
      '/v1': 'http://localhost:3000',
    },
  },
});
```

**4.4 New directory structure:**

```
templates/
├── app/
│   ├── root.tsx
│   ├── entry.client.tsx
│   ├── entry.server.tsx
│   ├── components/
│   │   └── ClientOnly.tsx
│   ├── pages/
│   │   └── MarketingPage.tsx      # Starter marketing page (customizable)
│   └── routes/
│       ├── _index.tsx             # Marketing (SSR, customizable)
│       ├── chat.tsx               # Chat app entry (SSR shell + client)
│       ├── login.tsx              # Login (SSR + form action)
│       ├── register.tsx           # Register (SSR + form action)
│       ├── shared.$shareId.tsx    # Shared threads (SSR + loader)
│       ├── terms.tsx              # Terms of service (SSR)
│       └── privacy.tsx            # Privacy policy (SSR)
├── config/
│   └── app.config.ts
├── public/
│   └── logo.svg
├── prisma/
│   └── schema/
│       ├── base.prisma
│       └── custom.prisma
├── extensions/
│   ├── agents/
│   ├── payment-plans/
│   └── pages/
├── .env.example
├── .gitignore
├── package.json
├── react-router.config.ts
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Phase 5: Helper Components

**5.1 `app/components/ClientOnly.tsx`:**

```tsx
import { useState, useEffect, type ReactNode } from 'react';

interface ClientOnlyProps {
  children: () => ReactNode;
  fallback?: ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? <>{children()}</> : <>{fallback}</>;
}
```

**5.2 `app/entry.client.tsx`:**

```tsx
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
```

**5.3 `app/entry.server.tsx`:**

```tsx
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { ServerRouter } from 'react-router';
import type { EntryContext } from 'react-router';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  const userAgent = request.headers.get('user-agent');

  const stream = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: request.signal,
      onError(error: unknown) {
        console.error(error);
        responseStatusCode = 500;
      },
    }
  );

  // For bots, wait for full render
  if (userAgent && isbot(userAgent)) {
    await stream.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  return new Response(stream, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
```

## Files to Change in @chaaskit Packages

### packages/client

| File | Change |
|------|--------|
| `src/index.tsx` | Export individual pages, ChatProviders wrapper |
| `src/pages/*.tsx` | Guard browser APIs for SSR compatibility |
| `src/ssr.ts` | Export theme utilities, SSR components |
| `package.json` | Add exports for pages, ssr utilities |

### packages/server

| File | Change |
|------|--------|
| `src/app.ts` | Remove SSR middleware (API-only) |
| `src/ssr/*` | Delete SSR pages, keep data loaders |
| `src/loaders/index.ts` | New - export data loaders for routes |
| `package.json` | Add exports for loaders |

### packages/create-chaaskit

| File | Change |
|------|--------|
| `src/templates/*` | Replace with React Router template structure |
| `src/commands/init.ts` | Update file copy logic for new structure |

## Benefits

1. **No duplicate pages** - Marketing, auth, legal pages defined once in consumer app
2. **SSR where needed** - React Router handles SSR for any route
3. **Form actions work without JS** - Login/register submit via POST, work in no-JS browsers
4. **SPA where appropriate** - Chat app hydrates after SSR shell
5. **Type-safe routes** - React Router v7 generates types for loaders/actions
6. **Customizable** - Consumers own their routes and can add/modify freely
7. **Standard tooling** - React Router v7 is the de facto React routing solution

## Migration for chaaskit-app

Manual migration steps:

1. **Install new dependencies:**
   ```bash
   pnpm add react-router @react-router/node @react-router/serve isbot
   pnpm add -D @react-router/dev vite-tsconfig-paths
   pnpm remove @vitejs/plugin-react react-router-dom
   ```

2. **Create app directory structure:**
   ```bash
   mkdir -p app/routes app/components app/pages
   ```

3. **Move custom pages:**
   - `src/pages/MarketingPage.tsx` → `app/pages/MarketingPage.tsx`
   - `src/pages/DocsPage.tsx` → `app/pages/DocsPage.tsx`

4. **Create route files:**
   - `app/routes/_index.tsx` - import MarketingPage
   - `app/routes/docs.tsx` - import DocsPage
   - `app/routes/docs.$slug.tsx` - dynamic docs routes

5. **Create entry files:**
   - `app/root.tsx`
   - `app/entry.client.tsx`
   - `app/entry.server.tsx`

6. **Update config files:**
   - Replace `vite.config.ts` with React Router version
   - Add `react-router.config.ts`
   - Update `package.json` scripts

7. **Delete old files:**
   - `src/main.tsx`
   - `index.html`

8. **Test:**
   - `pnpm dev`
   - Verify marketing pages have HTML in view-source
   - Verify chat app works after navigation
   - Verify login/register forms work with JS disabled

## Timeline

| Phase | Scope |
|-------|-------|
| Phase 1 | Update @chaaskit/client exports |
| Phase 2 | Update @chaaskit/server (remove SSR, add loaders) |
| Phase 3 | Create React Router route templates |
| Phase 4 | Update create-chaaskit templates |
| Phase 5 | Helper components |
| Phase 6 | Migrate chaaskit-app manually |
| Phase 7 | Documentation updates |
