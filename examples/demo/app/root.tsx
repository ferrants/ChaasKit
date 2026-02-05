import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from 'react-router';
import type { Route } from './+types/root';
import { ConfigScript } from '@chaaskit/client/ssr-utils';

// Tailwind CSS - includes theme variables built from tailwind.config.ts
import './styles/app.css';

// Default theme must match defaultTheme in tailwind.config.ts
const DEFAULT_THEME = 'light';
const VALID_THEMES = ['light', 'dark'];

function getThemeFromCookie(cookieHeader: string | null): string {
  if (!cookieHeader) return DEFAULT_THEME;
  const match = cookieHeader.match(/(?:^|;\s*)theme=([^;]*)/);
  const theme = match ? match[1] : DEFAULT_THEME;
  return VALID_THEMES.includes(theme) ? theme : DEFAULT_THEME;
}

export async function loader({ request }: Route.LoaderArgs) {
  // Import config on server only (uses process.env)
  const { config } = await import('../config/app.config');

  const cookieHeader = request.headers.get('Cookie');
  const theme = getThemeFromCookie(cookieHeader);
  return { theme, config };
}

export default function Root() {
  const { theme, config } = useLoaderData<typeof loader>();

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <ConfigScript config={config} />
        <ThemeScript serverTheme={theme} />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Blocking script that syncs theme from localStorage before first paint.
 * Since CSS has selectors for all themes (html[data-theme="..."]), changing
 * the data-theme attribute instantly applies the correct theme.
 */
function ThemeScript({ serverTheme }: { serverTheme: string }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var validThemes = ${JSON.stringify(VALID_THEMES)};
            var storedTheme = localStorage.getItem('theme');
            if (storedTheme && storedTheme !== '${serverTheme}' && validThemes.includes(storedTheme)) {
              document.documentElement.dataset.theme = storedTheme;
              document.cookie = 'theme=' + storedTheme + ';path=/;max-age=31536000;SameSite=Lax';
            } else if (!storedTheme) {
              localStorage.setItem('theme', '${serverTheme}');
            }
          })();
        `,
      }}
    />
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error</title>
      </head>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <h1>Something went wrong</h1>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
      </body>
    </html>
  );
}
