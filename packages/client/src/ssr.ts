/**
 * SSR-safe exports for server-side rendering.
 *
 * This module exports components and utilities that can be used on the server
 * without browser APIs like window, document, or localStorage.
 */

import type { AppConfig } from '@chaaskit/shared';

// SSR-safe context providers
export {
  ServerConfigProvider,
  useServerConfig,
  useServerConfigLoaded,
  type ServerConfigProviderProps,
} from './contexts/ServerConfigProvider';

export {
  ServerThemeProvider,
  useServerTheme,
  type ServerThemeProviderProps,
} from './contexts/ServerThemeProvider';

// NOTE: SSRMessageList and SSRMarkdownRenderer are NOT exported here because
// they depend on react-markdown which has browser-only dependencies.
// Use them only in client-side code wrapped in <ClientOnly>.

// ============================================
// Theme utilities for SSR
// ============================================

/**
 * Converts a hex color to RGB values string (e.g., "#ff0000" -> "255 0 0")
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '';
  return `${parseInt(result[1]!, 16)} ${parseInt(result[2]!, 16)} ${parseInt(result[3]!, 16)}`;
}

/**
 * Generates CSS variables for a theme.
 * Use this in your React Router root.tsx to inject theme styles.
 *
 * @example
 * ```tsx
 * // app/root.tsx
 * import { generateThemeCSS } from '@chaaskit/client/ssr';
 *
 * export default function Root() {
 *   const themeCSS = generateThemeCSS(config, 'dark');
 *   return (
 *     <html>
 *       <head>
 *         <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
 *       </head>
 *       ...
 *     </html>
 *   );
 * }
 * ```
 */
export function generateThemeCSS(config: AppConfig, theme: string): string {
  const themeConfig = config.theming.themes[theme];
  if (!themeConfig) return '';

  const cssVars = Object.entries(themeConfig.colors)
    .map(([key, value]) => {
      const cssKey = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      return `${cssKey}: ${hexToRgb(value)};`;
    })
    .join('\n    ');

  return `
    :root {
      ${cssVars}
      --font-sans: ${config.theming.fonts.sans};
      --font-mono: ${config.theming.fonts.mono};
      --radius-sm: ${config.theming.borderRadius.sm};
      --radius-md: ${config.theming.borderRadius.md};
      --radius-lg: ${config.theming.borderRadius.lg};
      --radius-full: ${config.theming.borderRadius.full};
    }
  `;
}

/**
 * Returns an object of CSS variable name -> value pairs for a theme.
 * Useful if you need programmatic access to theme values.
 */
export function getThemeVariables(config: AppConfig, theme: string): Record<string, string> {
  const themeConfig = config.theming.themes[theme];
  if (!themeConfig) return {};

  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(themeConfig.colors)) {
    const cssKey = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    vars[cssKey] = hexToRgb(value);
  }

  vars['--font-sans'] = config.theming.fonts.sans;
  vars['--font-mono'] = config.theming.fonts.mono;
  vars['--radius-sm'] = config.theming.borderRadius.sm;
  vars['--radius-md'] = config.theming.borderRadius.md;
  vars['--radius-lg'] = config.theming.borderRadius.lg;
  vars['--radius-full'] = config.theming.borderRadius.full;

  return vars;
}

/**
 * Base CSS styles for SSR pages.
 * Include this in your HTML template for consistent styling.
 */
export const baseStyles = `
  html { font-family: var(--font-sans); }
  body {
    margin: 0;
    background-color: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
  }
`;
