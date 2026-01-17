import type { AppConfig } from '@chaaskit/shared';

export const config: AppConfig = {
  app: {
    name: 'My Chat App',
    description: 'AI-powered chat application',
    url: 'http://localhost:5173',
    basePath: '/chat',  // Chat app lives under /chat, landing page at /
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

  theming: {
    defaultTheme: 'light',
    allowUserThemeSwitch: true,
    themes: {
      light: {
        name: 'Light',
        colors: {
          primary: '#6366f1',
          primaryHover: '#4f46e5',
          secondary: '#8b5cf6',
          background: '#ffffff',
          backgroundSecondary: '#f9fafb',
          sidebar: '#f3f4f6',
          textPrimary: '#111827',
          textSecondary: '#6b7280',
          textMuted: '#9ca3af',
          border: '#e5e7eb',
          inputBackground: '#ffffff',
          inputBorder: '#d1d5db',
          userMessageBg: '#6366f1',
          userMessageText: '#ffffff',
          assistantMessageBg: '#f3f4f6',
          assistantMessageText: '#111827',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
      dark: {
        name: 'Dark',
        colors: {
          primary: '#818cf8',
          primaryHover: '#a5b4fc',
          secondary: '#a78bfa',
          background: '#111827',
          backgroundSecondary: '#1f2937',
          sidebar: '#0f172a',
          textPrimary: '#f9fafb',
          textSecondary: '#d1d5db',
          textMuted: '#6b7280',
          border: '#374151',
          inputBackground: '#1f2937',
          inputBorder: '#4b5563',
          userMessageBg: '#4f46e5',
          userMessageText: '#ffffff',
          assistantMessageBg: '#1f2937',
          assistantMessageText: '#f9fafb',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#f87171',
        },
      },
    },
    fonts: {
      sans: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, Menlo, monospace',
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

  // Configure your AI agent(s) here
  // Using multi-agent format to enable native tools
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
        // Use 'native:*' for all, or 'native:web-scrape' for specific tools
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

  // API access (for programmatic use)
  api: {
    enabled: true,
    // allowedPlans: ['pro', 'enterprise'],  // Optional: restrict to specific plans
    // keyPrefix: 'myapp-',  // Optional: custom prefix for API keys (default: "sk-")
    // allowedEndpoints: [   // Endpoints accessible via API keys (default: none)
    //   '/api/chat',        // Exact match
    //   '/api/threads',     // List threads
    //   '/api/threads/*',   // Single thread operations (e.g., /api/threads/123)
    //   '/api/threads/**',  // All thread sub-routes (e.g., /api/threads/123/messages)
    // ],
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

  // Mentionable documents - reference documents in chat with @mentions
  documents: {
    enabled: true,
    storage: {
      provider: 'database',  // 'database' | 'filesystem' | 's3'
    },
    maxFileSizeMB: 10,
    hybridThreshold: 1000,  // Documents under this char count are injected into context
    acceptedTypes: [
      'text/plain',
      'text/markdown',
      'text/x-markdown',
      'text/csv',
      'application/json',
    ],
  },
};
