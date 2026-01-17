/**
 * Custom Auth Providers Extension
 *
 * Add custom authentication providers here to extend the built-in methods.
 *
 * Example:
 * ```typescript
 * import { registry, BaseAuthProvider } from '@chaaskit/server';
 *
 * class SAMLAuthProvider extends BaseAuthProvider {
 *   name = 'saml';
 *   type = 'oauth';
 *
 *   async authenticate(credentials) {
 *     // SAML authentication logic
 *     return { userId: '...' };
 *   }
 * }
 *
 * registry.register('auth-provider', 'saml', SAMLAuthProvider);
 * ```
 */

export {};
