import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

interface ThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
  availableThemes: string[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Default available themes.
 * Apps can override this via the ThemeProvider's availableThemes prop.
 */
const DEFAULT_THEMES = ['light', 'dark'];
const DEFAULT_THEME = 'dark';

interface ThemeProviderProps {
  children: ReactNode;
  /** Available theme names. Defaults to ['light', 'dark'] */
  availableThemes?: string[];
  /** Default theme if none stored. Defaults to 'dark' */
  defaultTheme?: string;
}

/**
 * ThemeProvider manages the current theme via data-theme attribute.
 *
 * Theme CSS variables should be defined in your Tailwind config using
 * html[data-theme="themeName"] selectors. This provider only manages:
 * - The data-theme attribute on <html>
 * - localStorage persistence
 * - Cookie sync for SSR
 */
export function ThemeProvider({
  children,
  availableThemes = DEFAULT_THEMES,
  defaultTheme = DEFAULT_THEME,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState(() => {
    // Check localStorage first, then use default
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored && availableThemes.includes(stored)) {
        return stored;
      }
    }
    return defaultTheme;
  });

  useEffect(() => {
    // Set data-theme attribute - CSS selectors handle the actual styling
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    // Set cookie for SSR to read
    document.cookie = `theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
  }, [theme]);

  function setTheme(newTheme: string) {
    if (availableThemes.includes(newTheme)) {
      setThemeState(newTheme);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
