import { createContext, useContext, type ReactNode } from 'react';
import type { AppConfig } from '@chaaskit/shared';

/**
 * Server-safe config provider that accepts pre-loaded config data.
 * Used for SSR routes where config is loaded in the Remix loader.
 * Does not make any API calls or use browser APIs.
 */

interface ServerConfigContextValue {
  config: Partial<AppConfig>;
  configLoaded: boolean;
}

const ServerConfigContext = createContext<ServerConfigContextValue | null>(null);

export interface ServerConfigProviderProps {
  children: ReactNode;
  config: Partial<AppConfig>;
}

export function ServerConfigProvider({ children, config }: ServerConfigProviderProps) {
  return (
    <ServerConfigContext.Provider value={{ config, configLoaded: true }}>
      {children}
    </ServerConfigContext.Provider>
  );
}

export function useServerConfig(): Partial<AppConfig> {
  const context = useContext(ServerConfigContext);
  if (!context) {
    throw new Error('useServerConfig must be used within a ServerConfigProvider');
  }
  return context.config;
}

export function useServerConfigLoaded(): boolean {
  const context = useContext(ServerConfigContext);
  return context?.configLoaded ?? false;
}
