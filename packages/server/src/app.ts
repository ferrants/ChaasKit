import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AppConfig } from '@chaaskit/shared';

import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authRouter } from './api/auth.js';
import { threadsRouter } from './api/threads.js';
import { chatRouter } from './api/chat.js';
import { userRouter } from './api/user.js';
import { paymentsRouter } from './api/payments.js';
import { searchRouter } from './api/search.js';
import { shareRouter } from './api/share.js';
import { exportRouter } from './api/export.js';
import { templatesRouter } from './api/templates.js';
import { mcpRouter } from './api/mcp.js';
import { healthRouter } from './api/health.js';
import { configRouter } from './api/config.js';
import { agentsRouter } from './api/agents.js';
import { teamsRouter } from './api/teams.js';
import { projectsRouter } from './api/projects.js';
import { adminRouter } from './api/admin.js';
import { creditsRouter } from './api/credits.js';
import { apiKeysRouter } from './api/api-keys.js';
import { openaiRouter } from './api/v1/openai.js';
import { mcpServerRouter } from './api/mcp-server.js';
import { oauthRouter } from './api/oauth.js';
import { documentsRouter } from './api/documents.js';
import { mentionsRouter } from './api/mentions.js';
import { slackRouter } from './api/slack.js';
import { scheduledPromptsRouter } from './api/scheduled-prompts.js';
import { setConfig, loadConfigAsync, getConfig } from './config/loader.js';
import { loadExtensions } from './extensions/loader.js';
import { apiKeyAuth } from './middleware/apiKeyAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CreateAppOptions {
  /**
   * App configuration. If provided, skips config file resolution.
   */
  config?: AppConfig;
  /**
   * Base path for loading extensions. Defaults to process.cwd().
   */
  extensionsPath?: string;
  /**
   * Whether to load extensions from the extensionsPath. Defaults to true.
   */
  loadExtensions?: boolean;
  /**
   * Whether to serve static files and SPA fallback in production.
   * Set to false when using React Router SSR or another SSR framework.
   * Defaults to true.
   */
  serveSpa?: boolean;
}

/**
 * Creates an Express application with all routes and middleware configured.
 * Does not start the server - use createServer() for that.
 */
export async function createApp(options: CreateAppOptions = {}): Promise<express.Application> {
  // Load configuration
  if (options.config) {
    setConfig(options.config);
  } else {
    await loadConfigAsync();
  }

  // Load extensions if enabled (default: true)
  if (options.loadExtensions !== false) {
    await loadExtensions(options.extensionsPath);
  }

  const app = express();

  // Trust proxy headers (required when behind reverse proxy, tunnel, or load balancer)
  // This enables correct client IP detection for rate limiting and logging
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const apiUrl = process.env.API_URL || '';
  const extraOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([appUrl, apiUrl, ...extraOrigins].filter(Boolean));

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed'), false);
    },
    credentials: true,
  }));

  // Rate limiting (configurable via config.rateLimit)
  const config = getConfig();
  const rateLimitConfig = config.rateLimit;
  if (rateLimitConfig?.enabled !== false) {
    const limiter = rateLimit({
      windowMs: rateLimitConfig?.windowMs ?? 15 * 60 * 1000, // Default: 15 minutes
      max: rateLimitConfig?.max ?? 1000, // Default: 1000 requests per window (increased from 100)
      message: rateLimitConfig?.message ?? 'Too many requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/', limiter);
  }

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Request logging
  app.use(requestLogger);

  // API key authentication (before routes, allows API key auth for supported endpoints)
  app.use('/api/', apiKeyAuth);
  app.use('/v1/', apiKeyAuth);

  // OpenAI-compatible API (v1)
  app.use('/v1', openaiRouter);

  // MCP Server endpoint (for external MCP clients)
  app.use('/mcp', mcpServerRouter);

  // OAuth endpoints (for MCP client authentication)
  app.use(oauthRouter);

  // API Routes
  app.use('/api/health', healthRouter);
  app.use('/api/config', configRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/threads', threadsRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/user', userRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/share', shareRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/mcp', mcpRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/credits', creditsRouter);
  app.use('/api/api-keys', apiKeysRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/mentions', mentionsRouter);
  app.use('/api/slack', slackRouter);
  app.use('/api/scheduled-prompts', scheduledPromptsRouter);

  // Note: SSR is handled by React Router v7 in consumer apps.
  // The server only provides API endpoints.

  // Serve static files in production (can be disabled for React Router SSR setups)
  if (process.env.NODE_ENV === 'production' && options.serveSpa !== false) {
    // Try multiple possible locations for the client dist
    const possiblePaths = [
      // When installed as npm package, client dist may be in node_modules
      path.join(process.cwd(), 'node_modules', '@chaaskit', 'client', 'dist'),
      // Or relative to this package
      path.join(__dirname, '../client/dist'),
      // Or in the user's project
      path.join(process.cwd(), 'dist', 'client'),
    ];

    let clientDistPath = possiblePaths[1]; // Default to relative path
    for (const p of possiblePaths) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(path.join(p, 'index.html'))) {
          clientDistPath = p;
          break;
        }
      } catch {
        // Continue to next path
      }
    }

    // Serve static assets
    app.use(express.static(clientDistPath));

    // SPA fallback - serve index.html for all non-API routes
    // Note: In React Router v7 setups, this should be disabled (serveSpa: false)
    // and the consumer app handles SSR.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // Error handling
  app.use(errorHandler);

  return app;
}
