import { createContext, useContext, type ReactNode } from 'react';

/**
 * Server-safe theme provider that accepts a pre-determined theme.
 * Used for SSR routes where theme is determined on the server.
 * Does not access localStorage or document.
 */

interface ServerThemeContextValue {
  theme: string;
  availableThemes: string[];
  // setTheme is a no-op on server, actual theme switching happens client-side
  setTheme: (theme: string) => void;
}

const ServerThemeContext = createContext<ServerThemeContextValue | null>(null);

export interface ServerThemeProviderProps {
  children: ReactNode;
  theme: string;
  availableThemes: string[];
}

export function ServerThemeProvider({
  children,
  theme,
  availableThemes,
}: ServerThemeProviderProps) {
  // Server-side setTheme is a no-op - theme changes require client-side hydration
  const setTheme = () => {
    // No-op on server
  };

  return (
    <ServerThemeContext.Provider value={{ theme, availableThemes, setTheme }}>
      {children}
    </ServerThemeContext.Provider>
  );
}

export function useServerTheme() {
  const context = useContext(ServerThemeContext);
  if (!context) {
    throw new Error('useServerTheme must be used within a ServerThemeProvider');
  }
  return context;
}
