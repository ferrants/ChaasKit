import type { AppConfig } from '@chaaskit/shared';

export const config: AppConfig = {
  app: {
    name: 'My AI Assistant',
    description: 'Your helpful AI companion',
    url: 'https://myapp.com',
    basePath: '/app',
  },

  ui: {
    welcomeTitle: 'Welcome to My AI Assistant',
    welcomeSubtitle: 'How can I help you today?',
    inputPlaceholder: 'Type your message...',
    samplePrompts: [
      { label: 'Explain a concept', prompt: 'Explain quantum computing simply' },
      { label: 'Write code', prompt: 'Write a Python function that sorts a list' },
      { label: 'Brainstorm ideas', prompt: 'Help me brainstorm ideas for a mobile app' },
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
    methods: ['email-password', 'google', 'github'],
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

  // Multi-agent configuration
  // Supports multiple AI agents with different providers, models, and capabilities
  // Each agent can have restricted tool access and plan-based availability
  agent: {
    agents: [
      // General purpose assistant - available to all users
      {
        id: 'general',
        name: 'General Assistant',
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'You are a helpful AI assistant. Be concise and helpful.',
        maxTokens: 4096,
        isDefault: true,
      },
      {
        id: 'code-expert',
        name: 'Code Expert',
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'You are an expert programmer. Help users write, review, and debug code. Be thorough and explain your reasoning.',
        maxTokens: 8192,
        // Native tools (built into the app) and MCP tools can be controlled with allowedTools
        // 'native:web-scrape' - Fetch and read web pages
        // 'mcp-server:*' - All tools from an MCP server
        // 'mcp-server:tool-name' - Specific tool from an MCP server
        // Omitting allowedTools gives access to all MCP tools but no native tools
        allowedTools: ['native:web-scrape', 'native:get-plan-usage'],
      },
      // External agent example - custom endpoint
      // {
      //   id: 'custom-agent',
      //   name: 'Custom Agent',
      //   type: 'external',
      //   endpoint: 'https://my-agent.example.com/chat',
      //   headers: { 'Authorization': 'Bearer ${CUSTOM_AGENT_KEY}' },
      //   plans: ['enterprise'],
      // },
    ],
  },

  // Legacy single-agent configuration (still supported for backward compatibility):
  // agent: {
  //   type: 'built-in',
  //   provider: 'openai',
  //   model: 'gpt-4o-mini',
  //   systemPrompt: 'You are a helpful AI assistant. Be concise and helpful.',
  //   maxTokens: 4096,
  // },

  payments: {
    enabled: true,
    provider: 'stripe',
    plans: [
      {
        id: 'free',
        name: 'Free',
        description: 'Get started with basic access',
        type: 'free',
        scope: 'both',  // Both personal and team
        params: {
          monthlyMessageLimit: 1000,
        },
      },
      {
        id: 'basic',
        name: 'Basic',
        description: 'For individuals who need more',
        type: 'monthly',
        scope: 'personal',  // Personal only
        params: {
          priceUSD: 8,
          monthlyMessageLimit: 500,
          stripePriceId: '${STRIPE_BASIC_PRICE_ID}',
        },
      },
      {
        id: 'pro',
        name: 'Pro',
        description: 'Unlimited messages for power users',
        type: 'monthly',
        scope: 'both',  // Can be personal or team
        params: {
          priceUSD: 25,
          monthlyMessageLimit: -1,
          stripePriceId: '${STRIPE_PRO_PRICE_ID}',
        },
      },
      {
        id: 'team-business',
        name: 'Team Business',
        description: 'Shared message pool for your team',
        type: 'monthly',
        scope: 'team',  // Team only
        params: {
          priceUSD: 50,
          monthlyMessageLimit: 5000,
          stripePriceId: '${STRIPE_TEAM_BUSINESS_PRICE_ID}',
        },
      },
      {
        id: 'credits',
        name: 'Pay as you go',
        description: 'Buy credits when you need them',
        type: 'credits',
        scope: 'both',  // Can be purchased for personal or team
        params: {
          pricePerCredit: 0.01,
          messagesPerCredit: 1,
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
        key: 'role',
        label: 'Your Role',
        type: 'select',
        options: ['Developer', 'Designer', 'Product Manager', 'Other'],
      },
      {
        key: 'context',
        label: 'Additional Context',
        type: 'textarea',
        placeholder: 'Any context the AI should know about you...',
      },
    ],
  },

  mcp: {
    servers: [

      // Example: Stdio server - no authentication (local process)
      // {
      //   id: 'filesystem',
      //   name: 'File System',
      //   transport: 'stdio',
      //   command: 'npx',
      //   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      //   enabled: true,
      // },

      // Example: Streamable HTTP with admin API key (shared across all users)
      // {
      //   id: 'company-tools',
      //   name: 'Company Tools',
      //   transport: 'streamable-http',
      //   url: 'https://tools.company.com/mcp',
      //   enabled: true,
      //   authMode: 'admin',
      //   adminApiKeyEnvVar: 'COMPANY_TOOLS_API_KEY',
      // },

      // Example: Streamable HTTP with user API key (each user provides their own)
      // {
      //   id: 'openai-tools',
      //   name: 'OpenAI Tools',
      //   transport: 'streamable-http',
      //   url: 'https://mcp.openai.com',
      //   enabled: true,
      //   authMode: 'user-apikey',
      //   userInstructions: 'Enter your OpenAI API key from platform.openai.com',
      // },

      // Example: Streamable HTTP with user OAuth (each user authenticates via OAuth)
      // {
      //   id: 'github-tools',
      //   name: 'GitHub Tools',
      //   transport: 'streamable-http',
      //   url: 'https://github-mcp.example.com',
      //   enabled: true,
      //   authMode: 'user-oauth',
      //   oauth: {
      //     authorizationEndpoint: 'https://github.com/login/oauth/authorize',
      //     tokenEndpoint: 'https://github.com/login/oauth/access_token',
      //     clientId: '${GITHUB_MCP_CLIENT_ID}',
      //     clientSecretEnvVar: 'GITHUB_MCP_CLIENT_SECRET',
      //     scopes: ['repo', 'read:user'],
      //   },
      //   userInstructions: 'Connect your GitHub account to use repository tools',
      // },
    ],
    allowUserServers: true,
    // Tool confirmation settings - controls when users must approve tool execution
    // Options:
    //   mode: 'none' - No confirmation required (tools auto-execute)
    //   mode: 'all' - All tools require user confirmation
    //   mode: 'whitelist' - Listed tools skip confirmation, others require it
    //   mode: 'blacklist' - Listed tools require confirmation, others auto-execute
    // Example configurations:
    //   { mode: 'none' } - Trust all tools
    //   { mode: 'all' } - Maximum security, user approves each tool call
    //   { mode: 'blacklist', tools: ['filesystem:delete_file', 'github:create_issue'] }
    //   { mode: 'whitelist', tools: ['weather:get_forecast', 'calculator:compute'] }
    toolConfirmation: {
      mode: 'all',
    },
    toolTimeout: 30000,
    showToolCalls: true, // Set to false to hide tool execution cards in chat
  },

  sharing: {
    enabled: true, // Set to false to disable thread sharing
    scope: 'public', // 'public' = anyone with link, 'team' = authenticated team members only
    expirationOptions: ['1h', '24h', '7d', '30d', 'never'],
  },

  teams: {
    enabled: true, // Set to false to disable team workspaces (personal only)
  },

  projects: {
    enabled: true, // Set to false to disable project folders
    colors: [
      '#ef4444', // red
      '#f97316', // orange
      '#eab308', // yellow
      '#22c55e', // green
      '#14b8a6', // teal
      '#3b82f6', // blue
      '#8b5cf6', // purple
      '#ec4899', // pink
    ],
  },

  admin: {
    emails: [
      // Add email addresses of site administrators here
      // 'admin@example.com',
      "mferrante3@gmail.com",
    ],
  },

  promptTemplates: {
    enabled: true,
    builtIn: [
      {
        id: 'code-review',
        name: 'Code Review',
        prompt: 'Review this code for bugs, security issues, and improvements:\n\n{{code}}',
        variables: ['code'],
      },
      {
        id: 'explain',
        name: 'Explain Code',
        prompt: 'Explain what this code does:\n\n{{code}}',
        variables: ['code'],
      },
    ],
    allowUserTemplates: true,
  },

  documents: {
    enabled: true,
    storage: {
      provider: 'database',  // 'database' | 'filesystem' | 's3'
      // filesystem: { basePath: './uploads/documents' },
      // s3: { bucket: 'my-bucket', region: 'us-east-1' },
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

export default config;
