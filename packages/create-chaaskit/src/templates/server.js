/**
 * Production server that serves both the API and the React Router SSR app.
 *
 * This is a single server that handles:
 * - API routes at /api/*, /mcp/*, /v1/*
 * - SSR for all other routes via React Router
 *
 * ARCHITECTURE: We create a wrapper Express app that handles React Router routes
 * BEFORE body parsing, then delegates API routes to the chaaskit app (which has
 * body parsing). This prevents the body stream from being consumed before React
 * Router can read it with request.formData().
 *
 * SECRETS: Configure secret loading via environment variables:
 *   SECRETS_PROVIDER=env                 (default) - secrets already in env vars
 *   SECRETS_PROVIDER=aws-secrets-manager - load from AWS Secrets Manager
 *     AWS_SECRET_ARN - ARN of the secret to load
 *     AWS_REGION - Region (optional, defaults to 'us-west-2')
 */

// Load secrets BEFORE importing anything that uses them (Prisma, etc.)
const { loadSecrets } = await import('@chaaskit/server');
await loadSecrets();

// Now safe to import modules that depend on DATABASE_URL, OPENAI_API_KEY, etc.
const { createApp } = await import('@chaaskit/server');
const { createRequestHandler } = await import('@react-router/express');
const express = (await import('express')).default;
const path = (await import('path')).default;
const { fileURLToPath } = await import('url');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  // Create the chaaskit Express app with all API routes (has body parsing)
  const chaaskitApp = await createApp({ serveSpa: false });

  // Create wrapper Express app (NO body parsing here)
  const app = express();

  // Trust proxy headers when behind load balancer (ALB, nginx, CloudFlare, etc.)
  app.set('trust proxy', true);

  // Serve static assets FIRST (before any other processing)
  app.use(
    '/assets',
    express.static(path.join(__dirname, 'build/client/assets'), {
      immutable: true,
      maxAge: '1y',
    })
  );
  app.use(express.static(path.join(__dirname, 'build/client'), { maxAge: '1h' }));

  // Delegate API routes to chaaskit app (which has body parsing)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/v1/') || req.path.startsWith('/mcp/')) {
      return chaaskitApp(req, res, next);
    }
    next();
  });

  // Handle all other routes with React Router SSR
  // No body parsing has occurred, so request.formData() works
  app.all(
    '*',
    createRequestHandler({
      // @ts-expect-error - build types
      build: await import('./build/server/index.js'),
    })
  );

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`  - API:      http://localhost:${port}/api`);
    console.log(`  - Frontend: http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
