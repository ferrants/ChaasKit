import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { PublicAppConfig } from '@chaaskit/shared';

// Declare global window property for SSR-injected config
declare global {
  interface Window {
    __CHAASKIT_CONFIG__?: PublicAppConfig;
  }
}

/**
 * Get config injected via ConfigScript in the HTML head.
 * This allows the config to be available immediately on page load,
 * avoiding flash of default values.
 */
function getInjectedConfig(): PublicAppConfig | undefined {
  if (typeof window !== 'undefined' && window.__CHAASKIT_CONFIG__) {
    return window.__CHAASKIT_CONFIG__;
  }
  return undefined;
}

// Default config - used as fallback while loading
const defaultConfig: PublicAppConfig = {
  app: {
    name: 'AI Chat',
    description: 'Your AI assistant',
    url: 'http://localhost:5173',
    basePath: '/chat',
  },
  ui: {
    welcomeTitle: 'Welcome to AI Chat',
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
    gating: {
      mode: 'open',
      waitlistEnabled: false,
    },
  },
  payments: {
    enabled: false,
    provider: 'stripe',
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
    enabled: false,
    scope: 'public',
    expirationOptions: ['1h', '24h', '7d', '30d', 'never'],
  },
  promptTemplates: {
    enabled: true,
    allowUserTemplates: true,
  },
  teams: {
    enabled: true,
  },
  documents: {
    enabled: false,
    maxFileSizeMB: 10,
    hybridThreshold: 1000,
    acceptedTypes: ['text/plain', 'text/markdown', 'application/json'],
  },
  projects: {
    enabled: false,
    colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'],
  },
  api: {
    enabled: false,
  },
  credits: {
    enabled: false,
    expiryEnabled: false,
    promoEnabled: false,
  },
  metering: {
    enabled: false,
    recordPromptCompletion: true,
  },
};

interface ConfigContextValue {
  config: PublicAppConfig;
  configLoaded: boolean;
}

const ConfigContext = createContext<ConfigContextValue>({
  config: defaultConfig,
  configLoaded: false,
});

interface ConfigProviderProps {
  children: ReactNode;
  /**
   * Initial config to use immediately, avoiding a flash of default values.
   * If provided, the config will not be fetched from /api/config.
   * Useful when config is available from SSR loaders.
   */
  initialConfig?: PublicAppConfig;
}

export function ConfigProvider({ children, initialConfig }: ConfigProviderProps) {
  // Priority: 1. initialConfig prop, 2. injected window config, 3. defaults + fetch
  const injectedConfig = getInjectedConfig();
  const preloadedConfig = initialConfig || injectedConfig;

  const [config, setConfig] = useState<PublicAppConfig>(
    preloadedConfig ? { ...defaultConfig, ...preloadedConfig } : defaultConfig
  );
  const [configLoaded, setConfigLoaded] = useState(!!preloadedConfig);

  useEffect(() => {
    // Skip fetching if we have preloaded config
    if (preloadedConfig) return;

    async function loadConfig() {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const serverConfig = await response.json();
          // Merge with defaults to ensure all fields exist
          setConfig({
            ...defaultConfig,
            ...serverConfig,
          });
        }
      } catch (error) {
        console.warn('[Config] Failed to load config from server:', error);
      } finally {
        setConfigLoaded(true);
      }
    }
    loadConfig();
  }, [preloadedConfig]);

  return (
    <ConfigContext.Provider value={{ config, configLoaded }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext).config;
}

export function useConfigLoaded() {
  return useContext(ConfigContext).configLoaded;
}
