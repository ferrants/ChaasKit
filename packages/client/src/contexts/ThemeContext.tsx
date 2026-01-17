import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { useConfig } from './ConfigContext';

interface ThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
  availableThemes: string[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const config = useConfig();
  const [theme, setThemeState] = useState(() => {
    // Check localStorage first, then config default
    const stored = localStorage.getItem('theme');
    if (stored && config.theming.themes[stored]) {
      return stored;
    }
    return config.theming.defaultTheme;
  });

  const availableThemes = Object.keys(config.theming.themes);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    // Set cookie for SSR to read
    document.cookie = `theme=${theme};path=/;max-age=31536000;SameSite=Lax`;

    // Apply theme colors as CSS variables
    const themeConfig = config.theming.themes[theme];
    if (themeConfig) {
      const root = document.documentElement;
      const colors = themeConfig.colors;

      // Convert hex colors to RGB values
      Object.entries(colors).forEach(([key, value]) => {
        const cssKey = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        const rgb = hexToRgb(value);
        if (rgb) {
          root.style.setProperty(cssKey, `${rgb.r} ${rgb.g} ${rgb.b}`);
        }
      });
    }

    // Apply fonts
    document.documentElement.style.setProperty(
      '--font-sans',
      config.theming.fonts.sans
    );
    document.documentElement.style.setProperty(
      '--font-mono',
      config.theming.fonts.mono
    );

    // Apply border radius
    document.documentElement.style.setProperty(
      '--radius-sm',
      config.theming.borderRadius.sm
    );
    document.documentElement.style.setProperty(
      '--radius-md',
      config.theming.borderRadius.md
    );
    document.documentElement.style.setProperty(
      '--radius-lg',
      config.theming.borderRadius.lg
    );
    document.documentElement.style.setProperty(
      '--radius-full',
      config.theming.borderRadius.full
    );
  }, [theme, config.theming]);

  function setTheme(newTheme: string) {
    if (config.theming.themes[newTheme]) {
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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16),
      }
    : null;
}
