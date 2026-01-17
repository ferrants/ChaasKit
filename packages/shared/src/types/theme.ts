export interface ThemeColors {
  // Core palette
  primary: string;
  primaryHover: string;
  secondary: string;

  // Backgrounds
  background: string;
  backgroundSecondary: string;
  sidebar: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // UI elements
  border: string;
  inputBackground: string;
  inputBorder: string;

  // Messages
  userMessageBg: string;
  userMessageText: string;
  assistantMessageBg: string;
  assistantMessageText: string;

  // Status
  success: string;
  warning: string;
  error: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
}

export interface ThemeConfig {
  defaultTheme: string;
  allowUserThemeSwitch: boolean;
  themes: Record<string, Theme>;
  fonts: {
    sans: string;
    mono: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
}

export type ThemeName = string;
