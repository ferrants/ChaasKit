/**
 * SSR-safe utilities for @chaaskit/client
 *
 * This entry point ONLY exports components that are safe to import during SSR.
 * Use this in route files instead of importing from the main entry point
 * to avoid pulling in browser-only dependencies like react-markdown.
 *
 * @example
 * ```tsx
 * // In your route file
 * import { createRoute, SimpleLoadingSkeleton } from '@chaaskit/client/ssr-utils';
 *
 * export const { meta, links, default: Component } = createRoute({
 *   title: 'Verify Email',
 *   load: () => import('@chaaskit/client/routes/VerifyEmailRoute'),
 * });
 * export default Component;
 * ```
 */

import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import type { AppConfig } from '@chaaskit/shared';
import { ClientOnly } from './components/ClientOnly';
import { ChatLoadingSkeleton, SimpleLoadingSkeleton } from './components/LoadingSkeletons';

export { ClientOnly, ChatLoadingSkeleton, SimpleLoadingSkeleton };

/**
 * Props for ConfigScript component.
 */
interface ConfigScriptProps {
  /**
   * The app config to inject into the page.
   * This should come from the SSR loader.
   */
  config: AppConfig;
}

/**
 * Injects the app config into the page as a script tag.
 * Place this in the <head> of your root layout to make the config
 * available immediately on page load, avoiding flash of default values.
 *
 * @example
 * ```tsx
 * // app/root.tsx
 * import { ConfigScript } from '@chaaskit/client/ssr-utils';
 * import { config } from '../config/app.config';
 *
 * export default function Root() {
 *   return (
 *     <html>
 *       <head>
 *         <ConfigScript config={config} />
 *       </head>
 *       <body>...</body>
 *     </html>
 *   );
 * }
 * ```
 */
export function ConfigScript({ config }: ConfigScriptProps) {
  // Only include the UI-related config to avoid exposing sensitive data.
  //
  // SYNC NOTE: Keep in sync with buildClientConfig() in:
  //   packages/server/src/api/config.ts
  // Both must expose the same client-safe fields.
  const safeConfig = {
    app: config.app,
    ui: config.ui,
    theming: config.theming,
    auth: {
      methods: config.auth?.methods,
      allowUnauthenticated: config.auth?.allowUnauthenticated,
      magicLink: config.auth?.magicLink,
      emailVerification: config.auth?.emailVerification,
      gating: config.auth?.gating,
    },
    payments: {
      enabled: config.payments?.enabled,
      provider: config.payments?.provider,
    },
    legal: config.legal,
    userSettings: config.userSettings,
    sharing: config.sharing,
    teams: config.teams,
    projects: config.projects,
    documents: config.documents ? {
      enabled: config.documents.enabled,
      maxFileSizeMB: config.documents.maxFileSizeMB,
      hybridThreshold: config.documents.hybridThreshold,
      acceptedTypes: config.documents.acceptedTypes,
    } : undefined,
    api: {
      enabled: config.api?.enabled,
    },
    email: config.email ? {
      enabled: config.email.enabled,
    } : undefined,
    slack: config.slack ? {
      enabled: config.slack.enabled,
    } : undefined,
    mcp: config.mcp ? {
      servers: config.mcp.servers?.map(server => ({
        id: server.id,
        name: server.name,
        transport: server.transport,
        enabled: server.enabled,
        authMode: server.authMode,
        userInstructions: server.userInstructions,
      })),
      allowUserServers: config.mcp.allowUserServers,
      toolConfirmation: config.mcp.toolConfirmation,
      toolTimeout: config.mcp.toolTimeout,
      showToolCalls: config.mcp.showToolCalls,
    } : undefined,
    promptTemplates: config.promptTemplates ? {
      enabled: config.promptTemplates.enabled,
      allowUserTemplates: config.promptTemplates.allowUserTemplates,
    } : undefined,
    scheduledPrompts: config.scheduledPrompts ? {
      enabled: config.scheduledPrompts.enabled,
      featureName: config.scheduledPrompts.featureName,
      allowUserPrompts: config.scheduledPrompts.allowUserPrompts,
      allowTeamPrompts: config.scheduledPrompts.allowTeamPrompts,
      defaultTimezone: config.scheduledPrompts.defaultTimezone,
      defaultMaxUserPrompts: config.scheduledPrompts.defaultMaxUserPrompts,
      defaultMaxTeamPrompts: config.scheduledPrompts.defaultMaxTeamPrompts,
    } : undefined,
    credits: config.credits ? {
      enabled: config.credits.enabled,
      expiryEnabled: config.credits.expiryEnabled,
      promoEnabled: config.credits.promoEnabled,
    } : undefined,
    metering: config.metering ? {
      enabled: config.metering.enabled,
      recordPromptCompletion: config.metering.recordPromptCompletion,
    } : undefined,
  };

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__CHAASKIT_CONFIG__=${JSON.stringify(safeConfig)};`,
      }}
    />
  );
}

/**
 * Route configuration options
 */
export interface RouteConfig {
  /** Page title for meta tag */
  title: string;
  /** Dynamic import function for the route component */
  load: () => Promise<{ default: ComponentType<any> }>;
  /** Loading skeleton to show during SSR and lazy load (defaults to SimpleLoadingSkeleton) */
  skeleton?: 'simple' | 'chat';
}

/**
 * Creates a route module with meta, links, and default component.
 * This reduces route files to just a few lines.
 *
 * @example
 * ```tsx
 * import { createRoute } from '@chaaskit/client/ssr-utils';
 *
 * export const { meta, links, default: VerifyEmail } = createRoute({
 *   title: 'Verify Email',
 *   load: () => import('@chaaskit/client/routes/VerifyEmailRoute'),
 * });
 * export default VerifyEmail;
 * ```
 */
export function createRoute(config: RouteConfig) {
  const { title, load, skeleton = 'simple' } = config;
  const LazyComponent = lazy(load);
  const Skeleton = skeleton === 'chat' ? ChatLoadingSkeleton : SimpleLoadingSkeleton;

  function meta() {
    return [{ title }];
  }

  function links() {
    // CSS is bundled via app's Tailwind preset - no separate stylesheet needed
    return [];
  }

  function RouteComponent() {
    return (
      <ClientOnly fallback={<Skeleton />}>
        {() => (
          <Suspense fallback={<Skeleton />}>
            <LazyComponent />
          </Suspense>
        )}
      </ClientOnly>
    );
  }

  return {
    meta,
    links,
    default: RouteComponent,
  };
}
