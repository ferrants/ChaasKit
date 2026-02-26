import type { ThemeConfig } from './theme.js';
import type { PaymentPlan } from './payment.js';
import type { MCPServerConfig, ToolConfirmationConfig, MCPServerExportConfig } from './mcp.js';

export interface AppInfo {
  name: string;
  description: string;
  url: string;
  basePath?: string;  // Optional, defaults to '/chat'. Use to run app under a path (e.g., '/chat')
}

export interface SamplePrompt {
  label: string;
  prompt: string;
}

export interface UIConfig {
  welcomeTitle: string;
  welcomeSubtitle: string;
  inputPlaceholder: string;
  samplePrompts: SamplePrompt[];
  logo: string | { light: string; dark: string };
}

export interface MagicLinkConfig {
  enabled: boolean;
  expiresInMinutes: number;
}

export interface EmailVerificationConfig {
  enabled: boolean;
  codeLength?: number;              // Default: 6
  expiresInMinutes?: number;        // Default: 15
  allowResendAfterSeconds?: number; // Default: 60
}

export type AuthMethod = 'email-password' | 'google' | 'github' | 'magic-link';

export type AuthGatingMode = 'open' | 'invite_only' | 'closed' | 'timed_window' | 'capacity_limit';

export interface AuthGatingConfig {
  mode: AuthGatingMode;
  inviteExpiryDays?: number; // Default: 7
  windowStart?: string;      // ISO timestamp
  windowEnd?: string;        // ISO timestamp
  capacityLimit?: number;
  waitlistEnabled?: boolean;
}

export interface AuthConfig {
  methods: AuthMethod[];
  allowUnauthenticated: boolean;
  magicLink: MagicLinkConfig;
  emailVerification?: EmailVerificationConfig;
  gating?: AuthGatingConfig;
}

// Legacy single-agent configurations (for backward compatibility)
export interface BuiltInAgentConfig {
  type: 'built-in';
  provider: 'anthropic' | 'openai';
  model: string;
  systemPrompt: string;
  maxTokens: number;
}

export interface ExternalAgentConfig {
  type: 'external';
  endpoint: string;
  headers?: Record<string, string>;
}

// Multi-agent configuration types
export interface BuiltInAgentDefinition {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai';
  model: string;
  systemPrompt: string;
  maxTokens: number;
  isDefault?: boolean;
  allowedTools?: string[]; // Tool patterns: 'server:*' or 'server:tool-name'
  plans?: string[]; // Plan IDs that can access this agent (omit = all plans)
}

export interface ExternalAgentDefinition {
  id: string;
  name: string;
  type: 'external';
  endpoint: string;
  headers?: Record<string, string>;
  isDefault?: boolean;
  allowedTools?: string[];
  plans?: string[];
}

export type AgentDefinition = BuiltInAgentDefinition | ExternalAgentDefinition;

export interface MultiAgentConfig {
  agents: AgentDefinition[];
}

// Union type: supports both legacy single-agent and new multi-agent configs
export type AgentConfig = BuiltInAgentConfig | ExternalAgentConfig | MultiAgentConfig;

export interface PaymentsConfig {
  enabled: boolean;
  provider: 'stripe';
  plans: PaymentPlan[];
}

export interface LegalConfig {
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
}

export interface UserSettingsField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  placeholder?: string;
  options?: string[];
}

export interface UserSettingsConfig {
  fields: UserSettingsField[];
}

export interface MCPConfig {
  servers: MCPServerConfig[];
  allowUserServers: boolean;
  toolConfirmation?: ToolConfirmationConfig;
  toolTimeout: number;
  showToolCalls?: boolean; // Show tool execution cards in chat (default: true)
  logToolDetails?: boolean; // Log full tool args/results (default: false)
  /** Expose this app as an MCP server for external clients */
  server?: MCPServerExportConfig;
}

export type SharingScope = 'public' | 'team';

export interface SharingConfig {
  enabled: boolean;
  scope: SharingScope; // 'public' = anyone with link, 'team' = authenticated team members only
  expirationOptions: string[];
}

export interface PromptTemplateConfig {
  enabled: boolean;
  builtIn: PromptTemplate[];
  allowUserTemplates: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  variables: string[];
}

export interface TeamsConfig {
  enabled: boolean;
}

export interface AdminConfig {
  emails: string[]; // List of email addresses that have admin access
}

export interface ApiConfig {
  enabled: boolean;
  allowedPlans?: string[];  // If set, only these plans can create keys
  keyPrefix?: string;       // Prefix for generated keys (default: "sk-")
  allowedEndpoints?: string[];  // Endpoints accessible via API keys (default: none)
                                // Supports patterns: "/api/threads", "/api/threads/*", "/api/chat/**"
                                // * matches one segment, ** matches any depth
}

export interface ProjectsConfig {
  enabled: boolean;
  colors: string[]; // hex colors for project color picker
}

export interface DocumentsConfig {
  enabled: boolean;
  storage: {
    provider: 'database' | 'filesystem' | 's3';
    // Provider-specific options
    filesystem?: { basePath: string };
    s3?: { bucket: string; region: string; endpoint?: string };
  };
  maxFileSizeMB: number;
  hybridThreshold: number;  // chars threshold for tool-based vs context injection
  acceptedTypes: string[];  // MIME types
}

export interface ReferralTriggersConfig {
  signup: boolean;
  firstMessage: boolean;
  paying: boolean;
}

export interface CreditsConfig {
  enabled: boolean;
  expiryEnabled?: boolean;
  defaultExpiryDays?: number;
  tokensPerCredit?: number;
  referralRewardCredits?: number;
  referralTriggers?: ReferralTriggersConfig;
  promoEnabled?: boolean;
}

export interface MeteringConfig {
  enabled: boolean;
  recordPromptCompletion?: boolean;
}

// Queue Provider Configuration (discriminated union)
export interface MemoryQueueProviderConfig {
  type: 'memory';
  maxHistorySize?: number; // Default: 1000
}

export interface SQSQueueProviderConfig {
  type: 'sqs';
  region: string;
  queueUrl: string;
  deadLetterQueueUrl?: string;
  visibilityTimeout?: number; // Default: 30s
}

// Future providers can be added to this union:
// | RedisQueueProviderConfig
// | RabbitMQQueueProviderConfig
export type QueueProviderConfig = MemoryQueueProviderConfig | SQSQueueProviderConfig;

// Email Provider Configuration (discriminated union)
export interface SESEmailProviderConfig {
  type: 'ses';
  region: string;
  // Uses AWS credentials from environment (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
}

// Future providers can be added to this union:
// | ResendEmailProviderConfig
// | SendGridEmailProviderConfig
export type EmailProviderConfig = SESEmailProviderConfig;

export interface EmailConfig {
  enabled: boolean;
  providerConfig: EmailProviderConfig;
  fromAddress: string;
  fromName?: string;
}

// Scheduled Prompts (Automations) Configuration
export interface ScheduledPromptsPlanLimits {
  plan: string;                      // Plan ID to match
  maxUserPrompts?: number;           // Max prompts per user on this plan
  maxTeamPrompts?: number;           // Max prompts per team on this plan
}

export interface ScheduledPromptsConfig {
  enabled: boolean;
  featureName?: string;              // Display name: "Automations", "Scheduled Prompts" (default)
  allowUserPrompts?: boolean;        // Default: true
  allowTeamPrompts?: boolean;        // Default: true
  defaultTimezone?: string;          // Default: "UTC"
  planLimits?: ScheduledPromptsPlanLimits[];  // Limits per plan
  defaultMaxUserPrompts?: number;    // Fallback if plan not in list (default: 0)
  defaultMaxTeamPrompts?: number;    // Fallback if plan not in list (default: 0)
}

export interface QueueWorkerConfig {
  mode: 'in-process' | 'standalone'; // Default: 'in-process'
  concurrency?: number;              // Default: 5
  pollInterval?: number;             // Default: 1000ms (fallback for providers without long polling)
  shutdownTimeout?: number;          // Default: 30000ms
}

export interface QueueSchedulerConfig {
  enabled: boolean;       // Default: false
  pollInterval?: number;  // Default: 60000ms (1 min)
}

export interface QueueConfig {
  enabled: boolean;
  providerConfig: QueueProviderConfig;
  worker?: QueueWorkerConfig;
  scheduler?: QueueSchedulerConfig;
}

// Slack Integration Configuration
export type SlackNotificationEvent = 'thread_shared' | 'message_liked' | 'team_member_joined';

export interface SlackNotificationConfig {
  event: SlackNotificationEvent;
  enabled: boolean;
}

export interface SlackConfig {
  enabled: boolean;
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  signingSecretEnvVar: string;
  internalSecretEnvVar: string;
  allowedPlans?: string[];
  aiChat?: {
    enabled: boolean;
    threadContinuity: boolean;
  };
  notifications?: {
    events: SlackNotificationConfig[];
  };
}

export interface RateLimitConfig {
  enabled?: boolean;           // Default: true
  windowMs?: number;           // Time window in ms (default: 15 * 60 * 1000 = 15 minutes)
  max?: number;                // Max requests per window per IP (default: 100)
  message?: string;            // Custom error message
}

/**
 * Main application configuration.
 *
 * SYNC NOTE: When adding new config sections here, also update:
 * - packages/server/src/api/config.ts (buildClientConfig function)
 * - packages/client/src/ssr-utils.tsx (ConfigScript safeConfig)
 *   Both must expose client-safe fields to the frontend.
 */
export interface AppConfig {
  app: AppInfo;
  ui: UIConfig;
  theming: ThemeConfig;
  auth: AuthConfig;
  agent: AgentConfig;
  payments: PaymentsConfig;
  legal: LegalConfig;
  userSettings: UserSettingsConfig;
  mcp?: MCPConfig;
  sharing?: SharingConfig;
  promptTemplates?: PromptTemplateConfig;
  teams?: TeamsConfig;
  projects?: ProjectsConfig;
  admin?: AdminConfig;
  api?: ApiConfig;
  documents?: DocumentsConfig;
  slack?: SlackConfig;
  queue?: QueueConfig;
  email?: EmailConfig;
  scheduledPrompts?: ScheduledPromptsConfig;
  rateLimit?: RateLimitConfig;
  credits?: CreditsConfig;
  metering?: MeteringConfig;
}

export interface PublicMCPServerConfig {
  id: string;
  name: string;
  transport: MCPServerConfig['transport'];
  enabled: boolean;
  authMode?: MCPServerConfig['authMode'];
  userInstructions?: string;
}

export interface PublicAppConfig {
  app: AppInfo;
  ui: UIConfig;
  theming: ThemeConfig;
  auth: {
    methods: AuthMethod[];
    allowUnauthenticated: boolean;
    magicLink: MagicLinkConfig;
    emailVerification?: EmailVerificationConfig;
    gating?: AuthGatingConfig;
    isAdmin?: boolean;
  };
  payments: {
    enabled: boolean;
    provider: PaymentsConfig['provider'];
  };
  legal: LegalConfig;
  userSettings: UserSettingsConfig;
  mcp?: {
    servers: PublicMCPServerConfig[];
    allowUserServers: boolean;
    toolConfirmation?: ToolConfirmationConfig;
    toolTimeout: number;
    showToolCalls?: boolean;
  };
  sharing?: SharingConfig;
  promptTemplates?: {
    enabled: boolean;
    allowUserTemplates: boolean;
  };
  teams?: TeamsConfig;
  projects?: ProjectsConfig;
  documents?: {
    enabled: boolean;
    maxFileSizeMB?: number;
    hybridThreshold?: number;
    acceptedTypes?: string[];
  };
  api?: {
    enabled: boolean;
  };
  email?: {
    enabled: boolean;
  };
  slack?: {
    enabled: boolean;
  };
  credits?: {
    enabled: boolean;
    expiryEnabled?: boolean;
    promoEnabled?: boolean;
  };
  metering?: {
    enabled: boolean;
    recordPromptCompletion?: boolean;
  };
  scheduledPrompts?: {
    enabled: boolean;
    featureName?: string;
    allowUserPrompts?: boolean;
    allowTeamPrompts?: boolean;
    defaultTimezone?: string;
    defaultMaxUserPrompts?: number;
    defaultMaxTeamPrompts?: number;
  };
}
