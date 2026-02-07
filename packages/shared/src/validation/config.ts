import { z } from 'zod';

export const themeColorsSchema = z.object({
  primary: z.string(),
  primaryHover: z.string(),
  secondary: z.string(),
  background: z.string(),
  backgroundSecondary: z.string(),
  sidebar: z.string(),
  textPrimary: z.string(),
  textSecondary: z.string(),
  textMuted: z.string(),
  border: z.string(),
  inputBackground: z.string(),
  inputBorder: z.string(),
  userMessageBg: z.string(),
  userMessageText: z.string(),
  assistantMessageBg: z.string(),
  assistantMessageText: z.string(),
  success: z.string(),
  warning: z.string(),
  error: z.string(),
});

export const themeSchema = z.object({
  name: z.string(),
  colors: themeColorsSchema,
});

export const themingConfigSchema = z.object({
  defaultTheme: z.string(),
  allowUserThemeSwitch: z.boolean(),
  themes: z.record(themeSchema),
  fonts: z.object({
    sans: z.string(),
    mono: z.string(),
  }),
  borderRadius: z.object({
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    full: z.string(),
  }),
});

export const samplePromptSchema = z.object({
  label: z.string(),
  prompt: z.string(),
});

export const uiConfigSchema = z.object({
  welcomeTitle: z.string(),
  welcomeSubtitle: z.string(),
  inputPlaceholder: z.string(),
  samplePrompts: z.array(samplePromptSchema),
  logo: z.union([
    z.string(),
    z.object({ light: z.string(), dark: z.string() }),
  ]),
});

export const emailVerificationSchema = z.object({
  enabled: z.boolean(),
  codeLength: z.number().optional(),
  expiresInMinutes: z.number().optional(),
  allowResendAfterSeconds: z.number().optional(),
});

export const authConfigSchema = z.object({
  methods: z.array(z.enum(['email-password', 'google', 'github', 'magic-link'])),
  allowUnauthenticated: z.boolean(),
  magicLink: z.object({
    enabled: z.boolean(),
    expiresInMinutes: z.number(),
  }),
  emailVerification: emailVerificationSchema.optional(),
  gating: z.object({
    mode: z.enum(['open', 'invite_only', 'closed', 'timed_window', 'capacity_limit']),
    inviteExpiryDays: z.number().optional(),
    windowStart: z.string().optional(),
    windowEnd: z.string().optional(),
    capacityLimit: z.number().optional(),
    waitlistEnabled: z.boolean().optional(),
  }).optional(),
});

export const builtInAgentConfigSchema = z.object({
  type: z.literal('built-in'),
  provider: z.enum(['anthropic', 'openai']),
  model: z.string(),
  systemPrompt: z.string(),
  maxTokens: z.number(),
});

export const externalAgentConfigSchema = z.object({
  type: z.literal('external'),
  endpoint: z.string().url(),
  headers: z.record(z.string()).optional(),
});

const builtInAgentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(['anthropic', 'openai']),
  model: z.string(),
  systemPrompt: z.string(),
  maxTokens: z.number(),
  isDefault: z.boolean().optional(),
  allowedTools: z.array(z.string()).optional(),
  plans: z.array(z.string()).optional(),
});

const externalAgentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal('external'),
  endpoint: z.string().url(),
  headers: z.record(z.string()).optional(),
  isDefault: z.boolean().optional(),
  allowedTools: z.array(z.string()).optional(),
  plans: z.array(z.string()).optional(),
});

const agentDefinitionSchema = z.union([
  builtInAgentDefinitionSchema,
  externalAgentDefinitionSchema,
]);

const multiAgentConfigSchema = z.object({
  agents: z.array(agentDefinitionSchema),
});

export const agentConfigSchema = z.union([
  builtInAgentConfigSchema,
  externalAgentConfigSchema,
  multiAgentConfigSchema,
]);

export const paymentPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['free', 'monthly', 'credits']),
  params: z.union([
    z.object({ monthlyMessageLimit: z.number() }),
    z.object({
      priceUSD: z.number(),
      monthlyMessageLimit: z.number(),
      stripePriceId: z.string(),
    }),
    z.object({
      pricePerCredit: z.number(),
      messagesPerCredit: z.number(),
    }),
  ]),
});

export const paymentsConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.literal('stripe'),
  plans: z.array(paymentPlanSchema),
});

const mcpOAuthConfigSchema = z.object({
  authorizationEndpoint: z.string().optional(),
  tokenEndpoint: z.string().optional(),
  clientId: z.string().optional(),
  clientSecretEnvVar: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  clientName: z.string().optional(),
  clientUri: z.string().optional(),
});

const mcpServerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  transport: z.enum(['stdio', 'sse', 'streamable-http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  enabled: z.boolean(),
  authMode: z.enum(['none', 'admin', 'user-apikey', 'user-oauth']).optional(),
  adminApiKeyEnvVar: z.string().optional(),
  oauth: mcpOAuthConfigSchema.optional(),
  userInstructions: z.string().optional(),
});

const toolConfirmationSchema = z.object({
  mode: z.enum(['none', 'all', 'whitelist', 'blacklist']),
  tools: z.array(z.string()).optional(),
});

const mcpServerExportOAuthSchema = z.object({
  enabled: z.boolean(),
  allowDynamicRegistration: z.boolean(),
  accessTokenTTLSeconds: z.number().optional(),
  refreshTokenTTLSeconds: z.number().optional(),
});

const mcpServerExportSchema = z.object({
  enabled: z.boolean(),
  exposeTools: z.union([z.enum(['all', 'native']), z.array(z.string())]).optional(),
  oauth: mcpServerExportOAuthSchema.optional(),
});

export const mcpConfigSchema = z.object({
  servers: z.array(mcpServerConfigSchema),
  allowUserServers: z.boolean(),
  toolConfirmation: toolConfirmationSchema.optional(),
  toolTimeout: z.number(),
  showToolCalls: z.boolean().optional(),
  server: mcpServerExportSchema.optional(),
});

export const userSettingsFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'select', 'textarea']),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

const sharingConfigSchema = z.object({
  enabled: z.boolean(),
  scope: z.enum(['public', 'team']),
  expirationOptions: z.array(z.string()),
});

const promptTemplatesConfigSchema = z.object({
  enabled: z.boolean(),
  builtIn: z.array(z.object({
    id: z.string(),
    name: z.string(),
    prompt: z.string(),
    variables: z.array(z.string()),
  })),
  allowUserTemplates: z.boolean(),
});

const teamsConfigSchema = z.object({
  enabled: z.boolean(),
});

const projectsConfigSchema = z.object({
  enabled: z.boolean(),
  colors: z.array(z.string()),
});

const adminConfigSchema = z.object({
  emails: z.array(z.string()),
});

const apiConfigSchema = z.object({
  enabled: z.boolean(),
  allowedPlans: z.array(z.string()).optional(),
  keyPrefix: z.string().optional(),
  allowedEndpoints: z.array(z.string()).optional(),
});

const documentsConfigSchema = z.object({
  enabled: z.boolean(),
  storage: z.object({
    provider: z.enum(['database', 'filesystem', 's3']),
    filesystem: z.object({ basePath: z.string() }).optional(),
    s3: z.object({
      bucket: z.string(),
      region: z.string(),
      endpoint: z.string().optional(),
    }).optional(),
  }),
  maxFileSizeMB: z.number(),
  hybridThreshold: z.number(),
  acceptedTypes: z.array(z.string()),
});

const slackNotificationConfigSchema = z.object({
  event: z.enum(['thread_shared', 'message_liked', 'team_member_joined']),
  enabled: z.boolean(),
});

const slackConfigSchema = z.object({
  enabled: z.boolean(),
  clientIdEnvVar: z.string(),
  clientSecretEnvVar: z.string(),
  signingSecretEnvVar: z.string(),
  internalSecretEnvVar: z.string(),
  allowedPlans: z.array(z.string()).optional(),
  aiChat: z.object({
    enabled: z.boolean(),
    threadContinuity: z.boolean(),
  }).optional(),
  notifications: z.object({
    events: z.array(slackNotificationConfigSchema),
  }).optional(),
});

const queueProviderConfigSchema = z.union([
  z.object({
    type: z.literal('memory'),
    maxHistorySize: z.number().optional(),
  }),
  z.object({
    type: z.literal('sqs'),
    region: z.string(),
    queueUrl: z.string(),
    deadLetterQueueUrl: z.string().optional(),
    visibilityTimeout: z.number().optional(),
  }),
]);

const queueWorkerConfigSchema = z.object({
  mode: z.enum(['in-process', 'standalone']),
  concurrency: z.number().optional(),
  pollInterval: z.number().optional(),
  shutdownTimeout: z.number().optional(),
});

const queueSchedulerConfigSchema = z.object({
  enabled: z.boolean(),
  pollInterval: z.number().optional(),
});

const queueConfigSchema = z.object({
  enabled: z.boolean(),
  providerConfig: queueProviderConfigSchema,
  worker: queueWorkerConfigSchema.optional(),
  scheduler: queueSchedulerConfigSchema.optional(),
});

const emailProviderConfigSchema = z.object({
  type: z.literal('ses'),
  region: z.string(),
});

const emailConfigSchema = z.object({
  enabled: z.boolean(),
  providerConfig: emailProviderConfigSchema,
  fromAddress: z.string(),
  fromName: z.string().optional(),
});

const scheduledPromptsPlanLimitsSchema = z.object({
  plan: z.string(),
  maxUserPrompts: z.number().optional(),
  maxTeamPrompts: z.number().optional(),
});

const scheduledPromptsConfigSchema = z.object({
  enabled: z.boolean(),
  featureName: z.string().optional(),
  allowUserPrompts: z.boolean().optional(),
  allowTeamPrompts: z.boolean().optional(),
  defaultTimezone: z.string().optional(),
  planLimits: z.array(scheduledPromptsPlanLimitsSchema).optional(),
  defaultMaxUserPrompts: z.number().optional(),
  defaultMaxTeamPrompts: z.number().optional(),
});

const rateLimitConfigSchema = z.object({
  enabled: z.boolean().optional(),
  windowMs: z.number().optional(),
  max: z.number().optional(),
  message: z.string().optional(),
});

const referralTriggersSchema = z.object({
  signup: z.boolean(),
  firstMessage: z.boolean(),
  paying: z.boolean(),
});

const creditsConfigSchema = z.object({
  enabled: z.boolean(),
  expiryEnabled: z.boolean().optional(),
  defaultExpiryDays: z.number().optional(),
  tokensPerCredit: z.number().optional(),
  referralRewardCredits: z.number().optional(),
  referralTriggers: referralTriggersSchema.optional(),
  promoEnabled: z.boolean().optional(),
});

const meteringConfigSchema = z.object({
  enabled: z.boolean(),
  recordPromptCompletion: z.boolean().optional(),
});

export const appConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    description: z.string(),
    url: z.string(),
    basePath: z.string().optional(),
  }),
  ui: uiConfigSchema,
  theming: themingConfigSchema,
  auth: authConfigSchema,
  agent: agentConfigSchema,
  payments: paymentsConfigSchema,
  legal: z.object({
    privacyPolicyUrl: z.string(),
    termsOfServiceUrl: z.string(),
  }),
  userSettings: z.object({
    fields: z.array(userSettingsFieldSchema),
  }),
  mcp: mcpConfigSchema.optional(),
  sharing: sharingConfigSchema.optional(),
  promptTemplates: promptTemplatesConfigSchema.optional(),
  teams: teamsConfigSchema.optional(),
  projects: projectsConfigSchema.optional(),
  admin: adminConfigSchema.optional(),
  api: apiConfigSchema.optional(),
  documents: documentsConfigSchema.optional(),
  slack: slackConfigSchema.optional(),
  queue: queueConfigSchema.optional(),
  email: emailConfigSchema.optional(),
  scheduledPrompts: scheduledPromptsConfigSchema.optional(),
  rateLimit: rateLimitConfigSchema.optional(),
  credits: creditsConfigSchema.optional(),
  metering: meteringConfigSchema.optional(),
});

export type ValidatedAppConfig = z.infer<typeof appConfigSchema>;
