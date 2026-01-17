import type { AppConfig } from '@chaaskit/shared';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { createJiti } from 'jiti';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let config: AppConfig | null = null;
let configLoaded = false;
let programmaticConfig: AppConfig | null = null;

/**
 * Set config programmatically. This takes highest precedence.
 * Call this before loadConfigAsync() to use a custom config.
 */
export function setConfig(newConfig: AppConfig): void {
  programmaticConfig = newConfig;
  config = mergeWithDefaults(newConfig);
  configLoaded = true;
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Create jiti instance for loading TypeScript configs
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false, // Don't cache to pick up config changes
});

/**
 * Load config from a specific file path
 * Uses jiti to support TypeScript configs without requiring tsx/ts-node
 */
async function loadFromPath(configPath: string): Promise<AppConfig> {
  let configModule;

  // Determine the actual file path
  let actualPath = configPath;
  if (!configPath.endsWith('.ts') && !configPath.endsWith('.js')) {
    // Try .ts first, then .js
    if (await fileExists(configPath + '.ts')) {
      actualPath = configPath + '.ts';
    } else if (await fileExists(configPath + '.js')) {
      actualPath = configPath + '.js';
    }
  }

  // Use jiti for TypeScript files, native import for JavaScript
  if (actualPath.endsWith('.ts')) {
    configModule = await jiti.import(actualPath);
  } else {
    configModule = await import(pathToFileURL(actualPath).href);
  }

  const appConfig = configModule.config || configModule.default;
  return mergeWithDefaults(appConfig);
}

/**
 * Load configuration with multi-source resolution:
 * 1. Programmatic config (set via setConfig())
 * 2. Environment variable (CHAASKIT_CONFIG_PATH)
 * 3. Well-known paths relative to cwd:
 *    - ./config/app.config.ts
 *    - ./config/app.config.js
 * 4. Monorepo path (for development within the monorepo)
 * 5. Default config (built-in defaults)
 */
export async function loadConfigAsync(): Promise<AppConfig> {
  if (configLoaded && config) {
    return config;
  }

  // 1. Check programmatic config
  if (programmaticConfig) {
    config = mergeWithDefaults(programmaticConfig);
    configLoaded = true;
    console.log('[Config] Using programmatic config');
    logConfig(config);
    return config;
  }

  // 2. Check environment variable
  const envPath = process.env.CHAASKIT_CONFIG_PATH;
  if (envPath) {
    const resolvedEnvPath = path.isAbsolute(envPath)
      ? envPath
      : path.resolve(process.cwd(), envPath);

    if (await fileExists(resolvedEnvPath)) {
      try {
        config = await loadFromPath(resolvedEnvPath);
        configLoaded = true;
        console.log('[Config] Loaded from CHAASKIT_CONFIG_PATH:', resolvedEnvPath);
        logConfig(config);
        return config;
      } catch (error) {
        console.warn('[Config] Failed to load from CHAASKIT_CONFIG_PATH:', error);
      }
    }
  }

  // 3. Check well-known paths relative to cwd
  const cwd = process.cwd();
  const wellKnownPaths = [
    'config/app.config.ts',
    'config/app.config.js',
  ];

  for (const relativePath of wellKnownPaths) {
    const fullPath = path.join(cwd, relativePath);
    if (await fileExists(fullPath)) {
      try {
        config = await loadFromPath(fullPath);
        configLoaded = true;
        console.log('[Config] Loaded from', fullPath);
        logConfig(config);
        return config;
      } catch (error) {
        console.warn(`[Config] Failed to load from ${fullPath}:`, error);
      }
    }
  }

  // 4. Check monorepo path (for development)
  // Navigate from packages/core-server/src/config/ to monorepo root's config/
  const monorepoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const monorepoConfigPath = path.join(monorepoRoot, 'config', 'app.config');

  const monorepoTsPath = monorepoConfigPath + '.ts';
  const monorepoJsPath = monorepoConfigPath + '.js';

  if (await fileExists(monorepoTsPath)) {
    try {
      config = await loadFromPath(monorepoTsPath);
      configLoaded = true;
      console.log('[Config] Loaded from monorepo:', monorepoTsPath);
      logConfig(config);
      return config;
    } catch (error) {
      console.warn('[Config] Failed to load from monorepo:', error);
    }
  } else if (await fileExists(monorepoJsPath)) {
    try {
      config = await loadFromPath(monorepoJsPath);
      configLoaded = true;
      console.log('[Config] Loaded from monorepo:', monorepoJsPath);
      logConfig(config);
      return config;
    } catch (error) {
      console.warn('[Config] Failed to load from monorepo:', error);
    }
  }

  // 5. Fall back to defaults
  console.log('[Config] No config file found, using defaults');
  config = getDefaultConfig();
  configLoaded = true;
  logConfig(config);
  return config;
}

/**
 * Log the loaded config (redacting sensitive values)
 */
function logConfig(cfg: AppConfig): void {
  console.log('[Config] Loaded configuration:');
  console.log(JSON.stringify(cfg, null, 2));
}

/**
 * Synchronous version - returns defaults if async load hasn't completed
 */
export function loadConfig(): AppConfig {
  if (!config) {
    config = getDefaultConfig();
  }
  return config;
}

/**
 * Get the current config (loads defaults if not yet loaded)
 */
export function getConfig(): AppConfig {
  if (!config) {
    return loadConfig();
  }
  return config;
}

/**
 * Reset config state (useful for testing)
 */
export function resetConfig(): void {
  config = null;
  configLoaded = false;
  programmaticConfig = null;
}

function mergeWithDefaults(appConfig: AppConfig): AppConfig {
  const defaults = getDefaultConfig();
  return {
    ...defaults,
    ...appConfig,
    // Deep merge specific sections that might be partially defined
    mcp: appConfig.mcp || defaults.mcp,
  };
}

function getDefaultConfig(): AppConfig {
  return {
    app: {
      name: 'AI Chat',
      description: 'Your AI assistant',
      url: process.env.APP_URL || 'http://localhost:5173',
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
    },
    agent: {
      type: 'built-in',
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a helpful AI assistant.',
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
      enabled: false,
      scope: 'public',
      expirationOptions: ['1h', '24h', '7d', '30d', 'never'],
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
    queue: {
      enabled: false,
      providerConfig: { type: 'memory' },
      worker: {
        mode: 'in-process',
        concurrency: 5,
        pollInterval: 1000,
        shutdownTimeout: 30000,
      },
      scheduler: {
        enabled: false,
        pollInterval: 60000,
      },
    },
  };
}
