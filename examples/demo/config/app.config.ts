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
    emailVerification: {
      enabled: true,
      codeLength: 6,
      expiresInMinutes: 15,
      allowResendAfterSeconds: 60,
    },
    gating: {
      mode: 'open',
      inviteExpiryDays: 7,
      waitlistEnabled: true,
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
        systemPrompt: 'You are a helpful AI assistant. You can delegate specialized tasks to sub-agents using the delegate_to_agent tool when appropriate.',
        maxTokens: 4096,
        isDefault: true,
        // Enable all native tools (web-scrape, delegate_to_agent, etc.)
        allowedTools: ['native:*', 'marketplaceadpros:*'],
      },
      {
        id: 'researcher',
        name: 'Research Agent',
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'You are a research specialist. You thoroughly investigate topics, provide detailed analysis with sources, and present your findings in a clear, structured format.',
        maxTokens: 4096,
        allowedTools: ['native:web-scrape'],
      },
      {
        id: 'coder',
        name: 'Coding Agent',
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'You are a coding specialist. You write clean, well-documented code. You explain your implementation decisions and suggest tests.',
        maxTokens: 4096,
      },
    ],
  },


  email: {
    enabled: true,
    providerConfig: {
      type: 'ses',
      region: 'us-west-2',
    },
    fromAddress: 'hello@chaaskit.com',
    fromName: 'ChaasKit',
  },


  mcp: {
    servers: [
      {
        id: 'marketplaceadpros',
        name: 'MarketplaceAdPros',
        transport: 'streamable-http',
        url: 'https://app.marketplaceadpros.com/mcp',
        enabled: true,
        authMode: 'team-oauth',
        userInstructions: 'Ask your team admin to authorize your MarketplaceAdPros account in Team Settings',
      },
    ],
    allowUserServers: true,
    toolConfirmation: {
      mode: 'all', // 'none' | 'all' | 'whitelist' | 'blacklist'
      tools: [], // Tool patterns for whitelist/blacklist modes
    },
    toolTimeout: 30000,
    showToolCalls: true, // Set to false to hide tool execution cards in chat
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
