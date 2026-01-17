export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  oauthProvider?: string;
  oauthId?: string;
  plan: string;
  stripeCustomerId?: string;
  credits: number;
  messagesThisMonth: number;
  settings: Record<string, unknown>;
  themePreference?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  isAdmin: boolean;
  emailVerified: boolean;
  plan: string;
  credits: number;
  messagesThisMonth: number;
  themePreference?: string | null;
}

export interface UserSettings {
  name?: string;
  role?: string;
  context?: string;
  mcpServers?: MCPUserServer[];
  [key: string]: unknown;
}

export interface MCPUserServer {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
}

export interface UsageInfo {
  messagesThisMonth: number;
  monthlyLimit: number;
  credits: number;
  plan: string;
}
