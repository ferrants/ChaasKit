# Mentionable Resources Implementation Plan

## Overview

Add @-mentionable resources to chat, starting with a built-in Document type. Users can upload documents and reference them in messages with `@`. Extensions can register additional resource types.

**Key Decisions:**
- Single `@` trigger (like Slack/Discord)
- Use cmdk library for autocomplete
- Mention token format: `[@type:id:title]`
- Documents can be user-scoped (personal) or team-scoped (shared)
- Large documents truncated at 10,000 chars

---

## Phase 1: Database Schema

**File:** `packages/db/prisma/schema/base.prisma`

```prisma
model Document {
  id          String    @id @default(cuid())
  title       String
  content     String?   @db.Text
  mimeType    String    @default("text/plain")
  fileSize    Int?

  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamId      String?
  team        Team?     @relation(fields: [teamId], references: [id], onDelete: Cascade)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  archivedAt  DateTime?

  @@index([userId])
  @@index([teamId])
}
```

Add relations to User and Team models.

---

## Phase 2: Shared Types

**File:** `packages/shared/src/types/mentions.ts`

```typescript
export interface MentionableResource {
  id: string;
  type: string;           // 'document' | custom types
  title: string;
  subtitle?: string;      // "Personal" or "Team: Engineering"
  icon?: string;          // lucide icon name
}

export interface MentionSearchResult {
  resources: MentionableResource[];
  hasMore: boolean;
}

export interface ParsedMention {
  type: string;
  id: string;
  title: string;
  raw: string;            // Full [@type:id:title] string
}

export interface ResolvedMention {
  type: string;
  id: string;
  title: string;
  content: string;
  truncated?: boolean;
}
```

**File:** `packages/shared/src/types/config.ts` - Add MentionsConfig:

```typescript
export interface MentionsConfig {
  enabled: boolean;
  documents: {
    enabled: boolean;
    maxSizeMB: number;
    acceptedTypes: string[];
  };
  maxContextLength?: number; // Default: 10000
}
```

---

## Phase 3: Backend - Registry & Providers

### 3.1 Add Mention Provider to Registry

**File:** `packages/server/src/registry/index.ts`

Add `'mention-provider'` category and base class:

```typescript
export abstract class BaseMentionProvider {
  abstract type: string;
  abstract name: string;
  abstract icon: string;

  abstract search(
    query: string,
    context: { userId?: string; teamId?: string; limit?: number }
  ): Promise<MentionSearchResult>;

  abstract resolve(
    id: string,
    context: { userId?: string; teamId?: string }
  ): Promise<ResolvedMention | null>;
}
```

### 3.2 Built-in Document Provider

**New file:** `packages/server/src/mentions/DocumentMentionProvider.ts`

- Searches user's documents and team documents
- Resolves document content with truncation at maxContextLength
- Registers with: `registry.register('mention-provider', 'document', ...)`

### 3.3 Mention Manager Service

**New file:** `packages/server/src/services/mentions.ts`

- `search(query, context)` - Search all providers
- `parseMentions(content)` - Extract `[@type:id:title]` tokens
- `resolveMentions(content, context)` - Resolve all mentions to content
- `getAvailableTypes()` - List registered providers

---

## Phase 4: Backend - API Routes

### 4.1 Documents API

**New file:** `packages/server/src/api/documents.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List user's documents |
| `/api/documents` | POST | Create document |
| `/api/documents/:id` | GET | Get document |
| `/api/documents/:id` | PATCH | Update document |
| `/api/documents/:id` | DELETE | Archive document |

### 4.2 Mentions API

**New file:** `packages/server/src/api/mentions.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mentions/search` | GET | Search mentionable resources |
| `/api/mentions/types` | GET | List available types |

**Register routes in:** `packages/server/src/app.ts`

---

## Phase 5: Context Injection

**Modify:** `packages/server/src/api/chat.ts`

After building conversation history, before calling agent:

```typescript
// Resolve mentions in user's message
const resolvedMentions = await mentionManager.resolveMentions(content, {
  userId: req.user?.id,
  teamId: thread.teamId,
});

// Build mention context
let mentionContext = '';
if (resolvedMentions.length > 0) {
  mentionContext = '\n\nReferenced documents:\n' +
    resolvedMentions.map(m =>
      `--- ${m.title} ---\n${m.content}\n--- End ${m.title} ---`
    ).join('\n\n');
}
```

**Modify:** `packages/server/src/services/agent.ts`

Add `mentionContext` to `ChatOptions` and inject into system prompt after projectContext.

---

## Phase 6: Frontend - MentionInput Component

### 6.1 Install cmdk

```bash
cd packages/client && pnpm add cmdk
```

### 6.2 MentionInput Component

**New file:** `packages/client/src/components/MentionInput.tsx`

- Wraps textarea, detects `@` trigger
- Shows cmdk popup with search results
- Keyboard navigation (arrows, Enter, Escape)
- Inserts mention token: `[@document:abc123:My Doc]`

### 6.3 MentionToken Component

**New file:** `packages/client/src/components/MentionToken.tsx`

Renders mention as styled chip with icon.

### 6.4 Update ChatPage

**Modify:** `packages/client/src/pages/ChatPage.tsx`

Replace textarea with MentionInput component.

### 6.5 Render Mentions in Messages

**Modify:** `packages/client/src/components/MessageContent.tsx`

Parse `[@type:id:title]` tokens and render as MentionToken components.

---

## Phase 7: Document Management UI

### 7.1 Documents Page

**New file:** `packages/client/src/pages/DocumentsPage.tsx`

- List documents with search
- Create/upload documents
- Edit document content
- Delete (archive) documents

### 7.2 Route & Navigation

**Modify:** `packages/client/src/App.tsx` - Add route
**Modify:** `packages/client/src/components/Sidebar.tsx` - Add link

---

## Phase 8: Extension System

**Modify:** `packages/server/src/extensions/loader.ts`

Add `'extensions/mention-providers'` to auto-discovery paths.

**Create:** `docs/extensions.md` section for mention providers with example.

---

## File Summary

### New Files
- `packages/shared/src/types/mentions.ts`
- `packages/server/src/mentions/DocumentMentionProvider.ts`
- `packages/server/src/services/mentions.ts`
- `packages/server/src/api/documents.ts`
- `packages/server/src/api/mentions.ts`
- `packages/client/src/components/MentionInput.tsx`
- `packages/client/src/components/MentionToken.tsx`
- `packages/client/src/pages/DocumentsPage.tsx`

### Modified Files
- `packages/db/prisma/schema/base.prisma` - Add Document model
- `packages/shared/src/types/config.ts` - Add MentionsConfig
- `packages/server/src/registry/index.ts` - Add BaseMentionProvider
- `packages/server/src/extensions/loader.ts` - Add mention-providers path
- `packages/server/src/app.ts` - Register routes
- `packages/server/src/api/chat.ts` - Add mention resolution
- `packages/server/src/services/agent.ts` - Add mentionContext
- `packages/client/src/pages/ChatPage.tsx` - Use MentionInput
- `packages/client/src/components/MessageContent.tsx` - Render mentions
- `packages/client/src/App.tsx` - Add documents route
- `packages/client/src/components/Sidebar.tsx` - Add documents link

---

## Verification

### Phase 1-2 Testing
1. Run `pnpm db:push` to create Document table
2. Create a document via Prisma Studio

### Phase 3-5 Testing
1. Create test document in database
2. Send message with `[@document:id:title]`
3. Verify document content appears in agent's context (check logs)

### Phase 6-7 Testing
1. Type `@` in chat input, verify popup appears
2. Search for document, select it
3. Verify mention token inserted
4. Send message, verify mention renders in message
5. Test Documents page CRUD operations

### Full Flow
1. Go to Documents page, create "API Guidelines" document
2. Start new chat, type `@` and select the document
3. Ask "What are the key points from the guidelines?"
4. Verify agent responds using document content
