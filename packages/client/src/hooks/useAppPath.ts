import { useCallback } from 'react';
import { useConfig } from '../contexts/ConfigContext';

/**
 * Returns a memoized function to build paths with the configured basePath.
 * Use this for all internal navigation within the authenticated app.
 *
 * @example
 * const appPath = useAppPath();
 * navigate(appPath('/'));  // Goes to /chat (or whatever basePath is configured)
 * navigate(appPath('/thread/123'));  // Goes to /chat/thread/123
 */
export function useAppPath(): (path: string) => string {
  const config = useConfig();
  // Default to /chat if basePath is undefined, null, or empty string
  const configBasePath = config?.app?.basePath;
  const basePath = configBasePath && configBasePath.trim() !== '' ? configBasePath : '/chat';

  return useCallback(
    (path: string) => {
      // Remove leading slash from path if basePath already ends with one
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
      const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

      // Handle root path
      if (!normalizedPath || normalizedPath === '') {
        return normalizedBase;
      }

      return `${normalizedBase}/${normalizedPath}`;
    },
    [basePath]
  );
}
