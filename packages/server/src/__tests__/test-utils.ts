import type { AppConfig } from '@chaaskit/shared';
import { createApp } from '../app.js';
import { resetConfig } from '../config/loader.js';

export function buildTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const base: AppConfig = {
    app: {
      name: 'Test App',
      description: 'Test app',
      url: 'http://localhost:5173',
      basePath: '/chat',
    },
    ui: {
      welcomeTitle: 'Welcome',
      welcomeSubtitle: 'Subtitle',
      inputPlaceholder: 'Type...',
      samplePrompts: [{ label: 'Hello', prompt: 'Hello' }],
      logo: '/logo.svg',
    },
    theming: {
      defaultTheme: 'light',
      allowUserThemeSwitch: true,
      themes: {
        light: {
          name: 'Light',
          colors: {
            primary: '#000000',
            primaryHover: '#111111',
            secondary: '#222222',
            background: '#ffffff',
            backgroundSecondary: '#f5f5f5',
            sidebar: '#f0f0f0',
            textPrimary: '#000000',
            textSecondary: '#333333',
            textMuted: '#666666',
            border: '#e5e5e5',
            inputBackground: '#ffffff',
            inputBorder: '#d0d0d0',
            userMessageBg: '#000000',
            userMessageText: '#ffffff',
            assistantMessageBg: '#f0f0f0',
            assistantMessageText: '#000000',
            success: '#00ff00',
            warning: '#ffcc00',
            error: '#ff0000',
          },
        },
      },
      fonts: {
        sans: 'Inter',
        mono: 'JetBrains Mono',
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        full: '9999px',
      },
    },
    auth: {
      methods: ['email-password', 'magic-link'],
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
    },
    agent: {
      agents: [
        {
          id: 'default',
          name: 'Assistant',
          provider: 'openai',
          model: 'gpt-4o-mini',
          systemPrompt: 'You are helpful.',
          maxTokens: 4096,
          isDefault: true,
          allowedTools: ['native:*'],
        },
        {
          id: 'pro-agent',
          name: 'Pro Agent',
          provider: 'openai',
          model: 'gpt-4o-mini',
          systemPrompt: 'You are pro.',
          maxTokens: 4096,
          plans: ['pro'],
        },
      ],
    },
    payments: {
      enabled: false,
      provider: 'stripe',
      plans: [
        {
          id: 'free',
          name: 'Free',
          type: 'free',
          params: { monthlyMessageLimit: 20 },
        },
      ],
    },
    legal: {
      privacyPolicyUrl: '/privacy',
      termsOfServiceUrl: '/terms',
    },
    userSettings: {
      fields: [
        {
          key: 'name',
          label: 'Name',
          type: 'text',
        },
      ],
    },
    credits: {
      enabled: true,
      expiryEnabled: true,
      defaultExpiryDays: 365,
      tokensPerCredit: 1000,
      referralRewardCredits: 10,
      referralTriggers: {
        signup: true,
        firstMessage: true,
        paying: true,
      },
      promoEnabled: true,
    },
    metering: {
      enabled: true,
      recordPromptCompletion: true,
    },
  };

  return {
    ...base,
    ...overrides,
    app: { ...base.app, ...overrides.app },
    ui: { ...base.ui, ...overrides.ui },
    theming: { ...base.theming, ...overrides.theming },
    auth: { ...base.auth, ...overrides.auth },
    agent: overrides.agent ?? base.agent,
    payments: { ...base.payments, ...overrides.payments },
    legal: { ...base.legal, ...overrides.legal },
    userSettings: { ...base.userSettings, ...overrides.userSettings },
  };
}

export async function createTestApp(overrides: Partial<AppConfig> = {}) {
  resetConfig();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
  const config = buildTestConfig(overrides);
  return createApp({ config, loadExtensions: false, serveSpa: false });
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}
