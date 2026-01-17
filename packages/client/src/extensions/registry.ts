import type { ComponentType } from 'react';

/**
 * Page extension configuration
 */
export interface PageExtension {
  /** Unique identifier for the page */
  id: string;
  /** URL path for the page (e.g., "/analytics") */
  path: string;
  /** Display label for navigation */
  label: string;
  /** Optional icon name from lucide-react */
  icon?: string;
  /** React component to render for this page */
  component: ComponentType;
  /** Whether to show in the sidebar navigation */
  showInSidebar?: boolean;
  /** Whether this page requires authentication */
  requiresAuth?: boolean;
  /** Whether this page requires admin access */
  requiresAdmin?: boolean;
}

/**
 * Tool result renderer extension
 */
export interface ToolExtension {
  /** Tool name to match */
  name: string;
  /** Description of the tool */
  description: string;
  /** Custom renderer for tool results */
  resultRenderer?: ComponentType<{ result: unknown }>;
}

/**
 * Component override extension
 */
export interface ComponentOverride {
  /** Component slot to override */
  slot: 'header' | 'footer' | 'sidebar-header' | 'sidebar-footer' | 'message-actions';
  /** Component to render in the slot */
  component: ComponentType<Record<string, unknown>>;
}

/**
 * Client-side extension registry for customizing the ChaasKit UI
 *
 * Note: getPages(), getSidebarPages(), and getTools() cache their results
 * to support React's useSyncExternalStore which requires stable references.
 */
class ClientExtensionRegistry {
  private pages: Map<string, PageExtension> = new Map();
  private tools: Map<string, ToolExtension> = new Map();
  private overrides: Map<string, ComponentOverride> = new Map();
  private listeners: Set<() => void> = new Set();

  // Cached arrays for useSyncExternalStore compatibility
  // These are only updated when the underlying data changes
  private cachedPages: PageExtension[] = [];
  private cachedSidebarPages: PageExtension[] = [];
  private cachedTools: ToolExtension[] = [];

  /**
   * Register a custom page
   */
  registerPage(page: PageExtension): void {
    this.pages.set(page.id, page);
    this.invalidateCaches();
    this.notifyListeners();
  }

  /**
   * Unregister a custom page
   */
  unregisterPage(id: string): boolean {
    const result = this.pages.delete(id);
    if (result) {
      this.invalidateCaches();
      this.notifyListeners();
    }
    return result;
  }

  /**
   * Get all registered pages
   * Returns a cached array for useSyncExternalStore compatibility
   */
  getPages(): PageExtension[] {
    return this.cachedPages;
  }

  /**
   * Get pages that should appear in the sidebar
   * Returns a cached array for useSyncExternalStore compatibility
   */
  getSidebarPages(): PageExtension[] {
    return this.cachedSidebarPages;
  }

  /**
   * Register a custom tool renderer
   */
  registerTool(tool: ToolExtension): void {
    this.tools.set(tool.name, tool);
    this.invalidateCaches();
    this.notifyListeners();
  }

  /**
   * Unregister a tool renderer
   */
  unregisterTool(name: string): boolean {
    const result = this.tools.delete(name);
    if (result) {
      this.invalidateCaches();
      this.notifyListeners();
    }
    return result;
  }

  /**
   * Get all registered tools
   * Returns a cached array for useSyncExternalStore compatibility
   */
  getTools(): ToolExtension[] {
    return this.cachedTools;
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): ToolExtension | undefined {
    return this.tools.get(name);
  }

  /**
   * Register a component override
   */
  registerOverride(override: ComponentOverride): void {
    this.overrides.set(override.slot, override);
    this.notifyListeners();
  }

  /**
   * Get a component override for a slot
   */
  getOverride(slot: string): ComponentOverride | undefined {
    return this.overrides.get(slot);
  }

  /**
   * Subscribe to registry changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private invalidateCaches(): void {
    this.cachedPages = Array.from(this.pages.values());
    this.cachedSidebarPages = this.cachedPages.filter(p => p.showInSidebar);
    this.cachedTools = Array.from(this.tools.values());
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Clear all registered extensions
   */
  clear(): void {
    this.pages.clear();
    this.tools.clear();
    this.overrides.clear();
    this.invalidateCaches();
    this.notifyListeners();
  }
}

// Singleton instance
export const clientRegistry = new ClientExtensionRegistry();

// Export for use in user extensions
export default clientRegistry;
