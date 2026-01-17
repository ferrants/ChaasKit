import { Router, type RequestHandler } from 'express';
import { HTTP_STATUS } from '@chaaskit/shared';
import type { MentionableDocument, DocumentScope } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';
import { documentService } from '../services/documents.js';
import { extractText } from '../documents/extractors.js';
import multer from 'multer';

export const documentsRouter = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Default 10MB, will be checked against config
  },
});

// Middleware to check if documents feature is enabled
const requireDocumentsEnabled: RequestHandler = (req, res, next) => {
  const config = getConfig();
  if (!config.documents?.enabled) {
    return next(new AppError(HTTP_STATUS.FORBIDDEN, 'Documents are not enabled'));
  }
  next();
};

// Apply documents enabled check to all routes
documentsRouter.use(requireDocumentsEnabled);

// List documents
documentsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { scope, teamId, projectId, query } = req.query;

    const documents = await documentService.search(userId, {
      query: query as string | undefined,
      scopes: scope ? [scope as DocumentScope] : undefined,
      teamId: teamId as string | undefined,
      projectId: projectId as string | undefined,
    });

    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

// Create document (text content)
documentsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { name, content, mimeType, teamId, projectId } = req.body;

    if (!name || typeof name !== 'string') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Document name is required');
    }

    // Validate team access if teamId provided
    if (teamId) {
      const hasAccess = await checkTeamAccess(userId, teamId);
      if (!hasAccess) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'No access to this team');
      }
    }

    // Validate project access if projectId provided
    if (projectId) {
      const hasAccess = await checkProjectAccess(userId, projectId);
      if (!hasAccess) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'No access to this project');
      }
    }

    const document = await documentService.create(
      {
        name,
        content: content || '',
        mimeType: mimeType || 'text/plain',
        teamId,
        projectId,
      },
      userId
    );

    res.status(HTTP_STATUS.CREATED).json({ document });
  } catch (error) {
    next(error);
  }
});

// Upload document (file)
documentsRouter.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const config = getConfig();
    const file = req.file;

    if (!file) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'No file uploaded');
    }

    // Check file size against config
    const maxSizeBytes = (config.documents?.maxFileSizeMB || 10) * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        `File too large. Maximum size is ${config.documents?.maxFileSizeMB || 10}MB`
      );
    }

    // Check MIME type
    const acceptedTypes = config.documents?.acceptedTypes || [
      'text/plain',
      'text/markdown',
      'text/x-markdown',
      'text/csv',
      'application/json',
    ];

    if (!acceptedTypes.includes(file.mimetype)) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`
      );
    }

    // Get name from form data or original filename
    const name = (req.body.name as string) || file.originalname.replace(/\.[^/.]+$/, '');
    const teamId = req.body.teamId as string | undefined;
    const projectId = req.body.projectId as string | undefined;

    // Validate team/project access
    if (teamId) {
      const hasAccess = await checkTeamAccess(userId, teamId);
      if (!hasAccess) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'No access to this team');
      }
    }

    if (projectId) {
      const hasAccess = await checkProjectAccess(userId, projectId);
      if (!hasAccess) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'No access to this project');
      }
    }

    const document = await documentService.create(
      {
        name,
        mimeType: file.mimetype,
        teamId,
        projectId,
        fileBuffer: file.buffer,
      },
      userId
    );

    res.status(HTTP_STATUS.CREATED).json({ document });
  } catch (error) {
    next(error);
  }
});

// Get document metadata
documentsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const document = await documentService.get(id, userId);
    if (!document) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Document not found');
    }

    res.json({ document });
  } catch (error) {
    next(error);
  }
});

// Get document content
documentsRouter.get('/:id/content', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { offset, limit } = req.query;

    const result = await documentService.getContent(id, userId, {
      offset: offset ? parseInt(offset as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    if (!result) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Document not found');
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update document
documentsRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, content } = req.body;

    // Check edit permission
    const canEdit = await documentService.canEdit(id, userId);
    if (!canEdit) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'No permission to edit this document');
    }

    const document = await documentService.update(id, { name, content }, userId);
    if (!document) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Document not found');
    }

    res.json({ document });
  } catch (error) {
    next(error);
  }
});

// Archive (delete) document
documentsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Check edit permission (same as delete permission)
    const canEdit = await documentService.canEdit(id, userId);
    if (!canEdit) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'No permission to delete this document');
    }

    const success = await documentService.archive(id, userId);
    if (!success) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Document not found');
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Helper functions
import { db } from '@chaaskit/db';

async function checkTeamAccess(userId: string, teamId: string): Promise<boolean> {
  const membership = await db.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
  });
  return !!membership;
}

async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },
        {
          team: {
            members: { some: { userId } },
          },
        },
      ],
    },
  });
  return !!project;
}
