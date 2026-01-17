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
import { ClientOnly } from './components/ClientOnly';
import { ChatLoadingSkeleton, SimpleLoadingSkeleton } from './components/LoadingSkeletons';

export { ClientOnly, ChatLoadingSkeleton, SimpleLoadingSkeleton };

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
    return [{ rel: 'stylesheet', href: '/node_modules/@chaaskit/client/dist/lib/styles.css' }];
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
