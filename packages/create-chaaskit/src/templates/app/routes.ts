import { type RouteConfig, route, index, layout } from '@react-router/dev/routes';
import { config } from '../config/app.config';

// Get basePath from config, default to '/chat'
const basePath = config.app.basePath || '/chat';
// Remove leading slash for route path matching
const base = basePath.startsWith('/') ? basePath.slice(1) : basePath;

export default [
  // ==========================================
  // Public routes (no basePath prefix)
  // ==========================================
  index('routes/_index.tsx'),
  route('login', 'routes/login.tsx'),
  route('register', 'routes/register.tsx'),
  route('shared/:shareId', 'routes/shared.$shareId.tsx'),
  route('terms', 'routes/terms.tsx'),
  route('privacy', 'routes/privacy.tsx'),
  route('verify-email', 'routes/verify-email.tsx'),
  route('invite/:token', 'routes/invite.$token.tsx'),
  route('pricing', 'routes/pricing.tsx'),
  route('oauth/consent', 'routes/oauth.consent.tsx'),

  // ==========================================
  // Authenticated app routes (under basePath)
  // Layout handles authentication check
  // ==========================================
  layout('routes/chat.tsx', [
    // Main chat interface
    route(base, 'routes/chat._index.tsx'),
    route(`${base}/thread/:threadId`, 'routes/chat.thread.$threadId.tsx'),

    // Settings pages
    route(`${base}/api-keys`, 'routes/chat.api-keys.tsx'),
    route(`${base}/documents`, 'routes/chat.documents.tsx'),
    route(`${base}/automations`, 'routes/chat.automations.tsx'),

    // Team settings
    route(`${base}/team/:teamId/settings`, 'routes/chat.team.$teamId.settings.tsx'),

    // Admin pages
    route(`${base}/admin`, 'routes/chat.admin._index.tsx'),
    route(`${base}/admin/users`, 'routes/chat.admin.users.tsx'),
    route(`${base}/admin/waitlist`, 'routes/chat.admin.waitlist.tsx'),
    route(`${base}/admin/promo-codes`, 'routes/chat.admin.promo-codes.tsx'),
    route(`${base}/admin/teams`, 'routes/chat.admin.teams._index.tsx'),
    route(`${base}/admin/teams/:teamId`, 'routes/chat.admin.teams.$teamId.tsx'),
  ]),
] satisfies RouteConfig;
