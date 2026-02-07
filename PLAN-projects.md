# Projects Feature Implementation Plan

## Overview

Add a "Projects" feature that provides another level of context organization. Projects act as folders containing threads, with their own AI context that gets passed to the agent.

## Data Model

### New Project Model

```prisma
model Project {
  id        String    @id @default(cuid())
  name      String
  context   String?   // AI context for project threads
  color     String    // hex color from preset list
  sharing   String    @default("private") // 'private' | 'team'
  userId    String    // creator
  teamId    String?   // optional team association
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  team      Team?     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  threads   Thread[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([userId])
  @@index([teamId])
}
```

### Thread Model Update

```prisma
model Thread {
  // ... existing fields
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([projectId])
}
```

## Configuration

### Type Definition

```typescript
// packages/shared/src/types/config.ts
export interface ProjectsConfig {
  enabled: boolean;
  colors: string[]; // hex colors for project color picker
}
```

### Default Config

```typescript
// config/app.config.ts
projects: {
  enabled: true,
  colors: [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
  ],
}
```

## Hierarchy & Ownership

| Project Type | Owner | teamId | Visibility |
|--------------|-------|--------|------------|
| Personal | User | null | Private (creator only) |
| Team (private) | User | Team ID | Private (creator only) |
| Team (shared) | User | Team ID | All team members |

## Context Stacking

When a thread is within a project (and optionally a team), context is stacked:

```
Team context:
<team context if thread.teamId exists>

Project context:
<project context if thread.projectId exists>

User context:
<user settings context>
```

## Permissions

### Personal Projects
- Create: Any authenticated user
- View: Creator only
- Edit: Creator only
- Delete: Creator only

### Team Projects
- Create: Team members (not viewers)
- View (private): Creator only
- View (team): All team members
- Edit: Creator OR team owner/admin
- Delete: Creator OR team owner/admin

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/projects` | List user's projects | Required |
| POST | `/api/projects` | Create project | Required |
| GET | `/api/projects/:id` | Get project details | Required |
| PATCH | `/api/projects/:id` | Update project | Required |
| DELETE | `/api/projects/:id` | Delete project | Required |

### Query Parameters for GET /api/projects
- `teamId` (optional): Filter by team

### Request/Response Types

```typescript
interface CreateProjectRequest {
  name: string;
  color: string;
  context?: string;
  teamId?: string;      // If provided, creates team project
  sharing?: 'private' | 'team'; // Default: 'private'
}

interface UpdateProjectRequest {
  name?: string;
  color?: string;
  context?: string;
  sharing?: 'private' | 'team';
}

interface Project {
  id: string;
  name: string;
  context: string | null;
  color: string;
  sharing: 'private' | 'team';
  userId: string;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

## Files to Modify/Create

### Backend

| File | Change |
|------|--------|
| `packages/db/prisma/schema.prisma` | Add Project model, update Thread model |
| `packages/shared/src/types/config.ts` | Add ProjectsConfig interface |
| `packages/shared/src/types/project.ts` | New file - Project types |
| `packages/shared/src/validation/project.ts` | New file - Zod schemas |
| `packages/shared/src/index.ts` | Export new types |
| `config/app.config.ts` | Add projects config |
| `packages/server/src/api/projects.ts` | New file - Projects API |
| `packages/server/src/api/index.ts` | Register projects router |
| `packages/server/src/api/chat.ts` | Add project context lookup |
| `packages/server/src/api/threads.ts` | Include projectId in responses |
| `packages/server/src/api/config.ts` | Expose projects config to frontend |

### Frontend

| File | Change |
|------|--------|
| `packages/client/src/contexts/ConfigContext.tsx` | Add projects default config |
| `packages/client/src/contexts/ProjectContext.tsx` | New file - Project state management |
| `packages/client/src/components/Sidebar.tsx` | Add project folders, new project dropdown |
| `packages/client/src/components/ProjectModal.tsx` | New file - Create/edit project modal |
| `packages/client/src/components/ProjectFolder.tsx` | New file - Project folder component |
| `packages/client/src/stores/chatStore.ts` | Add projectId to thread creation |
| `packages/client/src/App.tsx` | Wrap with ProjectProvider |

## UI Design

### Sidebar Thread List Structure

```
[+ New Chat button]
[▼ dropdown] New Project...

📁 Project A (🔴 red dot)
   └── Thread 1
   └── Thread 2
📁 Project B (🔵 blue dot)
   └── Thread 3
── Thread 4 (no project)
── Thread 5 (no project)
```

### Project Folder Behavior
- Click folder name to expand/collapse
- Click colored dot or settings icon to open project settings modal
- "New thread in project" button appears when folder is expanded

### Project Modal
- Name input
- Color picker (8 preset colors as clickable circles)
- Context textarea (optional)
- Sharing dropdown (private/team) - only shown for team projects
- Save/Cancel buttons
- Delete button (in edit mode)

## Implementation Order

1. **Database & Types**
   - Add Project model to schema
   - Add projectId to Thread
   - Create shared types and validation
   - Run db:push and db:generate

2. **Backend API**
   - Create projects router with CRUD endpoints
   - Add projects enabled middleware
   - Update chat.ts for project context
   - Update threads API to include projectId
   - Expose projects config

3. **Frontend State**
   - Create ProjectContext
   - Update ConfigContext defaults

4. **Frontend UI**
   - Create ProjectModal component
   - Create ProjectFolder component
   - Update Sidebar with project folders
   - Update thread creation flow

5. **Documentation**
   - Add Projects section to configuration.md

## Edge Cases

1. **Deleting a project**: Threads remain but lose projectId (SetNull)
2. **Leaving a team**: User loses access to team projects (handled by team membership check)
3. **Projects disabled**: Hide UI, block API, skip project context lookup
4. **Invalid project color**: Validate against config.projects.colors
5. **Team project in personal workspace**: Not allowed (teamId required for team sharing)
