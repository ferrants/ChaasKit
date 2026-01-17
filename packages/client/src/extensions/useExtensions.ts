import { useSyncExternalStore, useCallback } from 'react';
import { clientRegistry, type PageExtension, type ToolExtension, type ComponentOverride } from './registry';

/**
 * Hook to access extension pages with automatic updates
 */
export function useExtensionPages(): PageExtension[] {
  const getSnapshot = useCallback(() => clientRegistry.getPages(), []);
  const subscribe = useCallback((callback: () => void) => clientRegistry.subscribe(callback), []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook to access sidebar pages with automatic updates
 */
export function useSidebarPages(): PageExtension[] {
  const getSnapshot = useCallback(() => clientRegistry.getSidebarPages(), []);
  const subscribe = useCallback((callback: () => void) => clientRegistry.subscribe(callback), []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook to access extension tools with automatic updates
 */
export function useExtensionTools(): ToolExtension[] {
  const getSnapshot = useCallback(() => clientRegistry.getTools(), []);
  const subscribe = useCallback((callback: () => void) => clientRegistry.subscribe(callback), []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook to get a specific tool renderer
 */
export function useToolRenderer(toolName: string): ToolExtension | undefined {
  const getSnapshot = useCallback(() => clientRegistry.getTool(toolName), [toolName]);
  const subscribe = useCallback((callback: () => void) => clientRegistry.subscribe(callback), []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook to get a component override
 */
export function useComponentOverride(slot: string): ComponentOverride | undefined {
  const getSnapshot = useCallback(() => clientRegistry.getOverride(slot), [slot]);
  const subscribe = useCallback((callback: () => void) => clientRegistry.subscribe(callback), []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
