export const MESSAGE_ROLES = ['user', 'assistant', 'system'] as const;

export const AUTH_METHODS = ['email-password', 'google', 'github', 'magic-link'] as const;

export const PLAN_TYPES = ['free', 'monthly', 'credits'] as const;

export const MCP_TRANSPORTS = ['stdio', 'sse'] as const;

export const EXPORT_FORMATS = ['markdown', 'json', 'pdf'] as const;

export const SHARE_EXPIRATIONS = ['1h', '24h', '7d', '30d', 'never'] as const;

export const FEEDBACK_TYPES = ['up', 'down'] as const;

export const DEFAULT_MAX_TOKENS = 4096;

export const DEFAULT_FILE_SIZE_MB = 10;

export const DEFAULT_TOOL_TIMEOUT_MS = 30000;

export const API_ENDPOINTS = {
  // Auth
  REGISTER: '/api/auth/register',
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  MAGIC_LINK: '/api/auth/magic-link',
  OAUTH: '/api/auth/oauth',
  CALLBACK: '/api/auth/callback',
  ME: '/api/auth/me',

  // Threads
  THREADS: '/api/threads',
  THREAD: (id: string) => `/api/threads/${id}`,

  // Chat
  CHAT: '/api/chat',

  // Documents
  DOCUMENTS: '/api/documents',
  DOCUMENT: (id: string) => `/api/documents/${id}`,
  DOCUMENTS_UPLOAD: '/api/documents/upload',
  MENTIONS_SEARCH: '/api/mentions/search',

  // Messages
  MESSAGE_FEEDBACK: (id: string) => `/api/messages/${id}/feedback`,
  MESSAGE_REGENERATE: (id: string) => `/api/messages/${id}/regenerate`,
  MESSAGE_BRANCH: (id: string) => `/api/messages/${id}/branch`,

  // Search & Share
  SEARCH: '/api/search',
  SHARE: (id: string) => `/api/threads/${id}/share`,
  SHARED: (shareId: string) => `/api/shared/${shareId}`,
  EXPORT: (id: string) => `/api/threads/${id}/export`,

  // Templates
  TEMPLATES: '/api/templates',
  TEMPLATE: (id: string) => `/api/templates/${id}`,

  // MCP
  MCP_SERVERS: '/api/mcp/servers',
  MCP_TOOLS: '/api/mcp/tools',
  MCP_INVOKE: (serverId: string, toolName: string) => `/api/mcp/tools/${serverId}/${toolName}`,

  // User
  USER_SETTINGS: '/api/user/settings',
  USER_SUBSCRIPTION: '/api/user/subscription',

  // Payments
  CHECKOUT: '/api/payments/checkout',
  WEBHOOK: '/api/payments/webhook',
  BUY_CREDITS: '/api/payments/buy-credits',
  BILLING_PORTAL: '/api/payments/billing-portal',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;
