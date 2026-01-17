import { db } from '@chaaskit/db';
import type {
  DocumentScope,
  MentionableDocument,
  ResolvedDocument,
  CreateDocumentInput,
  UpdateDocumentInput,
  ParsedMention,
} from '@chaaskit/shared';
import { getStorageProvider } from '../storage/index.js';
import { extractText } from '../documents/extractors.js';

/**
 * Service for managing documents and mentions
 */
export class DocumentService {
  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Create a new document
   */
  async create(
    input: CreateDocumentInput & { fileBuffer?: Buffer },
    userId: string
  ): Promise<MentionableDocument> {
    let content = input.content || '';
    let charCount = content.length;

    // If a file buffer is provided, extract text
    if (input.fileBuffer) {
      content = await extractText(input.fileBuffer, input.mimeType || 'text/plain');
      charCount = content.length;
    }

    const doc = await db.document.create({
      data: {
        name: input.name,
        content: content,
        mimeType: input.mimeType || 'text/plain',
        fileSize: input.fileBuffer?.length || Buffer.byteLength(content, 'utf-8'),
        charCount,
        userId,
        teamId: input.teamId || null,
        projectId: input.projectId || null,
      },
      include: {
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return this.toMentionableDocument(doc);
  }

  /**
   * Update an existing document
   */
  async update(
    id: string,
    input: UpdateDocumentInput & { fileBuffer?: Buffer; mimeType?: string },
    userId: string
  ): Promise<MentionableDocument | null> {
    // Check access
    const existing = await this.get(id, userId);
    if (!existing) {
      return null;
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.content !== undefined || input.fileBuffer) {
      let content = input.content || '';

      if (input.fileBuffer) {
        content = await extractText(input.fileBuffer, input.mimeType || 'text/plain');
      }

      updateData.content = content;
      updateData.charCount = content.length;
      updateData.fileSize = Buffer.byteLength(content, 'utf-8');

      if (input.mimeType) {
        updateData.mimeType = input.mimeType;
      }
    }

    const doc = await db.document.update({
      where: { id },
      data: updateData,
      include: {
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return this.toMentionableDocument(doc);
  }

  /**
   * Archive (soft delete) a document
   */
  async archive(id: string, userId: string): Promise<boolean> {
    const doc = await this.get(id, userId);
    if (!doc) {
      return false;
    }

    await db.document.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    return true;
  }

  /**
   * Get a document by ID
   */
  async get(id: string, userId: string): Promise<MentionableDocument | null> {
    const doc = await db.document.findFirst({
      where: {
        id,
        archivedAt: null,
        OR: [
          { userId },
          {
            team: {
              members: { some: { userId } },
            },
          },
          {
            project: {
              OR: [
                { userId },
                { team: { members: { some: { userId } } } },
              ],
            },
          },
        ],
      },
      include: {
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!doc) {
      return null;
    }

    return this.toMentionableDocument(doc);
  }

  // ==========================================================================
  // Content Access
  // ==========================================================================

  /**
   * Get document content with optional pagination
   */
  async getContent(
    id: string,
    userId: string,
    options?: { offset?: number; limit?: number }
  ): Promise<{ content: string; totalLines: number; truncated: boolean } | null> {
    const doc = await db.document.findFirst({
      where: {
        id,
        archivedAt: null,
        OR: [
          { userId },
          { team: { members: { some: { userId } } } },
          {
            project: {
              OR: [{ userId }, { team: { members: { some: { userId } } } }],
            },
          },
        ],
      },
      select: { content: true, storageKey: true },
    });

    if (!doc) {
      return null;
    }

    let content: string;

    if (doc.content) {
      content = doc.content;
    } else if (doc.storageKey) {
      const storage = getStorageProvider();
      const buffer = await storage.download(doc.storageKey);
      content = buffer.toString('utf-8');
    } else {
      return { content: '', totalLines: 0, truncated: false };
    }

    const lines = content.split('\n');
    const totalLines = lines.length;

    if (options?.offset !== undefined || options?.limit !== undefined) {
      const offset = options.offset || 0;
      const limit = options.limit || 100;
      const slicedLines = lines.slice(offset, offset + limit);
      return {
        content: slicedLines.join('\n'),
        totalLines,
        truncated: offset + slicedLines.length < totalLines,
      };
    }

    return { content, totalLines, truncated: false };
  }

  // ==========================================================================
  // Search & List
  // ==========================================================================

  /**
   * Search documents accessible by user
   */
  async search(
    userId: string,
    options?: {
      query?: string;
      scopes?: DocumentScope[];
      teamId?: string;
      projectId?: string;
      limit?: number;
    }
  ): Promise<MentionableDocument[]> {
    const { query, scopes, teamId, projectId, limit = 50 } = options || {};

    // Build scope filter
    const scopeConditions: Array<Record<string, unknown>> = [];

    if (!scopes || scopes.length === 0 || scopes.includes('my')) {
      scopeConditions.push({
        userId,
        teamId: null,
        projectId: null,
      });
    }

    if (!scopes || scopes.length === 0 || scopes.includes('team')) {
      scopeConditions.push({
        teamId: teamId || { not: null },
        team: { members: { some: { userId } } },
      });
    }

    if (!scopes || scopes.length === 0 || scopes.includes('project')) {
      scopeConditions.push({
        projectId: projectId || { not: null },
        project: {
          OR: [{ userId }, { team: { members: { some: { userId } } } }],
        },
      });
    }

    const docs = await db.document.findMany({
      where: {
        archivedAt: null,
        OR: scopeConditions,
        ...(query && {
          name: { contains: query, mode: 'insensitive' },
        }),
      },
      include: {
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return docs.map((doc) => this.toMentionableDocument(doc));
  }

  /**
   * List all documents for a user (for Documents page)
   */
  async list(
    userId: string,
    options?: {
      scope?: DocumentScope;
      teamId?: string;
      projectId?: string;
    }
  ): Promise<MentionableDocument[]> {
    return this.search(userId, {
      scopes: options?.scope ? [options.scope] : undefined,
      teamId: options?.teamId,
      projectId: options?.projectId,
      limit: 200,
    });
  }

  // ==========================================================================
  // Path Resolution
  // ==========================================================================

  /**
   * Build the full path for a document
   * Format: @my/name, @team/slug/name, @project/slug/name
   */
  buildPath(doc: {
    name: string;
    teamId: string | null;
    projectId: string | null;
    team?: { name: string } | null;
    project?: { name: string } | null;
  }): string {
    if (doc.projectId && doc.project) {
      const slug = this.slugify(doc.project.name);
      return `@project/${slug}/${doc.name}`;
    }

    if (doc.teamId && doc.team) {
      const slug = this.slugify(doc.team.name);
      return `@team/${slug}/${doc.name}`;
    }

    return `@my/${doc.name}`;
  }

  /**
   * Resolve a path to a document
   */
  async resolvePath(path: string, userId: string): Promise<MentionableDocument | null> {
    const parsed = this.parsePath(path);
    if (!parsed) {
      return null;
    }

    const { scope, scopeSlug, name } = parsed;

    let doc;

    if (scope === 'my') {
      doc = await db.document.findFirst({
        where: {
          name,
          userId,
          teamId: null,
          projectId: null,
          archivedAt: null,
        },
        include: {
          team: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });
    } else if (scope === 'team' && scopeSlug) {
      doc = await db.document.findFirst({
        where: {
          name,
          archivedAt: null,
          team: {
            members: { some: { userId } },
          },
        },
        include: {
          team: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });

      // Filter by slug match
      if (doc && doc.team && this.slugify(doc.team.name) !== scopeSlug) {
        doc = null;
      }
    } else if (scope === 'project' && scopeSlug) {
      doc = await db.document.findFirst({
        where: {
          name,
          archivedAt: null,
          project: {
            OR: [{ userId }, { team: { members: { some: { userId } } } }],
          },
        },
        include: {
          team: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });

      // Filter by slug match
      if (doc && doc.project && this.slugify(doc.project.name) !== scopeSlug) {
        doc = null;
      }
    }

    if (!doc) {
      return null;
    }

    return this.toMentionableDocument(doc);
  }

  /**
   * Resolve multiple paths
   */
  async resolveMany(
    paths: string[],
    userId: string
  ): Promise<Map<string, MentionableDocument | null>> {
    const results = new Map<string, MentionableDocument | null>();

    for (const path of paths) {
      const doc = await this.resolvePath(path, userId);
      results.set(path, doc);
    }

    return results;
  }

  /**
   * Resolve documents and get their content for context injection
   */
  async resolveForContext(
    paths: string[],
    userId: string
  ): Promise<ResolvedDocument[]> {
    const resolved: ResolvedDocument[] = [];

    for (const path of paths) {
      const doc = await this.resolvePath(path, userId);
      if (!doc) continue;

      const contentResult = await this.getContent(doc.id, userId);
      if (!contentResult) continue;

      resolved.push({
        id: doc.id,
        path: doc.path,
        name: doc.name,
        content: contentResult.content,
        truncated: contentResult.truncated,
        charCount: doc.charCount,
      });
    }

    return resolved;
  }

  // ==========================================================================
  // Mention Parsing
  // ==========================================================================

  /**
   * Parse mentions from message content
   * Finds patterns like @my/doc-name, @team/slug/name, @project/slug/name
   */
  parseMentions(content: string): ParsedMention[] {
    const mentions: ParsedMention[] = [];

    // Match @scope/name or @scope/slug/name patterns
    // Allow alphanumeric, hyphens, underscores, and dots in names/slugs
    const regex = /@(my|team|project)\/([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)?)/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
      mentions.push({
        path: match[0],
        raw: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return mentions;
  }

  // ==========================================================================
  // Permission Checks
  // ==========================================================================

  /**
   * Check if a user can access a document
   */
  async canAccess(documentId: string, userId: string): Promise<boolean> {
    const doc = await this.get(documentId, userId);
    return doc !== null;
  }

  /**
   * Check if a user can edit a document
   */
  async canEdit(documentId: string, userId: string): Promise<boolean> {
    const doc = await db.document.findFirst({
      where: {
        id: documentId,
        archivedAt: null,
        OR: [
          // Owner can always edit
          { userId },
          // Team admin/owner can edit team docs
          {
            teamId: { not: null },
            team: {
              members: {
                some: {
                  userId,
                  role: { in: ['owner', 'admin'] },
                },
              },
            },
          },
          // Project owner or team admin can edit project docs
          {
            projectId: { not: null },
            project: {
              OR: [
                { userId },
                {
                  team: {
                    members: {
                      some: {
                        userId,
                        role: { in: ['owner', 'admin'] },
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });

    return doc !== null;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Convert DB document to MentionableDocument
   */
  private toMentionableDocument(
    doc: {
      id: string;
      name: string;
      mimeType: string;
      charCount: number;
      userId: string;
      teamId: string | null;
      projectId: string | null;
      createdAt: Date;
      updatedAt: Date;
      team?: { id: string; name: string } | null;
      project?: { id: string; name: string } | null;
    }
  ): MentionableDocument {
    let scope: DocumentScope = 'my';
    let scopeName: string | undefined;
    let scopeId: string | undefined;

    if (doc.projectId && doc.project) {
      scope = 'project';
      scopeName = doc.project.name;
      scopeId = doc.project.id;
    } else if (doc.teamId && doc.team) {
      scope = 'team';
      scopeName = doc.team.name;
      scopeId = doc.team.id;
    }

    return {
      id: doc.id,
      path: this.buildPath(doc),
      name: doc.name,
      mimeType: doc.mimeType,
      charCount: doc.charCount,
      scope,
      scopeName,
      scopeId,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  /**
   * Parse a path string into components
   */
  private parsePath(
    path: string
  ): { scope: DocumentScope; scopeSlug?: string; name: string } | null {
    // Remove @ prefix if present
    const cleanPath = path.startsWith('@') ? path.slice(1) : path;
    const parts = cleanPath.split('/');

    if (parts.length < 2) {
      return null;
    }

    const scope = parts[0] as DocumentScope;
    if (!['my', 'team', 'project'].includes(scope)) {
      return null;
    }

    if (scope === 'my') {
      return { scope, name: parts.slice(1).join('/') };
    }

    // For team/project, expect scope/slug/name
    if (parts.length < 3) {
      return null;
    }

    return {
      scope,
      scopeSlug: parts[1],
      name: parts.slice(2).join('/'),
    };
  }

  /**
   * Convert a name to a URL-safe slug
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

// Export a singleton instance
export const documentService = new DocumentService();
