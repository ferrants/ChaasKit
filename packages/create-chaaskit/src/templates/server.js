/**
 * Production server that serves both the API and the React Router SSR app.
 *
 * This is a single server that handles:
 * - API routes at /api/*, /mcp/*, /v1/*
 * - SSR for all other routes via React Router
 */
import { createApp } from '@chaaskit/server';
import { createRequestHandler } from '@react-router/express';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  // Create the chaaskit Express app with all API routes
  // serveSpa: false disables the built-in SPA fallback since React Router handles SSR
  const app = await createApp({ serveSpa: false });

  // Serve static assets from the React Router build
  app.use(
    '/assets',
    express.static(path.join(__dirname, 'build/client/assets'), {
      immutable: true,
      maxAge: '1y',
    })
  );
  app.use(express.static(path.join(__dirname, 'build/client'), { maxAge: '1h' }));

  // Handle all other routes with React Router SSR
  // This must come after API routes (which are already registered in createApp)
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
