import { useConfig } from '../contexts/ConfigContext';

/**
 * Returns the configured basePath for the application.
 * Useful for building absolute URLs or for components that need
 * to know the base path for external navigation.
 */
export function useBasePath(): string {
  const config = useConfig();
  // Return basePath if configured and non-empty, otherwise default to /chat
  const configBasePath = config?.app?.basePath;
  return configBasePath && configBasePath.trim() !== '' ? configBasePath : '/chat';
}
