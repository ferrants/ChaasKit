/**
 * Types for @-mentionable documents system
 */

export type DocumentScope = 'my' | 'team' | 'project';

export interface DocumentPath {
  scope: DocumentScope;
  scopeSlug?: string;  // team or project slug (for team/project scopes)
  name: string;
}

/**
 * Document as returned from search/list endpoints
 */
export interface MentionableDocument {
  id: string;
  path: string;        // Full path: "@my/name" or "@team/eng/name"
  name: string;
  mimeType: string;
  charCount: number;
  scope: DocumentScope;
  scopeName?: string;  // "Engineering" team or "Acme" project name
  scopeId?: string;    // Team or project ID
  createdAt: string;
  updatedAt: string;
}

/**
 * Parsed mention from message content
 */
export interface ParsedMention {
  path: string;         // e.g., "@my/doc-name"
  raw: string;          // Original text including @
  startIndex: number;
  endIndex: number;
}

/**
 * Document with content resolved (for context injection)
 */
export interface ResolvedDocument {
  id: string;
  path: string;
  name: string;
  content: string;
  truncated: boolean;
  charCount: number;
}

/**
 * Input for creating a document
 */
export interface CreateDocumentInput {
  name: string;
  content?: string;
  mimeType?: string;
  teamId?: string;
  projectId?: string;
}

/**
 * Input for updating a document
 */
export interface UpdateDocumentInput {
  name?: string;
  content?: string;
}

/**
 * Full document model (as stored in DB)
 */
export interface Document {
  id: string;
  name: string;
  content: string | null;
  storageKey: string | null;
  mimeType: string;
  fileSize: number;
  charCount: number;
  userId: string;
  teamId: string | null;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
