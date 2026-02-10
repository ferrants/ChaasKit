/**
 * Mirrors the ManagedRoute type from @chaaskit/client/route-registry.
 * Duplicated here to avoid a compile-time dependency on @chaaskit/client.
 */
export interface ManagedRoute {
  file: string;
  title: string;
  importPath: string;
  skeleton?: 'chat';
  route: {
    path: string;
    section: 'public' | 'authenticated';
  };
}
