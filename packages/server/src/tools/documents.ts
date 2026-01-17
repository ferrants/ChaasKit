import type { NativeTool, ToolContext, ToolResult } from './types.js';
import { documentService } from '../services/documents.js';

/**
 * List documents available to the user
 */
export const listDocumentsTool: NativeTool = {
  name: 'list_documents',
  description:
    'List documents available in this conversation. Use this to see what documents can be referenced.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Optional search query to filter documents by name',
      },
      scope: {
        type: 'string',
        enum: ['all', 'my', 'team', 'project'],
        description: 'Filter by scope: all (default), my (personal), team, or project',
        default: 'all',
      },
    },
  },
  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    if (!context.userId) {
      return {
        content: [{ type: 'text', text: 'Authentication required to list documents' }],
        isError: true,
      };
    }

    const query = input.query as string | undefined;
    const scopeInput = (input.scope as string) || 'all';

    const scopes =
      scopeInput === 'all' ? undefined : [scopeInput as 'my' | 'team' | 'project'];

    const docs = await documentService.search(context.userId, {
      query,
      scopes,
      limit: 50,
    });

    if (docs.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: query
              ? `No documents found matching "${query}"`
              : 'No documents found. You can create documents on the Documents page.',
          },
        ],
      };
    }

    const docList = docs
      .map((doc) => `- ${doc.path} (${doc.charCount} chars, ${doc.mimeType})`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${docs.length} document(s):\n\n${docList}`,
        },
      ],
      structuredContent: { documents: docs },
    };
  },
};

/**
 * Read content from a document
 */
export const readDocumentTool: NativeTool = {
  name: 'read_document',
  description:
    'Read content from a document. Supports pagination for large documents. Use path format like @my/doc-name, @team/slug/name, or @project/slug/name.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Document path (e.g., @my/notes, @team/engineering/guidelines)',
      },
      offset: {
        type: 'number',
        description: 'Start line (0-indexed, default: 0)',
      },
      limit: {
        type: 'number',
        description: 'Maximum lines to return (default: 100)',
      },
    },
    required: ['path'],
  },
  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    if (!context.userId) {
      return {
        content: [{ type: 'text', text: 'Authentication required to read documents' }],
        isError: true,
      };
    }

    const path = input.path as string;
    const offset = (input.offset as number) || 0;
    const limit = (input.limit as number) || 100;

    const doc = await documentService.resolvePath(path, context.userId);
    if (!doc) {
      return {
        content: [{ type: 'text', text: `Document not found: ${path}` }],
        isError: true,
      };
    }

    const result = await documentService.getContent(doc.id, context.userId, {
      offset,
      limit,
    });

    if (!result) {
      return {
        content: [{ type: 'text', text: `Could not read document: ${path}` }],
        isError: true,
      };
    }

    // Add line numbers
    const lines = result.content.split('\n');
    const numberedContent = lines
      .map((line, i) => `${(offset + i + 1).toString().padStart(4, ' ')} | ${line}`)
      .join('\n');

    let header = `Document: ${path}\n`;
    header += `Lines ${offset + 1}-${offset + lines.length} of ${result.totalLines}`;
    if (result.truncated) {
      header += ` (more content available)`;
    }
    header += '\n\n';

    return {
      content: [{ type: 'text', text: header + numberedContent }],
      structuredContent: {
        path,
        offset,
        linesReturned: lines.length,
        totalLines: result.totalLines,
        truncated: result.truncated,
      },
    };
  },
};

/**
 * Search for text within a document
 */
export const searchInDocumentTool: NativeTool = {
  name: 'search_in_document',
  description:
    'Search for text within a document. Returns matching lines with surrounding context.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Document path (e.g., @my/notes)',
      },
      query: {
        type: 'string',
        description: 'Text to search for',
      },
      context_lines: {
        type: 'number',
        description: 'Number of lines to show before and after each match (default: 3)',
      },
    },
    required: ['path', 'query'],
  },
  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    if (!context.userId) {
      return {
        content: [{ type: 'text', text: 'Authentication required to search documents' }],
        isError: true,
      };
    }

    const path = input.path as string;
    const query = input.query as string;
    const contextLines = (input.context_lines as number) || 3;

    const doc = await documentService.resolvePath(path, context.userId);
    if (!doc) {
      return {
        content: [{ type: 'text', text: `Document not found: ${path}` }],
        isError: true,
      };
    }

    const result = await documentService.getContent(doc.id, context.userId);
    if (!result) {
      return {
        content: [{ type: 'text', text: `Could not read document: ${path}` }],
        isError: true,
      };
    }

    const lines = result.content.split('\n');
    const lowerQuery = query.toLowerCase();

    // Find matching line indices
    const matches: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lowerQuery)) {
        matches.push(i);
      }
    }

    if (matches.length === 0) {
      return {
        content: [{ type: 'text', text: `No matches found for "${query}" in ${path}` }],
      };
    }

    // Build output with context
    const outputParts: string[] = [];
    let lastEndLine = -1;

    for (const matchLine of matches) {
      const startLine = Math.max(0, matchLine - contextLines);
      const endLine = Math.min(lines.length - 1, matchLine + contextLines);

      // Add separator if there's a gap
      if (lastEndLine !== -1 && startLine > lastEndLine + 1) {
        outputParts.push('...');
      }

      // Add context lines (avoid duplicates)
      const actualStart = Math.max(startLine, lastEndLine + 1);
      for (let i = actualStart; i <= endLine; i++) {
        const prefix = i === matchLine ? '>>> ' : '    ';
        outputParts.push(`${(i + 1).toString().padStart(4, ' ')} ${prefix}${lines[i]}`);
      }

      lastEndLine = endLine;
    }

    const header = `Found ${matches.length} match(es) for "${query}" in ${path}:\n\n`;

    return {
      content: [{ type: 'text', text: header + outputParts.join('\n') }],
      structuredContent: {
        path,
        query,
        matchCount: matches.length,
        matchLines: matches.map((i) => i + 1),
      },
    };
  },
};

/**
 * Save content as a new document
 */
export const saveDocumentTool: NativeTool = {
  name: 'save_document',
  description:
    'Save content as a new document. Use when the user asks to save generated content, notes, or summaries.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Document name (e.g., "meeting-notes", "api-summary")',
      },
      content: {
        type: 'string',
        description: 'Content to save',
      },
      scope: {
        type: 'string',
        enum: ['my', 'team', 'project'],
        description: 'Where to save: my (personal, default), team, or project',
        default: 'my',
      },
      scopeId: {
        type: 'string',
        description: 'Team or project ID (required if scope is team/project)',
      },
    },
    required: ['name', 'content'],
  },
  async execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    if (!context.userId) {
      return {
        content: [{ type: 'text', text: 'Authentication required to save documents' }],
        isError: true,
      };
    }

    const name = input.name as string;
    const content = input.content as string;
    const scope = (input.scope as string) || 'my';
    const scopeId = input.scopeId as string | undefined;

    // Validate scope requirements
    if ((scope === 'team' || scope === 'project') && !scopeId) {
      return {
        content: [
          {
            type: 'text',
            text: `A ${scope} ID is required when saving to ${scope} scope. Please specify scopeId.`,
          },
        ],
        isError: true,
      };
    }

    try {
      const doc = await documentService.create(
        {
          name,
          content,
          mimeType: 'text/plain',
          teamId: scope === 'team' ? scopeId : undefined,
          projectId: scope === 'project' ? scopeId : undefined,
        },
        context.userId
      );

      return {
        content: [
          {
            type: 'text',
            text: `Document saved successfully!\n\nPath: ${doc.path}\nSize: ${doc.charCount} characters\n\nYou can reference this document in future messages using ${doc.path}`,
          },
        ],
        structuredContent: {
          success: true,
          path: doc.path,
          id: doc.id,
          charCount: doc.charCount,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Check for unique constraint violation
      if (message.includes('Unique constraint')) {
        return {
          content: [
            {
              type: 'text',
              text: `A document named "${name}" already exists in this scope. Please choose a different name.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Failed to save document: ${message}` }],
        isError: true,
      };
    }
  },
};

/**
 * All document-related tools
 */
export const documentTools: NativeTool[] = [
  listDocumentsTool,
  readDocumentTool,
  searchInDocumentTool,
  saveDocumentTool,
];
