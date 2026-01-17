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

export const authConfigSchema = z.object({
  methods: z.array(z.enum(['email-password', 'google', 'github', 'magic-link'])),
  allowUnauthenticated: z.boolean(),
  magicLink: z.object({
    enabled: z.boolean(),
    expiresInMinutes: z.number(),
  }),
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

export const agentConfigSchema = z.discriminatedUnion('type', [
  builtInAgentConfigSchema,
  externalAgentConfigSchema,
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

export const mcpServerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  transport: z.enum(['stdio', 'sse']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  enabled: z.boolean(),
});

export const mcpConfigSchema = z.object({
  servers: z.array(mcpServerConfigSchema),
  allowUserServers: z.boolean(),
  requireToolConfirmation: z.boolean(),
  toolTimeout: z.number(),
});

export const userSettingsFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'select', 'textarea']),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const appConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    description: z.string(),
    url: z.string(),
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
  sharing: z.object({
    enabled: z.boolean(),
    allowPublicLinks: z.boolean(),
    allowTeamSharing: z.boolean(),
    expirationOptions: z.array(z.string()),
  }).optional(),
  promptTemplates: z.object({
    enabled: z.boolean(),
    builtIn: z.array(z.object({
      id: z.string(),
      name: z.string(),
      prompt: z.string(),
      variables: z.array(z.string()),
    })),
    allowUserTemplates: z.boolean(),
  }).optional(),
});

export type ValidatedAppConfig = z.infer<typeof appConfigSchema>;
