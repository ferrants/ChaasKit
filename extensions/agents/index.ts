/**
 * Custom Agents Extension
 *
 * Add custom agent implementations here to extend the built-in agent functionality.
 *
 * Example:
 * ```typescript
 * import { registry, BaseAgent } from '@chaaskit/server';
 *
 * class MyCustomAgent extends BaseAgent {
 *   name = 'my-custom-agent';
 *
 *   async *chat(messages, options) {
 *     // Custom implementation
 *     yield { type: 'text', content: 'Hello from custom agent!' };
 *   }
 * }
 *
 * registry.register('agent', 'my-custom-agent', MyCustomAgent);
 * ```
 */

// Import example agents
// Uncomment to enable:
// import './moderated-agent.js';

export {};
