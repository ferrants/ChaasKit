import type { AppConfig } from '@chaaskit/shared';

export const config: AppConfig = {
  app: {
    name: 'My Chat App',
    description: 'AI-powered chat application',
    url: process.env.APP_URL || 'http://localhost:5173',
    basePath: '/chat', // Chat app lives under /chat, landing page at /
  },

  ui: {
    welcomeTitle: 'Welcome to My Chat App',
    welcomeSubtitle: 'How can I help you today?',
    inputPlaceholder: 'Type your message...',
    samplePrompts: [
      { label: 'Explain a concept', prompt: 'Explain quantum computing in simple terms' },
      { label: 'Write code', prompt: 'Write a function to sort an array' },
      { label: 'Help me brainstorm', prompt: 'Help me brainstorm ideas for a mobile app' },
    ],
    logo: '/logo.svg',
  },

  // Theming is configured in tailwind.config.ts for build-time CSS generation

  auth: {
    methods: ['email-password'],
    allowUnauthenticated: false,
    magicLink: {
      enabled: true,
      expiresInMinutes: 15,
    },
  },

  // Configure your AI agent(s) here
  agent: {
    agents: [
      {
        id: 'default',
        name: 'Assistant',
        provider: 'openai', // or 'anthropic'
        model: 'gpt-4o-mini',
        systemPrompt: 'You are a helpful AI assistant.',
        maxTokens: 4096,
        isDefault: true,
        // Enable all native tools (web-scrape, etc.)
        allowedTools: ['native:*'],
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
        params: {
          monthlyMessageLimit: 20,
        },
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
        label: 'Your Name',
        type: 'text',
        placeholder: 'Enter your name',
      },
      {
        key: 'context',
        label: 'Additional Context',
        type: 'textarea',
        placeholder: 'Any context the AI should know about you...',
      },
    ],
  },

  sharing: {
    enabled: true,
    scope: 'public',
    expirationOptions: ['1h', '24h', '7d', '30d', 'never'],
  },

  teams: {
    enabled: true,
  },

  projects: {
    enabled: true,
    colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'],
  },

  api: {
    enabled: true,
  },

  promptTemplates: {
    enabled: true,
    builtIn: [
      {
        id: 'explain',
        name: 'Explain Code',
        prompt: 'Explain this code:\n\n{{code}}',
        variables: ['code'],
      },
      {
        id: 'review',
        name: 'Code Review',
        prompt: 'Review this code for bugs, security issues, and improvements:\n\n{{code}}',
        variables: ['code'],
      },
    ],
    allowUserTemplates: true,
  },

  documents: {
    enabled: true,
    storage: {
      provider: 'database',
    },
    maxFileSizeMB: 10,
    hybridThreshold: 1000,
    acceptedTypes: [
      'text/plain',
      'text/markdown',
      'text/x-markdown',
      'text/csv',
      'application/json',
    ],
  },
};
