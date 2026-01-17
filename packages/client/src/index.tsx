// Import styles for CSS extraction during build
import './styles/index.css';

// ClientOnly and Loading Skeletons for SSR-safe rendering
export { ClientOnly } from './components/ClientOnly';
export { ChatLoadingSkeleton, SimpleLoadingSkeleton } from './components/LoadingSkeletons';

// Context providers
export { AuthProvider, useAuth } from './contexts/AuthContext';
export { ThemeProvider, useTheme } from './contexts/ThemeContext';
export { ConfigProvider, useConfig, useConfigLoaded } from './contexts/ConfigContext';
export { TeamProvider, useTeam } from './contexts/TeamContext';
export { ProjectProvider, useProject } from './contexts/ProjectContext';

// SSR-safe context providers
export {
  ServerConfigProvider,
  useServerConfig,
  useServerConfigLoaded,
} from './contexts/ServerConfigProvider';
export {
  ServerThemeProvider,
  useServerTheme,
} from './contexts/ServerThemeProvider';

// Stores
export { useChatStore } from './stores/chatStore';

// Hooks
export { useBasePath } from './hooks/useBasePath';
export { useAppPath } from './hooks/useAppPath';

// Extension registry
export { clientRegistry } from './extensions/registry';

// Layout components for implementing projects
export { default as MainLayout } from './layouts/MainLayout';
export { default as Sidebar } from './components/Sidebar';

// SSR-safe components for server rendering
export { SSRMessageList } from './components/SSRMessageList';
export { SSRMarkdownRenderer } from './components/content/SSRMarkdownRenderer';

// Re-export styles path for consumers
export const styles = '@chaaskit/client/src/styles/index.css';

// ============================================
// Page Components (for React Router v7 routes)
// ============================================
export { default as ChatPage } from './pages/ChatPage';
export { default as LoginPage } from './pages/LoginPage';
export { default as RegisterPage } from './pages/RegisterPage';
export { default as VerifyEmailPage } from './pages/VerifyEmailPage';
export { default as SharedThreadPage } from './pages/SharedThreadPage';
export { default as PricingPage } from './pages/PricingPage';
export { default as PrivacyPage } from './pages/PrivacyPage';
export { default as TermsPage } from './pages/TermsPage';
export { default as ApiKeysPage } from './pages/ApiKeysPage';
export { default as DocumentsPage } from './pages/DocumentsPage';
export { default as ScheduledPromptsPage } from './pages/ScheduledPromptsPage';
export { default as TeamSettingsPage } from './pages/TeamSettingsPage';
export { default as AcceptInvitePage } from './pages/AcceptInvitePage';
export { default as OAuthConsentPage } from './pages/OAuthConsentPage';
export { default as AdminDashboardPage } from './pages/AdminDashboardPage';
export { default as AdminUsersPage } from './pages/AdminUsersPage';
export { default as AdminTeamsPage } from './pages/AdminTeamsPage';
export { default as AdminTeamPage } from './pages/AdminTeamPage';

// ============================================
// ChatProviders - Wraps the chat app with all required providers
// Use in React Router routes that render the chat interface
// ============================================
import React from 'react';
import { AuthProvider as Auth } from './contexts/AuthContext';
import { ThemeProvider as Theme } from './contexts/ThemeContext';
import { ConfigProvider as Config } from './contexts/ConfigContext';
import { TeamProvider as Team } from './contexts/TeamContext';
import { ProjectProvider as Project } from './contexts/ProjectContext';

export interface ChatProvidersProps {
  children: React.ReactNode;
}

/**
 * Wraps children with all context providers needed for the chat application.
 * Use this in React Router routes that render chat-related pages.
 *
 * @example
 * ```tsx
 * // app/routes/chat.tsx
 * import { ChatProviders, ChatPage } from '@chaaskit/client';
 *
 * export default function Chat() {
 *   return (
 *     <ChatProviders>
 *       <ChatPage />
 *     </ChatProviders>
 *   );
 * }
 * ```
 */
export function ChatProviders({ children }: ChatProvidersProps) {
  return (
    <Config>
      <Theme>
        <Auth>
          <Team>
            <Project>
              {children}
            </Project>
          </Team>
        </Auth>
      </Theme>
    </Config>
  );
}
