# Mentionable Resources - Revised Implementation Plan

## Overview

Add @-mentionable documents to chat with filesystem-like paths. Documents are accessed via hybrid approach: small docs injected into context, large docs via AI tools.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Access method | **Hybrid** - docs <1k chars injected, larger via tools |
| Scopes | **User + Team + Project** |
| File types | **Phase 1: Plain text + CSV** → Phase 2: PDF, DOCX, XLSX |
| Storage | **Configurable provider** (database, filesystem, S3) |
| Path format | **Scoped paths** - `@my/name`, `@team/slug/name`, `@project/slug/name` |

## Mention Syntax

```
@my/api-guidelines           # Personal document
@team/engineering/style      # Team document
@project/acme/requirements   # Project document
```

Documents have a unique `name` within their scope. The full path is constructed from scope + slug + name.

---

## Phase 1: Database Schema

**File:** `packages/db/prisma/schema/base.prisma`

```prisma
model Document {
  id          String    @id @default(cuid())
  name        String                          // Unique within scope
  content     String?   @db.Text              // For small text docs
  storageKey  String?                         // For file storage provider
  mimeType    String    @default("text/plain")
  fileSize    Int       @default(0)
  charCount   Int       @default(0)           // For hybrid threshold

  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamId      String?
  team        Team?     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  projectId   String?
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  archivedAt  DateTime?

  @@unique([userId, name, teamId, projectId])  // Unique name per scope
  @@index([userId])
  @@index([teamId])
  @@index([projectId])
}
```

Add relations to User, Team, Project models.

---

## Phase 2: Storage Provider System

**File:** `packages/server/src/storage/types.ts`

```typescript
export interface StorageProvider {
  name: string;
  upload(key: string, content: Buffer, mimeType: string): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl?(key: string): Promise<string>;  // For S3 presigned URLs
}
```

**File:** `packages/server/src/storage/providers/`
- `database.ts` - Store in Document.content field
- `filesystem.ts` - Store in configurable directory
- `s3.ts` - Store in S3-compatible bucket

**File:** `packages/server/src/storage/index.ts`
- Factory function based on config
- Default: database for small files, filesystem for large

---

## Phase 3: Text Extraction

**File:** `packages/server/src/documents/extractors.ts`

```typescript
export interface TextExtractor {
  mimeTypes: string[];
  extract(buffer: Buffer): Promise<string>;
}

// Registry pattern for extensibility
const extractors = new Map<string, TextExtractor>();

export function registerExtractor(extractor: TextExtractor): void {
  for (const mimeType of extractor.mimeTypes) {
    extractors.set(mimeType, extractor);
  }
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  const extractor = extractors.get(mimeType);
  if (!extractor) {
    throw new Error(`No extractor registered for ${mimeType}`);
  }
  return extractor.extract(buffer);
}
```

### Initial Extractors (Phase 1)
- **Plain text** - passthrough (txt, md, json, code files)
- **CSV** - parse to readable table format (csv-parse)

**Dependencies (Phase 1):** `csv-parse`

### Future Extractors (Phase 2+)
- **PDF** - `pdf-parse` library
- **DOCX** - `mammoth` library
- **XLSX** - `xlsx` library

The registry pattern allows adding new extractors without modifying existing code.

---

## Phase 4: Shared Types

**File:** `packages/shared/src/types/documents.ts`

```typescript
export type DocumentScope = 'my' | 'team' | 'project';

export interface DocumentPath {
  scope: DocumentScope;
  scopeSlug?: string;  // team or project slug
  name: string;
}

export interface MentionableDocument {
  id: string;
  path: string;        // Full path: "@my/name" or "@team/eng/name"
  name: string;
  mimeType: string;
  charCount: number;
  scope: DocumentScope;
  scopeName?: string;  // "Engineering" team or "Acme" project
}

export interface ParsedMention {
  path: string;
  raw: string;         // Original "@my/doc-name" text
  startIndex: number;
  endIndex: number;
}

export interface ResolvedDocument {
  id: string;
  path: string;
  name: string;
  content: string;
  truncated: boolean;
  charCount: number;
}
```

**File:** `packages/shared/src/types/config.ts` - Add DocumentsConfig:

```typescript
export interface DocumentsConfig {
  enabled: boolean;
  storage: {
    provider: 'database' | 'filesystem' | 's3';
    // Provider-specific options
    filesystem?: { basePath: string };
    s3?: { bucket: string; region: string };
  };
  maxFileSizeMB: number;
  hybridThreshold: number;  // chars, default 1000
  acceptedTypes: string[];  // MIME types
}

// Default acceptedTypes for Phase 1:
// ['text/plain', 'text/markdown', 'text/csv', 'application/json']
```

---

## Phase 5: Document Service

**File:** `packages/server/src/services/documents.ts`

```typescript
export class DocumentService {
  // CRUD
  create(data: CreateDocumentInput, userId: string): Promise<Document>;
  update(id: string, data: UpdateDocumentInput, userId: string): Promise<Document>;
  archive(id: string, userId: string): Promise<void>;
  get(id: string, userId: string): Promise<Document | null>;

  // Access
  getContent(id: string, userId: string, options?: { offset?: number; limit?: number }): Promise<string>;
  search(userId: string, query?: string, scopes?: DocumentScope[]): Promise<MentionableDocument[]>;

  // Path resolution
  resolvePath(path: string, userId: string): Promise<Document | null>;
  buildPath(doc: Document): string;

  // Permissions
  canAccess(doc: Document, userId: string): Promise<boolean>;
}
```

---

## Phase 6: Document Tools (Native Tools)

**File:** `packages/server/src/tools/documents.ts`

### Tool 1: `list_documents`
```typescript
{
  name: 'list_documents',
  description: 'List documents available in this conversation',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Filter by name' },
      scope: { enum: ['all', 'mentioned'], description: 'All accessible or only mentioned' }
    }
  },
  execute: async (input, context) => {
    // Returns list of document paths and metadata
  }
}
```

### Tool 2: `read_document`
```typescript
{
  name: 'read_document',
  description: 'Read content from a document',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Document path like @my/doc-name' },
      offset: { type: 'number', description: 'Start line (default: 0)' },
      limit: { type: 'number', description: 'Max lines to return (default: 100)' }
    },
    required: ['path']
  },
  execute: async (input, context) => {
    // Returns document content with line numbers
  }
}
```

### Tool 3: `search_in_document`
```typescript
{
  name: 'search_in_document',
  description: 'Search for text within a document',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      query: { type: 'string' },
      context_lines: { type: 'number', default: 3 }
    },
    required: ['path', 'query']
  },
  execute: async (input, context) => {
    // Returns matching lines with context
  }
}
```

### Tool 4: `save_document`
```typescript
{
  name: 'save_document',
  description: 'Save content as a new document. Use when user asks to save generated content.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Document name (e.g., "meeting-notes")' },
      content: { type: 'string', description: 'Content to save' },
      scope: {
        enum: ['my', 'team', 'project'],
        description: 'Where to save: personal, team, or project',
        default: 'my'
      },
      scopeId: { type: 'string', description: 'Team or project ID (required if scope is team/project)' }
    },
    required: ['name', 'content']
  },
  execute: async (input, context) => {
    // Creates document and returns the path
    // Returns: { success: true, path: '@my/meeting-notes' }
  }
}
```

**Tool Registration:**
- `list_documents`, `read_document`, `search_in_document` - registered when documents are mentioned
- `save_document` - always available (allows AI to save generated content on request)

---

## Phase 7: Backend API Routes

**File:** `packages/server/src/api/documents.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List user's accessible documents |
| `/api/documents` | POST | Create/upload document |
| `/api/documents/:id` | GET | Get document metadata |
| `/api/documents/:id` | PATCH | Update document |
| `/api/documents/:id` | DELETE | Archive document |
| `/api/documents/:id/content` | GET | Get document content (with offset/limit) |

**File:** `packages/server/src/api/mentions.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mentions/search` | GET | Search mentionable documents |
| `/api/mentions/resolve` | POST | Resolve paths to documents |

---

## Phase 8: Chat Integration

**File:** `packages/server/src/api/chat.ts`

After parsing user message, before calling agent:

```typescript
// 1. Parse mentions from message
const mentions = parseMentions(content);  // Find @my/doc patterns

// 2. Resolve to documents
const docs = await documentService.resolveMany(mentions, userId);

// 3. Hybrid logic
const smallDocs = docs.filter(d => d.charCount <= config.documents.hybridThreshold);
const largeDocs = docs.filter(d => d.charCount > config.documents.hybridThreshold);

// 4. Inject small docs into context
let mentionContext = '';
if (smallDocs.length > 0) {
  mentionContext = '\n\nReferenced documents:\n' +
    smallDocs.map(d => `--- ${d.path} ---\n${d.content}\n--- End ---`).join('\n\n');
}

// 5. Register document tools for large docs
const documentTools = largeDocs.length > 0
  ? getDocumentTools(largeDocs.map(d => d.id))
  : [];

// 6. Add hint about large docs
if (largeDocs.length > 0) {
  mentionContext += `\n\nLarge documents referenced (use tools to read):\n` +
    largeDocs.map(d => `- ${d.path} (${d.charCount} chars)`).join('\n');
}
```

**File:** `packages/server/src/services/agent.ts`

Add `mentionContext` to `ChatOptions` and inject after projectContext.

---

## Phase 9: Frontend - Mention Input

**File:** `packages/client/src/components/MentionInput.tsx`

- Wrap textarea, detect `@` trigger
- Debounced search API call
- Floating dropdown with results grouped by scope
- Keyboard navigation (arrows, Enter, Escape)
- Insert full path on selection: `@team/engineering/style-guide`

**File:** `packages/client/src/components/MentionDropdown.tsx`

- Floating portal positioned at cursor
- Groups: "My Documents", "Team: Engineering", "Project: Acme"
- Shows document name, type icon, char count

**File:** `packages/client/src/hooks/useMentionSearch.ts`

- Debounced API calls to `/api/mentions/search`
- Caches recent results

---

## Phase 10: Frontend - Document Management

**File:** `packages/client/src/pages/DocumentsPage.tsx`

- Tabbed view: My Documents | Team | Project
- List with search filter
- Upload button (drag & drop)
- Create text document inline
- Edit document content
- Delete (archive)

**File:** `packages/client/src/components/DocumentUpload.tsx`

- Drag & drop zone
- File type validation
- Progress indicator
- Text extraction preview

---

## Phase 11: Mention Display

**File:** `packages/client/src/components/MentionChip.tsx`

Renders `@team/engineering/style-guide` as styled chip:
- Scope icon (user/team/project)
- Clickable to view document
- Tooltip with full path

**File:** `packages/client/src/components/MessageContent.tsx`

Update to parse `@scope/path` patterns and render as MentionChip.

---

## File Summary

### New Files
- `packages/shared/src/types/documents.ts`
- `packages/server/src/storage/` (types, providers, index)
- `packages/server/src/documents/extractors.ts`
- `packages/server/src/services/documents.ts`
- `packages/server/src/tools/documents.ts`
- `packages/server/src/api/documents.ts`
- `packages/server/src/api/mentions.ts`
- `packages/client/src/components/MentionInput.tsx`
- `packages/client/src/components/MentionDropdown.tsx`
- `packages/client/src/components/MentionChip.tsx`
- `packages/client/src/components/DocumentUpload.tsx`
- `packages/client/src/hooks/useMentionSearch.ts`
- `packages/client/src/pages/DocumentsPage.tsx`

### Modified Files
- `packages/db/prisma/schema/base.prisma` - Add Document model + relations
- `packages/shared/src/types/config.ts` - Add DocumentsConfig
- `packages/server/src/app.ts` - Register routes
- `packages/server/src/api/chat.ts` - Mention parsing + hybrid logic
- `packages/server/src/services/agent.ts` - Add mentionContext
- `packages/client/src/pages/ChatPage.tsx` - Use MentionInput
- `packages/client/src/components/MessageContent.tsx` - Render mentions
- `packages/client/src/App.tsx` - Add documents route
- `packages/client/src/components/Sidebar.tsx` - Add documents link

### Dependencies to Add

**Phase 1 (Initial):**
- `csv-parse` - CSV parsing

**Phase 2+ (Future):**
- `pdf-parse` - PDF text extraction
- `mammoth` - DOCX text extraction
- `xlsx` - XLSX parsing

---

## Verification Plan

### Phase 1-4: Schema & Storage
1. Run `pnpm db:push` to create Document table
2. Test storage providers via unit tests
3. Test text extraction for plain text and CSV

### Phase 5-8: Backend
1. Create document via API
2. Verify mention search returns it
3. Send chat message with `@my/test-doc`
4. Check logs: small doc injected, large doc tools registered
5. Verify AI can use `read_document` tool
6. Test `save_document` tool - ask AI to generate and save content

### Phase 9-11: Frontend
1. Type `@` in chat, verify dropdown appears
2. Search and select document
3. Verify path inserted into input
4. Send message, verify mention renders as chip
5. Test Documents page CRUD

### Full Integration
1. Upload a text or CSV document to Documents page
2. Start new chat, mention the document
3. Ask "Summarize the key points from @my/uploaded-doc"
4. Verify AI reads via tool (if large) or uses injected context (if small)
5. Ask AI to "write a summary and save it as @my/summary" - verify document created
