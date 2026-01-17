import { useState, useEffect, type ReactNode } from 'react';

interface ClientOnlyProps {
  children: () => ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only on the client after hydration.
 * Use this for components that rely on browser APIs or client-side state.
 *
 * @example
 * ```tsx
 * <ClientOnly fallback={<LoadingSkeleton />}>
 *   {() => <ChatApp />}
 * </ClientOnly>
 * ```
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? <>{children()}</> : <>{fallback}</>;
}
