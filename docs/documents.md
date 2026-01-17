# Mentionable Documents

Mentionable documents allow users to reference stored content in chat using @-mention syntax. Documents are organized by scope (personal, team, or project) and can be automatically injected into the AI context or accessed via tools.

File attachments in chat also use this system - when you attach a file to a message, it's uploaded as a document and automatically @-mentioned.

## Quick Start

1. Enable documents in your config:

```typescript
// config/app.config.ts
documents: {
  enabled: true,
  storage: { provider: 'database' },
  maxFileSizeMB: 10,
  hybridThreshold: 1000,
  acceptedTypes: ['text/plain', 'text/markdown', 'text/x-markdown', 'text/csv', 'application/json'],
}
```

2. Create or upload documents via the Documents page (`/documents`)
3. Reference documents in chat using `@my/document-name` syntax

## Mention Syntax

Documents are referenced using scoped paths:

| Scope | Syntax | Example |
|-------|--------|---------|
| Personal | `@my/<name>` | `@my/api-guidelines` |
| Team | `@team/<slug>/<name>` | `@team/engineering/style-guide` |
| Project | `@project/<slug>/<name>` | `@project/acme/requirements` |

Document names should be lowercase with hyphens (e.g., `api-guidelines`, `meeting-notes`).

## How It Works

### Hybrid Access Model

Documents use a hybrid approach based on size:

- **Small documents** (under `hybridThreshold` chars): Content is automatically injected into the AI context when mentioned
- **Large documents** (over threshold): AI receives tools to read, search, and list document contents

This balances context efficiency with full access to large documents.

### Document Scopes

| Scope | Access | Use Case |
|-------|--------|----------|
| **Personal** (`my`) | Only the owner | Personal notes, private references |
| **Team** | All team members | Shared team knowledge, guidelines |
| **Project** | Project participants | Project-specific documentation |

## Configuration

```typescript
interface DocumentsConfig {
  enabled: boolean;
  storage: {
    provider: 'database' | 'filesystem' | 's3';
    filesystem?: { basePath: string };
    s3?: { bucket: string; region: string; endpoint?: string };
  };
  maxFileSizeMB: number;
  hybridThreshold: number;  // Character count threshold for context injection
  acceptedTypes: string[];  // MIME types
}
```

### Storage Providers

**Database (default)** - Content stored in the Document table. Best for small to medium documents.

```typescript
storage: { provider: 'database' }
```

**Filesystem** - Content stored on disk. Good for larger files or when you need direct file access.

```typescript
storage: {
  provider: 'filesystem',
  filesystem: { basePath: './uploads/documents' }
}
```

**S3** - Content stored in S3-compatible storage. Best for production deployments.

```typescript
storage: {
  provider: 's3',
  s3: {
    bucket: 'my-documents-bucket',
    region: 'us-east-1',
    endpoint: 'https://s3.amazonaws.com'  // Optional, for S3-compatible services
  }
}
```

### Accepted File Types

The `acceptedTypes` array specifies which MIME types can be uploaded. Default types:

```typescript
acceptedTypes: [
  'text/plain',       // .txt files
  'text/markdown',    // .md files
  'text/x-markdown',  // .md files (alternate MIME type)
  'text/csv',         // .csv files
  'application/json', // .json files
]
```

### Hybrid Threshold

The `hybridThreshold` controls when documents are injected vs accessed via tools:

```typescript
hybridThreshold: 1000  // Characters
```

- Documents with `charCount <= 1000`: Injected directly into AI context
- Documents with `charCount > 1000`: AI uses tools to read content

Adjust based on your typical document sizes and context budget.

## AI Tools

When large documents are mentioned, the AI receives these tools:

### `list_documents`
Lists available documents, optionally filtered by query or scope.

### `read_document`
Reads content from a document with pagination support.

```typescript
{
  path: '@my/api-guidelines',
  offset: 0,   // Start line
  limit: 100   // Max lines
}
```

### `search_in_document`
Searches for text within a document.

```typescript
{
  path: '@my/api-guidelines',
  query: 'authentication',
  context_lines: 3
}
```

### `save_document`
Saves AI-generated content as a new document.

```typescript
{
  name: 'meeting-summary',
  content: '...',
  scope: 'my'  // or 'team', 'project'
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List documents |
| `/api/documents` | POST | Create text document |
| `/api/documents/upload` | POST | Upload file |
| `/api/documents/:id` | GET | Get document metadata |
| `/api/documents/:id` | PATCH | Update document |
| `/api/documents/:id` | DELETE | Archive document |
| `/api/documents/:id/content` | GET | Get document content |
| `/api/mentions/search` | GET | Search mentionable documents |
| `/api/mentions/resolve` | POST | Resolve mention paths |

## File Attachments in Chat

The chat file attachment button (paperclip icon) uploads files as documents and automatically @-mentions them in your message. This provides a unified experience:

1. Click the attachment icon in the chat input
2. Select one or more files
3. Files are uploaded as documents to your personal scope (or team/project if selected)
4. @-mentions are automatically appended to your message

For example, attaching `report.csv` will:
- Create a document at `@my/report`
- Append `@my/report` to your message
- The AI can then access the document content via the hybrid system

**Note**: The attachment button only appears when documents are enabled in configuration.

## Frontend Components

### Documents Page

Access via `/documents` or the sidebar link. Features:

- Create text documents inline
- Upload files (drag & drop supported)
- View, edit, and delete documents
- Filter by scope and search by name

### Mention Input

When typing in chat:

1. Type `@` to trigger the mention dropdown
2. Continue typing to filter documents
3. Use arrow keys to navigate, Enter to select
4. Selected document path is inserted into the message

### Mention Chips

Document mentions in messages render as styled chips showing:

- Scope icon (user/team/project)
- Document name
- Full path on hover

## Database Schema

```prisma
model Document {
  id          String    @id @default(cuid())
  name        String
  content     String?   @db.Text
  storageKey  String?
  mimeType    String    @default("text/plain")
  fileSize    Int       @default(0)
  charCount   Int       @default(0)

  userId      String
  user        User      @relation(...)
  teamId      String?
  team        Team?     @relation(...)
  projectId   String?
  project     Project?  @relation(...)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  archivedAt  DateTime?

  @@unique([userId, name, teamId, projectId])
}
```

## Text Extraction

Documents are processed to extract plain text for AI consumption:

| File Type | Handling |
|-----------|----------|
| Plain text (.txt) | Passthrough |
| Markdown (.md) | Passthrough |
| CSV (.csv) | Converted to readable table format |
| JSON (.json) | Passthrough |

The extractor system is extensible. Future versions may support PDF, DOCX, and XLSX.

## Best Practices

1. **Use descriptive names**: `api-authentication-guide` is better than `doc1`
2. **Keep documents focused**: One topic per document improves mention relevance
3. **Set appropriate scope**: Use team/project scope for shared knowledge
4. **Consider document size**: Very large documents may be slow to search
5. **Update regularly**: Keep referenced documents current

## Troubleshooting

### Documents not appearing in mentions

- Verify documents feature is enabled in config
- Check that the document isn't archived
- Ensure you have access to the document's scope

### Upload fails

- Check file size against `maxFileSizeMB`
- Verify MIME type is in `acceptedTypes`
- Check server logs for detailed errors

### AI not reading document content

- For large documents, ensure the AI is using the `read_document` tool
- Check that document tools are registered (visible in tool calls)
- Verify the document path is correct in the mention
