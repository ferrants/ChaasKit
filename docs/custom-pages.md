# Custom Pages

This guide explains how to add custom pages (marketing pages, landing pages, documentation, etc.) to your ChaasKit application using React Router v7's file-based routing.

## Architecture Overview

ChaasKit uses React Router v7 framework mode with file-based routing. Pages are created by adding files to the `app/routes/` directory:

```
app/routes/
├── _index.tsx              # / (landing page)
├── login.tsx               # /login
├── register.tsx            # /register
├── pricing.tsx             # /pricing
├── about.tsx               # /about
├── chat._index.tsx         # /chat (main chat)
├── chat.thread.$threadId.tsx  # /chat/thread/:id
└── chat.documents.tsx      # /chat/documents
```

The `basePath` configuration (typically `/chat`) determines where the authenticated chat app lives, leaving the root path available for marketing pages.

## Adding a New Page

### Step 1: Create the Route File

Create a new file in `app/routes/`. The filename determines the URL path:

```tsx
// app/routes/pricing.tsx
// This creates a route at /pricing

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between p-6">
        <a href="/" className="text-xl font-bold text-text-primary">
          MyApp
        </a>
        <div className="flex items-center gap-6">
          <a href="/pricing" className="text-text-secondary hover:text-text-primary">
            Pricing
          </a>
          <a href="/chat" className="rounded-lg bg-primary px-4 py-2 text-white">
            Launch App
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-bold text-text-primary text-center">
          Simple, Transparent Pricing
        </h1>
        {/* Your pricing content */}
      </main>
    </div>
  );
}
```

### Step 2: Add Server-Side Data Loading (Optional)

Use a loader function for server-side data fetching:

```tsx
// app/routes/pricing.tsx
import type { Route } from './+types/pricing';

export async function loader({ request }: Route.LoaderArgs) {
  // Fetch pricing plans from your API or database
  const plans = await fetchPricingPlans();
  return { plans };
}

export default function PricingPage({ loaderData }: Route.ComponentProps) {
  const { plans } = loaderData;

  return (
    <div className="min-h-screen bg-background">
      {/* Your page content using plans data */}
    </div>
  );
}
```

## Route Naming Convention

React Router v7 uses dot notation for nested routes:

| Filename | URL Path | Description |
|----------|----------|-------------|
| `_index.tsx` | `/` | Root index page |
| `pricing.tsx` | `/pricing` | Simple route |
| `about.tsx` | `/about` | Simple route |
| `blog._index.tsx` | `/blog` | Blog index |
| `blog.$slug.tsx` | `/blog/:slug` | Blog post with dynamic slug |
| `chat._index.tsx` | `/chat` | Chat app index |
| `chat.thread.$threadId.tsx` | `/chat/thread/:id` | Chat thread |

The `$` prefix creates dynamic segments (URL parameters).

## Accessing URL Parameters

For dynamic routes, access parameters in the loader or component:

```tsx
// app/routes/blog.$slug.tsx
import type { Route } from './+types/blog.$slug';

export async function loader({ params }: Route.LoaderArgs) {
  const post = await getPostBySlug(params.slug);
  if (!post) {
    throw new Response('Not Found', { status: 404 });
  }
  return { post };
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData;
  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}
```

## Sharing Layout Between Pages

### Option 1: Layout Route

Create a layout route that wraps child routes:

```tsx
// app/routes/marketing.tsx
// This wraps all routes starting with /marketing/*

import { Outlet } from 'react-router';

export default function MarketingLayout() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        {/* Shared navigation */}
      </nav>
      <Outlet />
      <footer className="border-t border-border">
        {/* Shared footer */}
      </footer>
    </div>
  );
}
```

Then create child routes:

```
app/routes/
├── marketing.tsx           # Layout wrapper
├── marketing._index.tsx    # /marketing
├── marketing.about.tsx     # /marketing/about
└── marketing.contact.tsx   # /marketing/contact
```

### Option 2: Shared Component

Create a reusable layout component:

```tsx
// app/components/MarketingLayout.tsx
import { Link } from 'react-router';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between p-6 border-b border-border">
        <Link to="/" className="text-xl font-bold text-text-primary">
          MyApp
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/pricing" className="text-text-secondary hover:text-text-primary">
            Pricing
          </Link>
          <Link to="/about" className="text-text-secondary hover:text-text-primary">
            About
          </Link>
          <Link to="/chat" className="rounded-lg bg-primary px-4 py-2 text-white">
            Launch App
          </Link>
        </div>
      </nav>
      <main>{children}</main>
      <footer className="border-t border-border p-6 text-center text-text-muted">
        &copy; 2024 MyApp
      </footer>
    </div>
  );
}
```

Use it in your pages:

```tsx
// app/routes/pricing.tsx
import { MarketingLayout } from '~/components/MarketingLayout';

export default function PricingPage() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1>Pricing</h1>
        {/* Content */}
      </div>
    </MarketingLayout>
  );
}
```

## Styling Custom Pages

### Using ChaasKit's Theme

Custom pages automatically have access to the theme CSS variables defined in `root.tsx`:

```tsx
// Theme classes work everywhere
<div className="bg-background text-text-primary">
  <button className="bg-primary hover:bg-primary-hover text-white">
    Click me
  </button>
</div>
```

### Custom Styles

Add page-specific styles using Tailwind or CSS modules:

```tsx
// With Tailwind (already configured)
<div className="bg-gradient-to-br from-purple-600 to-blue-500">
  Custom gradient background
</div>
```

## SEO and Meta Tags

Add meta tags using the `meta` export:

```tsx
// app/routes/pricing.tsx
import type { Route } from './+types/pricing';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Pricing - MyApp' },
    { name: 'description', content: 'Simple, transparent pricing for MyApp' },
    { property: 'og:title', content: 'Pricing - MyApp' },
    { property: 'og:description', content: 'Simple, transparent pricing' },
  ];
}

export default function PricingPage() {
  // ...
}
```

## Handling Forms

Use React Router's form handling for actions:

```tsx
// app/routes/contact.tsx
import type { Route } from './+types/contact';
import { Form, useActionData } from 'react-router';

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get('email');
  const message = formData.get('message');

  // Process the form
  await sendContactEmail({ email, message });

  return { success: true };
}

export default function ContactPage() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-md mx-auto p-6">
      {actionData?.success ? (
        <p className="text-success">Thanks for reaching out!</p>
      ) : (
        <Form method="post" className="space-y-4">
          <input
            type="email"
            name="email"
            placeholder="Your email"
            className="w-full rounded-lg border border-input-border bg-input-background px-4 py-2"
          />
          <textarea
            name="message"
            placeholder="Your message"
            className="w-full rounded-lg border border-input-border bg-input-background px-4 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2 text-white"
          >
            Send Message
          </button>
        </Form>
      )}
    </div>
  );
}
```

## Protected Custom Pages

For pages that require authentication, use a loader to check auth:

```tsx
// app/routes/dashboard.tsx
import type { Route } from './+types/dashboard';
import { redirect } from 'react-router';
import { getUser } from '~/utils/auth.server';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect('/login');
  }
  return { user };
}

export default function DashboardPage({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
    </div>
  );
}
```

## Example: Complete Landing Page

```tsx
// app/routes/_index.tsx
import { Link } from 'react-router';

export function meta() {
  return [
    { title: 'MyApp - AI-Powered Chat' },
    { name: 'description', content: 'Build AI chat applications with MyApp' },
  ];
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6">
        <span className="text-xl font-bold text-text-primary">MyApp</span>
        <div className="flex items-center gap-6">
          <Link to="/pricing" className="text-text-secondary hover:text-text-primary">
            Pricing
          </Link>
          <Link to="/login" className="text-text-secondary hover:text-text-primary">
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-hover"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold text-text-primary leading-tight">
          Build AI Chat Apps
          <br />
          <span className="text-primary">In Minutes</span>
        </h1>
        <p className="mt-6 text-xl text-text-secondary max-w-2xl mx-auto">
          ChaasKit gives you everything you need to build production-ready
          AI chat applications with authentication, teams, and more.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            to="/register"
            className="rounded-lg bg-primary px-6 py-3 text-lg font-medium text-white hover:bg-primary-hover"
          >
            Start Building Free
          </Link>
          <Link
            to="/chat"
            className="rounded-lg border border-border px-6 py-3 text-lg font-medium text-text-primary hover:bg-background-secondary"
          >
            View Demo
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-12">
            Everything You Need
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'AI Integration', desc: 'OpenAI and Anthropic support out of the box' },
              { title: 'Authentication', desc: 'Email, OAuth, and magic links built in' },
              { title: 'Team Workspaces', desc: 'Collaborate with shared threads and projects' },
            ].map((feature) => (
              <div key={feature.title} className="rounded-lg bg-background-secondary p-6">
                <h3 className="text-lg font-semibold text-text-primary">{feature.title}</h3>
                <p className="mt-2 text-text-secondary">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-5xl px-6 flex justify-between items-center">
          <span className="text-text-muted">&copy; 2024 MyApp</span>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-text-muted hover:text-text-primary">
              Privacy
            </Link>
            <Link to="/terms" className="text-text-muted hover:text-text-primary">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

## Summary

| Aspect | How It Works |
|--------|--------------|
| Create a page | Add a file to `app/routes/` |
| URL path | Determined by filename (`pricing.tsx` → `/pricing`) |
| Dynamic routes | Use `$` prefix (`blog.$slug.tsx` → `/blog/:slug`) |
| Data loading | Export a `loader` function |
| Form handling | Export an `action` function |
| Meta tags | Export a `meta` function |
| Layouts | Use layout routes or shared components |
| Styling | Tailwind + theme CSS variables |
