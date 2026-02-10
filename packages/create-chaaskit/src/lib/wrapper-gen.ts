import type { ManagedRoute } from './types.js';

/**
 * Generate the thin wrapper file content for a managed route.
 */
export function generateWrapper(r: ManagedRoute): string {
  const skeleton = r.skeleton ? `\n  skeleton: '${r.skeleton}',` : '';
  return [
    `import { createRoute } from '@chaaskit/client/ssr-utils';`,
    ``,
    `const route = createRoute({`,
    `  title: '${r.title}',`,
    `  load: () => import('${r.importPath}'),${skeleton}`,
    `});`,
    ``,
    `export const meta = route.meta;`,
    `export const links = route.links;`,
    `export default route.default;`,
    ``,
  ].join('\n');
}

/**
 * Detect if a file's content is a thin wrapper (managed by the registry).
 */
export function isThinWrapper(content: string): boolean {
  return (
    content.includes("from '@chaaskit/client/ssr-utils'") &&
    content.includes('createRoute(')
  );
}
