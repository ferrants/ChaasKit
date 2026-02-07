import { appConfigSchema } from '../config.js';

const minimalConfig = {
  app: {
    name: 'Test',
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
    methods: ['email-password'],
    allowUnauthenticated: false,
    magicLink: {
      enabled: true,
      expiresInMinutes: 15,
    },
  },
  agent: {
    type: 'built-in',
    provider: 'openai',
    model: 'gpt-4o-mini',
    systemPrompt: 'You are helpful.',
    maxTokens: 4096,
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
};

test('appConfigSchema accepts a minimal valid config', () => {
  expect(() => appConfigSchema.parse(minimalConfig)).not.toThrow();
});

test('appConfigSchema rejects invalid auth methods', () => {
  const badConfig = {
    ...minimalConfig,
    auth: {
      ...minimalConfig.auth,
      methods: ['twitter'],
    },
  };

  expect(() => appConfigSchema.parse(badConfig)).toThrow();
});
