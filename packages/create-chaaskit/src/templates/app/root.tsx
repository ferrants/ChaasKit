import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from 'react-router';
import type { Route } from './+types/root';
import { config } from '../config/app.config';
import { generateThemeCSS, baseStyles } from '@chaaskit/client/ssr';

function getThemeFromCookie(cookieHeader: string | null, defaultTheme: string): string {
  if (!cookieHeader) return defaultTheme;
  const match = cookieHeader.match(/(?:^|;\s*)theme=([^;]*)/);
  return match ? match[1] : defaultTheme;
}

export async function loader({ request }: Route.LoaderArgs) {
  const cookieHeader = request.headers.get('Cookie');
  const theme = getThemeFromCookie(cookieHeader, config.theming.defaultTheme);
  return { config, theme };
}

export default function Root() {
  const { config, theme } = useLoaderData<typeof loader>();
  const themeCSS = generateThemeCSS(config, theme);

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
        <style dangerouslySetInnerHTML={{ __html: themeCSS + baseStyles }} />
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

function ThemeScript({ serverTheme }: { serverTheme: string }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var storedTheme = localStorage.getItem('theme');
            if (storedTheme && storedTheme !== '${serverTheme}') {
              // localStorage has a different theme than server rendered - update DOM and sync cookie
              document.documentElement.dataset.theme = storedTheme;
              document.cookie = 'theme=' + storedTheme + ';path=/;max-age=31536000;SameSite=Lax';
            } else if (!storedTheme) {
              // No localStorage theme - sync server theme to localStorage
              localStorage.setItem('theme', '${serverTheme}');
            }
            // If storedTheme === serverTheme, everything is already in sync
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
