export interface ManagedRoute {
  /** File path relative to app/ dir, e.g. 'routes/chat.admin.waitlist.tsx' */
  file: string;
  /** Human-readable title for the route */
  title: string;
  /** Import path for the route component, e.g. '@chaaskit/client/routes/AdminWaitlistRoute' */
  importPath: string;
  /** Optional skeleton to show while loading */
  skeleton?: 'chat';
  /** Route configuration for routes.ts */
  route: {
    /** Route path without basePath prefix, e.g. 'admin/waitlist' */
    path: string;
    /** Whether this route is public or authenticated (under the layout) */
    section: 'public' | 'authenticated';
  };
}

export const managedRoutes: ManagedRoute[] = [
  // Authenticated routes (under basePath layout)
  {
    file: 'routes/chat._index.tsx',
    title: 'Chat',
    importPath: '@chaaskit/client/routes/ChatRoute',
    skeleton: 'chat',
    route: { path: '', section: 'authenticated' },
  },
  {
    file: 'routes/chat.thread.$threadId.tsx',
    title: 'Chat',
    importPath: '@chaaskit/client/routes/ChatRoute',
    skeleton: 'chat',
    route: { path: 'thread/:threadId', section: 'authenticated' },
  },
  {
    file: 'routes/chat.api-keys.tsx',
    title: 'API Keys',
    importPath: '@chaaskit/client/routes/ApiKeysRoute',
    route: { path: 'api-keys', section: 'authenticated' },
  },
  {
    file: 'routes/chat.documents.tsx',
    title: 'Documents',
    importPath: '@chaaskit/client/routes/DocumentsRoute',
    route: { path: 'documents', section: 'authenticated' },
  },
  {
    file: 'routes/chat.automations.tsx',
    title: 'Automations',
    importPath: '@chaaskit/client/routes/AutomationsRoute',
    route: { path: 'automations', section: 'authenticated' },
  },
  {
    file: 'routes/chat.team.$teamId.settings.tsx',
    title: 'Team Settings',
    importPath: '@chaaskit/client/routes/TeamSettingsRoute',
    route: { path: 'team/:teamId/settings', section: 'authenticated' },
  },
  {
    file: 'routes/chat.admin._index.tsx',
    title: 'Admin Dashboard',
    importPath: '@chaaskit/client/routes/AdminDashboardRoute',
    route: { path: 'admin', section: 'authenticated' },
  },
  {
    file: 'routes/chat.admin.users.tsx',
    title: 'Admin Users',
    importPath: '@chaaskit/client/routes/AdminUsersRoute',
    route: { path: 'admin/users', section: 'authenticated' },
  },
  {
    file: 'routes/chat.admin.waitlist.tsx',
    title: 'Admin Waitlist',
    importPath: '@chaaskit/client/routes/AdminWaitlistRoute',
    route: { path: 'admin/waitlist', section: 'authenticated' },
  },
  {
    file: 'routes/chat.admin.promo-codes.tsx',
    title: 'Admin Promo Codes',
    importPath: '@chaaskit/client/routes/AdminPromoCodesRoute',
    route: { path: 'admin/promo-codes', section: 'authenticated' },
  },
  {
    file: 'routes/chat.admin.teams._index.tsx',
    title: 'Admin Teams',
    importPath: '@chaaskit/client/routes/AdminTeamsRoute',
    route: { path: 'admin/teams', section: 'authenticated' },
  },
  {
    file: 'routes/chat.admin.teams.$teamId.tsx',
    title: 'Admin Team',
    importPath: '@chaaskit/client/routes/AdminTeamRoute',
    route: { path: 'admin/teams/:teamId', section: 'authenticated' },
  },
  // Public routes
  {
    file: 'routes/pricing.tsx',
    title: 'Pricing',
    importPath: '@chaaskit/client/routes/PricingRoute',
    route: { path: 'pricing', section: 'public' },
  },
  {
    file: 'routes/verify-email.tsx',
    title: 'Verify Email',
    importPath: '@chaaskit/client/routes/VerifyEmailRoute',
    route: { path: 'verify-email', section: 'public' },
  },
  {
    file: 'routes/invite.$token.tsx',
    title: 'Accept Invite',
    importPath: '@chaaskit/client/routes/AcceptInviteRoute',
    route: { path: 'invite/:token', section: 'public' },
  },
  {
    file: 'routes/oauth.consent.tsx',
    title: 'OAuth Consent',
    importPath: '@chaaskit/client/routes/OAuthConsentRoute',
    route: { path: 'oauth/consent', section: 'public' },
  },
];
