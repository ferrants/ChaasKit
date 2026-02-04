import type { Config } from 'tailwindcss';
import { createChaaskitPreset } from '@chaaskit/client/tailwind-preset';

/**
 * Tailwind configuration with ChaasKit preset.
 *
 * Customize your app's theme by modifying the preset options below.
 * The preset provides:
 * - Theme CSS variables (colors, fonts, border radius)
 * - Semantic color utilities (bg-primary, text-text-primary, etc.)
 * - Base styles (scrollbars, markdown, animations)
 * - Custom utilities (h-screen-safe, line-clamp-2)
 */
export default {
  presets: [
    createChaaskitPreset({
      // Customize your themes here
      themes: {
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
      },
      // Which theme to use by default
      defaultTheme: 'light',
      // Customize fonts
      fonts: {
        sans: "'Inter', system-ui, sans-serif",
        mono: "'JetBrains Mono', Menlo, monospace",
      },
    }),
  ],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './node_modules/@chaaskit/client/src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@chaaskit/client/dist/**/*.js',
  ],
} satisfies Config;
