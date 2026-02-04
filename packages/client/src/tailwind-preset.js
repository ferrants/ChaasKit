import plugin from 'tailwindcss/plugin.js';

/**
 * Converts a hex color to RGB values string (e.g., "#ff0000" -> "255 0 0")
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0 0';
  return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
}

/**
 * Default ChaasKit themes.
 * Apps can override these by passing their own themes to createChaaskitPreset().
 */
const defaultThemes = {
  light: {
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
  dark: {
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
};

/**
 * Default fonts and border radius.
 */
const defaultStyles = {
  fonts: {
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', Menlo, monospace",
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  },
};

/**
 * Creates a ChaasKit Tailwind preset with custom themes.
 *
 * @param {Object} options
 * @param {Object} options.themes - Theme definitions (light, dark, etc.)
 * @param {string} options.defaultTheme - Which theme to use for :root (default: 'light')
 * @param {Object} options.fonts - Font family overrides
 * @param {Object} options.borderRadius - Border radius overrides
 *
 * @example
 * // tailwind.config.ts
 * import { createChaaskitPreset } from '@chaaskit/client/tailwind-preset';
 *
 * export default {
 *   presets: [
 *     createChaaskitPreset({
 *       themes: {
 *         light: { primary: '#dc2626', ... },
 *         dark: { primary: '#ef4444', ... },
 *       },
 *       defaultTheme: 'dark',
 *     }),
 *   ],
 * };
 */
export function createChaaskitPreset(options = {}) {
  const themes = options.themes || defaultThemes;
  const defaultTheme = options.defaultTheme || 'light';
  const fonts = { ...defaultStyles.fonts, ...options.fonts };
  const borderRadius = { ...defaultStyles.borderRadius, ...options.borderRadius };

  /**
   * Generate CSS-in-JS for all themes
   */
  function generateThemeStyles() {
    const styles = {};

    for (const [themeName, colors] of Object.entries(themes)) {
      const cssVars = {};

      // Add color variables
      for (const [key, value] of Object.entries(colors)) {
        const cssKey = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        cssVars[cssKey] = hexToRgb(value);
      }

      // Add font and radius variables
      cssVars['--font-sans'] = fonts.sans;
      cssVars['--font-mono'] = fonts.mono;
      cssVars['--radius-sm'] = borderRadius.sm;
      cssVars['--radius-md'] = borderRadius.md;
      cssVars['--radius-lg'] = borderRadius.lg;
      cssVars['--radius-full'] = borderRadius.full;

      // Use :root for default theme, data-theme selector for all
      if (themeName === defaultTheme) {
        styles[':root'] = cssVars;
      }
      styles[`html[data-theme="${themeName}"]`] = cssVars;
    }

    return styles;
  }

  return {
    content: [
      './node_modules/@chaaskit/client/src/**/*.{js,ts,jsx,tsx}',
      './node_modules/@chaaskit/client/dist/**/*.js',
    ],
    theme: {
      extend: {
        colors: {
          primary: 'rgb(var(--color-primary) / <alpha-value>)',
          'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
          secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
          background: 'rgb(var(--color-background) / <alpha-value>)',
          'background-secondary': 'rgb(var(--color-background-secondary) / <alpha-value>)',
          sidebar: 'rgb(var(--color-sidebar) / <alpha-value>)',
          'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
          'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
          'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
          border: 'rgb(var(--color-border) / <alpha-value>)',
          'input-background': 'rgb(var(--color-input-background) / <alpha-value>)',
          'input-border': 'rgb(var(--color-input-border) / <alpha-value>)',
          'user-message-bg': 'rgb(var(--color-user-message-bg) / <alpha-value>)',
          'user-message-text': 'rgb(var(--color-user-message-text) / <alpha-value>)',
          'assistant-message-bg': 'rgb(var(--color-assistant-message-bg) / <alpha-value>)',
          'assistant-message-text': 'rgb(var(--color-assistant-message-text) / <alpha-value>)',
          success: 'rgb(var(--color-success) / <alpha-value>)',
          warning: 'rgb(var(--color-warning) / <alpha-value>)',
          error: 'rgb(var(--color-error) / <alpha-value>)',
        },
        fontFamily: {
          sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
          mono: ['var(--font-mono)', 'Menlo', 'monospace'],
        },
        borderRadius: {
          sm: 'var(--radius-sm)',
          md: 'var(--radius-md)',
          lg: 'var(--radius-lg)',
          full: 'var(--radius-full)',
        },
      },
    },
    plugins: [
      // Inject theme CSS variables
      plugin(function ({ addBase }) {
        addBase(generateThemeStyles());
      }),
      // Custom variant for touch devices
      plugin(function ({ addVariant }) {
        addVariant('touch-device', '@media (pointer: coarse)');
      }),
      // Base styles and utilities
      plugin(function ({ addBase, addUtilities }) {
        // Base element styles
        addBase({
          'html': {
            fontFamily: 'var(--font-sans)',
          },
          'pre': {
            fontFamily: 'var(--font-mono)',
            fontSize: '0.875rem',
          },
          'code': {
            fontFamily: 'var(--font-mono)',
          },
          'kbd': {
            fontFamily: 'var(--font-sans)',
          },
          // Scrollbar styling
          '::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgb(var(--color-border))',
            borderRadius: '9999px',
          },
          '::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgb(var(--color-text-muted))',
          },
          // Markdown content styling
          '.markdown-content': {
            lineHeight: '1.625',
          },
          '.markdown-content h1': {
            fontSize: '1.5rem',
            fontWeight: '700',
            marginTop: '1.5rem',
            marginBottom: '1rem',
          },
          '.markdown-content h2': {
            fontSize: '1.25rem',
            fontWeight: '700',
            marginTop: '1.25rem',
            marginBottom: '0.75rem',
          },
          '.markdown-content h3': {
            fontSize: '1.125rem',
            fontWeight: '600',
            marginTop: '1rem',
            marginBottom: '0.5rem',
          },
          '.markdown-content p': {
            marginBottom: '1rem',
          },
          '.markdown-content ul, .markdown-content ol': {
            marginBottom: '1rem',
            paddingLeft: '1.5rem',
          },
          '.markdown-content ul': {
            listStyleType: 'disc',
          },
          '.markdown-content ol': {
            listStyleType: 'decimal',
          },
          '.markdown-content li': {
            marginBottom: '0.25rem',
          },
          '.markdown-content blockquote': {
            borderLeftWidth: '4px',
            borderLeftColor: 'rgb(var(--color-border))',
            paddingLeft: '1rem',
            fontStyle: 'italic',
            marginTop: '1rem',
            marginBottom: '1rem',
          },
          '.markdown-content a': {
            color: 'rgb(var(--color-primary))',
          },
          '.markdown-content a:hover': {
            textDecoration: 'underline',
          },
          '.markdown-content table': {
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '1rem',
            marginBottom: '1rem',
          },
          '.markdown-content th, .markdown-content td': {
            borderWidth: '1px',
            borderColor: 'rgb(var(--color-border))',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
            textAlign: 'left',
          },
          '.markdown-content th': {
            backgroundColor: 'rgb(var(--color-background-secondary))',
            fontWeight: '600',
          },
          '.markdown-content hr': {
            marginTop: '1.5rem',
            marginBottom: '1.5rem',
            borderColor: 'rgb(var(--color-border))',
          },
          // Search highlight
          'mark': {
            backgroundColor: 'rgb(var(--color-warning) / 0.3)',
            color: 'rgb(var(--color-text-primary))',
            borderRadius: '0.125rem',
            paddingLeft: '0.125rem',
            paddingRight: '0.125rem',
          },
          // Animations
          '@keyframes fade-in': {
            from: { opacity: '0' },
            to: { opacity: '1' },
          },
          '@keyframes slide-up': {
            from: { transform: 'translateY(10px)', opacity: '0' },
            to: { transform: 'translateY(0)', opacity: '1' },
          },
          '@keyframes typing': {
            '0%, 60%, 100%': { opacity: '1' },
            '30%': { opacity: '0.3' },
          },
          '.animate-fade-in': {
            animation: 'fade-in 0.2s ease-out',
          },
          '.animate-slide-up': {
            animation: 'slide-up 0.2s ease-out',
          },
          '.typing-indicator span': {
            animation: 'typing 1s infinite',
          },
          '.typing-indicator span:nth-child(2)': {
            animationDelay: '0.2s',
          },
          '.typing-indicator span:nth-child(3)': {
            animationDelay: '0.4s',
          },
        });

        // Custom utilities
        addUtilities({
          // Mobile viewport height fix - dvh with fallback
          '.h-screen-safe': {
            height: '100vh',
            '@supports (height: 100dvh)': {
              height: '100dvh',
            },
          },
          // Line clamp
          '.line-clamp-2': {
            display: '-webkit-box',
            '-webkit-line-clamp': '2',
            '-webkit-box-orient': 'vertical',
            overflow: 'hidden',
          },
        });
      }),
    ],
  };
}

// Default export for simple usage
const chaaskitPreset = createChaaskitPreset();
export default chaaskitPreset;
