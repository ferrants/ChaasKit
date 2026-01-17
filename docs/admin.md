# Admin Dashboard

The Admin Dashboard provides site-wide administration capabilities for managing users, teams, and viewing usage analytics.

## Configuration

Site administrators are configured via the `admin` section in `config/app.config.ts`:

```typescript
admin: {
  emails: [
    'admin@example.com',
    'another-admin@example.com',
  ],
}
```

Users whose email addresses are in this list will see the "Admin" link in the sidebar and have access to all admin features.

### Admin Access

Admin access is granted if the user meets either condition:
- Their email is listed in `config.admin.emails` (case-insensitive)
- They have `isAdmin: true` in the database (legacy support)

## Admin Pages

### Dashboard (`/admin`)

The main admin dashboard displays:

- **Stats Cards**: Total users, teams, threads, messages, and recent activity
- **Usage Chart**: Visual chart showing messages and token usage over time
  - Period selector: 7, 30, or 90 days
  - Metric selector: Messages, Input Tokens, Output Tokens, Total Tokens
  - Summary row with total, daily average, and peak day
- **Plan Distribution**: Breakdown of users by subscription plan
- **Recent Feedback**: Latest user feedback on AI responses

Navigation links to Manage Users and Manage Teams (if teams enabled).

### User Management (`/admin/users`)

Lists all users in the system with:

| Column | Description |
|--------|-------------|
| User | Name, email, avatar, OAuth provider |
| Plan | Dropdown to change user's subscription plan |
| Messages | Message count this month |
| Teams | Clickable pills showing team memberships with roles |
| Admin | Toggle button to grant/revoke database admin flag |
| Joined | Account creation date |

Features:
- **Search**: Filter users by email or name
- **Pagination**: Navigate through large user lists
- **Team Links**: Click a team pill to view that team's details

### Team Management (`/admin/teams`)

Lists all teams in the system (only visible if teams are enabled):

| Column | Description |
|--------|-------------|
| Team | Team name and avatar |
| Members | Number of team members |
| Threads | Number of team threads |
| Created | Team creation date |

Features:
- **Search**: Filter teams by name
- **Pagination**: Navigate through large team lists
- **Click to View**: Click any team row to see team details

### Team Details (`/admin/teams/:teamId`)

Displays detailed information about a specific team:

- **Stats**: Member count, thread count, creation date
- **Team Context**: The AI context configured for team conversations
- **Members List**: All team members with:
  - Name and email (clickable to search in user management)
  - Role badge (owner, admin, member, viewer)
  - Join date

## API Endpoints

All admin endpoints require authentication and admin access.

### Stats & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/stats` | Dashboard statistics |
| `GET` | `/api/admin/usage` | Usage data over time |
| `GET` | `/api/admin/feedback` | Feedback statistics and recent items |

**Usage Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | 30 | Number of days of data (1-365) |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users` | Paginated user list |
| `PATCH` | `/api/admin/users/:userId` | Update user (plan, isAdmin) |

**User List Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Users per page (max 100) |
| `search` | string | - | Filter by email or name |

**User Update Body:**

```typescript
{
  isAdmin?: boolean;  // Grant or revoke admin status
  plan?: string;      // Change subscription plan
}
```

### Team Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/teams` | Paginated team list |
| `GET` | `/api/admin/teams/:teamId` | Team details with members |

**Team List Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Teams per page (max 100) |
| `search` | string | - | Filter by team name |
| `includeArchived` | boolean | false | Include archived teams |

## Response Types

### AdminStats

```typescript
interface AdminStats {
  totalUsers: number;
  totalTeams: number;
  totalThreads: number;
  totalMessages: number;
  planDistribution: Record<string, number>;
  newUsersLast30Days: number;
  messagesLast30Days: number;
}
```

### UsageDataPoint

```typescript
interface UsageDataPoint {
  date: string;        // "2024-01-15"
  messages: number;    // Count of messages
  inputTokens: number; // Total input tokens
  outputTokens: number;// Total output tokens
}
```

### AdminUser

```typescript
interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  isAdmin: boolean;
  plan: string;
  messagesThisMonth: number;
  credits: number;
  emailVerified: boolean;
  oauthProvider?: string | null;
  createdAt: Date;
  threadCount: number;
  teamCount: number;
  teams: AdminUserTeam[];
}

interface AdminUserTeam {
  id: string;
  name: string;
  role: string;
}
```

### AdminTeam / AdminTeamDetails

```typescript
interface AdminTeam {
  id: string;
  name: string;
  memberCount: number;
  threadCount: number;
  createdAt: Date;
  archivedAt?: Date | null;
}

interface AdminTeamDetails extends AdminTeam {
  context?: string | null;
  members: AdminTeamMember[];
}

interface AdminTeamMember {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  role: string;
  joinedAt: Date;
}
```

## Security Considerations

1. **Config-based access**: Admin emails are defined in server configuration, not user-editable
2. **Case-insensitive matching**: Email comparison is case-insensitive
3. **Self-protection**: Users cannot remove their own admin status
4. **Audit trail**: All user changes are logged with timestamps
5. **No destructive actions**: Admin can modify users but cannot delete accounts (preserves data integrity)

## Extending Admin Features

To add custom admin functionality:

1. **Add API endpoints** in `packages/server/src/api/admin.ts`
2. **Add types** in `packages/shared/src/types/admin.ts`
3. **Create pages** in `packages/client/src/pages/Admin*.tsx`
4. **Add routes** in `packages/client/src/App.tsx` wrapped with `<AdminRoute>`

Example adding a new admin page:

```tsx
// App.tsx
<Route
  path="/admin/custom"
  element={
    <AdminRoute>
      <AdminCustomPage />
    </AdminRoute>
  }
/>
```

The `AdminRoute` component handles authentication and admin access verification.
