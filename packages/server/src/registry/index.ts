type RegistryCategory =
  | 'agent'
  | 'payment-plan'
  | 'auth-provider'
  | 'content-renderer'
  | 'mcp-resource';

class Registry {
  private providers = new Map<string, Map<string, unknown>>();

  register<T>(category: RegistryCategory, name: string, implementation: T): void {
    if (!this.providers.has(category)) {
      this.providers.set(category, new Map());
    }
    this.providers.get(category)!.set(name, implementation);
    console.log(`[Registry] Registered ${category}:${name}`);
  }

  get<T>(category: RegistryCategory, name: string): T | undefined {
    return this.providers.get(category)?.get(name) as T | undefined;
  }

  getAll<T>(category: RegistryCategory): Map<string, T> {
    return (this.providers.get(category) as Map<string, T>) || new Map();
  }

  has(category: RegistryCategory, name: string): boolean {
    return this.providers.get(category)?.has(name) || false;
  }

  unregister(category: RegistryCategory, name: string): boolean {
    return this.providers.get(category)?.delete(name) || false;
  }
}

// Singleton instance
export const registry = new Registry();

// Base classes for extensions
export abstract class BaseAgent {
  abstract name: string;

  abstract chat(
    messages: Array<{ role: string; content: string }>,
    options?: Record<string, unknown>
  ): AsyncIterable<{ type: string; content?: string }>;
}

export abstract class BasePricingPlan {
  abstract id: string;
  abstract name: string;
  abstract type: string;

  abstract checkLimits(userId: string): Promise<boolean>;
  abstract incrementUsage(userId: string): Promise<void>;
}

export abstract class BaseAuthProvider {
  abstract name: string;
  abstract type: string;

  abstract authenticate(credentials: unknown): Promise<{ userId: string }>;
}

/**
 * Base class for MCP resources that can be exposed via the MCP server.
 *
 * Extensions can register custom resources by extending this class and
 * registering with: registry.register('mcp-resource', 'resource-name', new MyResource())
 */
export abstract class BaseMCPResource {
  /** URI for the resource (e.g., "myapp://users/profile") */
  abstract uri: string;

  /** Human-readable name for the resource */
  abstract name: string;

  /** Optional description */
  abstract description?: string;

  /** MIME type of the resource content */
  abstract mimeType?: string;

  /**
   * Read the resource content.
   * @param context - Context including the requesting user's ID
   * @returns Resource content as text or base64-encoded blob
   */
  abstract read(context: { userId?: string }): Promise<{ text?: string; blob?: string }>;
}
