# Authentication

The ChaasKit Template supports multiple authentication methods including email/password, OAuth providers, and magic links.

## Configuration

Configure authentication in `config/app.config.ts`:

```typescript
auth: {
  methods: ['email-password', 'google', 'github', 'magic-link'],
  allowUnauthenticated: false,
  magicLink: {
    enabled: true,
    expiresInMinutes: 15,
  },
  gating: {
    mode: 'open',
    inviteExpiryDays: 7,
    waitlistEnabled: true,
  },
}
```

## Available Methods

### Email/Password

Built-in email and password authentication with bcrypt hashing.

**Configuration:**
```typescript
auth: {
  methods: ['email-password'],
}
```

**Endpoints:**
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Log in
- `POST /api/auth/logout` - Log out

### Google OAuth

**Setup:**

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the Google+ API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `{API_URL}/api/auth/google/callback`

**Environment:**
```bash
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

**Configuration:**
```typescript
auth: {
  methods: ['google'],
}
```

### GitHub OAuth

**Setup:**

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL: `{API_URL}/api/auth/github/callback`

**Environment:**
```bash
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
```

**Configuration:**
```typescript
auth: {
  methods: ['github'],
}
```

### Magic Links

Passwordless authentication via email links.

**Configuration:**
```typescript
auth: {
  methods: ['magic-link'],
  magicLink: {
    enabled: true,
    expiresInMinutes: 15,
  },
}
```

**Note:** Requires email service configuration (not included by default). Magic link emails use the `email` configuration in `config/app.config.ts` (see Configuration docs).

## Signup Gating and Waitlist

Signups can be restricted by mode and optionally backed by a waitlist. Invite tokens bypass gating.

**Modes:**
- `open`
- `invite_only`
- `closed`
- `timed_window`
- `capacity_limit`

**Behavior:**
- `POST /api/auth/register` and `POST /api/auth/magic-link` accept `inviteToken` to bypass gating.
- When gating blocks signup, the API responds with `403` and includes `waitlistEnabled` so the client can offer a waitlist form.
- Waitlist signup is via `POST /api/auth/waitlist`.

See `docs/configuration.md` for gating config options and `docs/admin.md` for the admin waitlist UI.

## Anonymous Users

Allow users to chat without authentication:

```typescript
auth: {
  allowUnauthenticated: true,
}
```

Anonymous users:
- Can create threads and send messages
- Cannot access saved threads after session ends
- No access to premium features

## JWT Tokens

Authentication uses JWT tokens stored in HTTP-only cookies.

**Token Structure:**
```typescript
{
  sub: userId,
  email: userEmail,
  iat: issuedAt,
  exp: expiresAt,
}
```

**Cookie Settings:**
- `httpOnly: true` - Not accessible via JavaScript
- `secure: true` - HTTPS only in production
- `sameSite: 'lax'` - CSRF protection

## Protected Routes

### Backend

Use middleware to protect routes:

```typescript
import { requireAuth, optionalAuth } from '../middleware/auth.js';

// Requires authentication
router.get('/private', requireAuth, async (req, res) => {
  // req.user is guaranteed to exist
  res.json({ userId: req.user.id });
});

// Optional authentication
router.get('/public', optionalAuth, async (req, res) => {
  // req.user may or may not exist
  if (req.user) {
    res.json({ message: 'Hello, ' + req.user.email });
  } else {
    res.json({ message: 'Hello, anonymous' });
  }
});
```

### Frontend

Use the AuthContext:

```tsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <div>Hello, {user.email}</div>;
}
```

## User Model

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  name          String?
  avatarUrl     String?

  // OAuth
  oauthProvider String?
  oauthId       String?

  // Subscription
  plan          String    @default("free")

  // Settings
  settings      Json      @default("{}")

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

## Security Considerations

1. **Password Hashing**: bcrypt with automatic salt
2. **JWT Secrets**: Use 32+ character random strings
3. **HTTPS**: Required in production
4. **CSRF Protection**: SameSite cookies
5. **Rate Limiting**: Built-in via express-rate-limit

## Customization

### Add a New OAuth Provider

1. Install Passport strategy:
   ```bash
   pnpm add passport-twitter -F @chaaskit/server
   ```

2. Add route in `packages/server/src/api/auth.ts`

3. Configure strategy in passport setup

4. Add to config:
   ```typescript
   auth: {
     methods: ['twitter'],
   }
   ```

### Custom Auth Provider

Implement using the registry pattern:

```typescript
// extensions/auth-providers/my-provider.ts
import { BaseAuthProvider } from '@chaaskit/server';

export class MyAuthProvider extends BaseAuthProvider {
  async authenticate(credentials) {
    // Custom auth logic
  }
}
```

Register:
```typescript
registry.register('auth-provider', 'my-provider', MyAuthProvider);
```
