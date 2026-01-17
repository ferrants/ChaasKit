import { Router } from 'express';
import { HTTP_STATUS } from '@chaaskit/shared';
import type { DocumentScope } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';
import { documentService } from '../services/documents.js';

export const mentionsRouter = Router();

// Middleware to check if documents feature is enabled
mentionsRouter.use((req, res, next) => {
  const config = getConfig();
  if (!config.documents?.enabled) {
    return next(new AppError(HTTP_STATUS.FORBIDDEN, 'Documents are not enabled'));
  }
  next();
});

/**
 * Search mentionable resources
 * GET /api/mentions/search?q=query&scope=my|team|project&teamId=...&projectId=...
 */
mentionsRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { q, scope, teamId, projectId, limit } = req.query;

    const documents = await documentService.search(userId, {
      query: q as string | undefined,
      scopes: scope ? [scope as DocumentScope] : undefined,
      teamId: teamId as string | undefined,
      projectId: projectId as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    // Group by scope for easier frontend rendering
    const grouped = {
      my: documents.filter((d) => d.scope === 'my'),
      team: documents.filter((d) => d.scope === 'team'),
      project: documents.filter((d) => d.scope === 'project'),
    };

    res.json({
      documents,
      grouped,
      hasMore: documents.length >= (limit ? parseInt(limit as string, 10) : 20),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Resolve document paths to metadata
 * POST /api/mentions/resolve
 * Body: { paths: ["@my/doc1", "@team/eng/doc2"] }
 */
mentionsRouter.post('/resolve', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { paths } = req.body;

    if (!Array.isArray(paths)) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'paths must be an array');
    }

    const resolved = await documentService.resolveMany(paths, userId);

    // Convert Map to object for JSON response
    const result: Record<string, unknown> = {};
    for (const [path, doc] of resolved) {
      result[path] = doc;
    }

    res.json({ resolved: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get available mention types
 * GET /api/mentions/types
 */
mentionsRouter.get('/types', requireAuth, async (req, res, next) => {
  try {
    // For now, only documents are supported
    // This endpoint can be extended when other mention providers are added
    const types = [
      {
        type: 'document',
        name: 'Documents',
        icon: 'file-text',
        description: 'Reference uploaded documents',
        pathPattern: '@my/name, @team/slug/name, @project/slug/name',
      },
    ];

    res.json({ types });
  } catch (error) {
    next(error);
  }
});
