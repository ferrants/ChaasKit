# Adding Custom Pages to Chat-SaaS Applications

This guide explains how to add custom pages (marketing pages, landing pages, documentation, etc.) alongside the core chat-saas application.

## Architecture Overview

The chat-saas template uses a split-routing architecture:

```
/           → Custom pages (marketing, docs, etc.)
/app        → Core chat application
/app/*      → All chat app routes
```

The core chat application runs under the `/app` path with its own `BrowserRouter`, while custom pages run at the root level or other paths with a separate router context.

## How It Works

### Entry Point (`src/main.tsx`)

The entry point determines which application to render based on the current URL:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  App,
  AuthProvider,
  ConfigProvider,
  ThemeProvider,
  TeamProvider,
  ProjectProvider,
} from '@chaaskit/client';
import '@chaaskit/client/styles';

import MarketingPage from './MarketingPage';
import PricingPage from './PricingPage'; // Your custom pages

// Core chat application with all required providers
function ChatApp() {
  return (
    <BrowserRouter basename="/app">
      <ConfigProvider basePath="/app">
        <ThemeProvider>
          <AuthProvider>
            <TeamProvider>
              <ProjectProvider>
                <App />
              </ProjectProvider>
            </TeamProvider>
          </AuthProvider>
        </ThemeProvider>
      </ConfigProvider>
    </BrowserRouter>
  );
}

// Root component handles routing split
function Root() {
  // If path starts with /app, render the chat application
  if (window.location.pathname.startsWith('/app')) {
    return <ChatApp />;
  }

  // Otherwise, render custom pages
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MarketingPage appPath="/app" />} />
        <Route path="/pricing" element={<PricingPage appPath="/app" />} />
        <Route path="/about" element={<AboutPage appPath="/app" />} />
        {/* Add more custom routes here */}
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
```

## Adding a New Custom Page

### Step 1: Create the Page Component

Create a new file in `src/` for your page:

```tsx
// src/PricingPage.tsx
import React from 'react';

interface PricingPageProps {
  appPath: string;  // Path to the chat app (typically "/app")
}

export default function PricingPage({ appPath }: PricingPageProps) {
  return (
    <div>
      <nav>
        <a href="/">Home</a>
        <a href={appPath}>Launch App</a>
      </nav>

      <main>
        <h1>Pricing</h1>
        {/* Your pricing content */}
      </main>
    </div>
  );
}
```

### Step 2: Add the Route

Import and add the route in `src/main.tsx`:

```tsx
import PricingPage from './PricingPage';

// In the Root component's BrowserRouter:
<Routes>
  <Route path="/" element={<MarketingPage appPath="/app" />} />
  <Route path="/pricing" element={<PricingPage appPath="/app" />} />
</Routes>
```

## Best Practices

### 1. Pass `appPath` as a Prop

Always pass the app path as a prop rather than hardcoding it. This makes your pages reusable and configurable:

```tsx
interface PageProps {
  appPath: string;
}

export default function MyPage({ appPath }: PageProps) {
  return (
    <a href={appPath}>Go to App</a>
  );
}
```

### 2. Use Regular `<a>` Tags for Cross-Context Navigation

When linking between custom pages and the chat app, use regular `<a>` tags (not React Router's `<Link>`). This triggers a full page load, which is required when crossing between the two router contexts:

```tsx
// Correct: Full page navigation to different router context
<a href="/app">Launch App</a>
<a href="/">Back to Home</a>

// Incorrect: React Router Link won't work across contexts
<Link to="/app">Launch App</Link>
```

### 3. Use `<Link>` Within the Same Context

Within custom pages, you can use React Router's `<Link>` for navigation between custom pages:

```tsx
import { Link } from 'react-router-dom';

// Within custom pages (same router context)
<Link to="/pricing">View Pricing</Link>
<Link to="/about">About Us</Link>
```

### 4. Styling Approaches

Custom pages don't have access to chat-saas styles by default. You have several options:

**Inline Styles (Simple, No Dependencies)**
```tsx
<div style={{ padding: '20px', backgroundColor: '#0f0f0f' }}>
  Content
</div>
```

**CSS Modules**
```tsx
import styles from './PricingPage.module.css';
<div className={styles.container}>Content</div>
```

**Tailwind or Other CSS Frameworks**
Configure in your `vite.config.ts` and use throughout custom pages.

### 5. Shared Components

Create reusable components for elements shared across custom pages:

```
src/
  components/
    marketing/
      Header.tsx      # Shared navigation
      Footer.tsx      # Shared footer
      Button.tsx      # Styled buttons
  MarketingPage.tsx
  PricingPage.tsx
  main.tsx
```

## Server Configuration

### Development (Vite)

The Vite dev server handles client-side routing automatically. No special configuration needed beyond the proxy for API calls:

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### Production

For production, configure your web server to:

1. Serve the SPA for all routes (fallback to `index.html`)
2. Proxy `/api` requests to the chat-saas backend

**Nginx Example:**
```nginx
server {
    listen 80;
    root /var/www/app/dist;
    index index.html;

    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Example: Complete Custom Page

Here's a complete example of a pricing page following all best practices:

```tsx
// src/PricingPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';

interface PricingPageProps {
  appPath: string;
}

const plans = [
  { name: 'Free', price: '$0', features: ['5 projects', 'Basic AI'] },
  { name: 'Pro', price: '$29', features: ['Unlimited projects', 'Advanced AI'] },
];

export default function PricingPage({ appPath }: PricingPageProps) {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Navigation */}
      <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between' }}>
        <Link to="/" style={{ textDecoration: 'none', fontWeight: 600 }}>
          Brand
        </Link>
        <div style={{ display: 'flex', gap: '24px' }}>
          <Link to="/pricing">Pricing</Link>
          <a href={appPath}>Launch App</a>
        </div>
      </nav>

      {/* Content */}
      <main style={{ padding: '80px 40px', textAlign: 'center' }}>
        <h1>Simple, Transparent Pricing</h1>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '48px' }}>
          {plans.map((plan) => (
            <div key={plan.name} style={{ padding: '32px', border: '1px solid #eee', borderRadius: '12px' }}>
              <h2>{plan.name}</h2>
              <p style={{ fontSize: '32px', fontWeight: 700 }}>{plan.price}</p>
              <ul style={{ textAlign: 'left' }}>
                {plan.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <a
                href={appPath}
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  backgroundColor: '#0f0f0f',
                  color: 'white',
                  borderRadius: '8px',
                  textDecoration: 'none',
                }}
              >
                Get Started
              </a>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
```

## Summary

| Aspect | Custom Pages | Chat App |
|--------|--------------|----------|
| Path | `/`, `/pricing`, etc. | `/app/*` |
| Router | Own `BrowserRouter` | `BrowserRouter` with `basename="/app"` |
| Providers | None required | All chat-saas providers |
| Styles | Custom (inline, CSS modules, etc.) | `@chaaskit/client/styles` |
| Navigation to other context | `<a href="...">` | `<a href="...">` |
| Navigation within context | `<Link to="...">` | React Router |
