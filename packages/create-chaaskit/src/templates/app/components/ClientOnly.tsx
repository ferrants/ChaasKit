/**
 * Re-export ClientOnly from @chaaskit/client/ssr-utils for convenience.
 * This allows routes to import from local components if needed.
 * Uses ssr-utils to avoid pulling in browser-only dependencies during SSR.
 */
export { ClientOnly } from '@chaaskit/client/ssr-utils';
