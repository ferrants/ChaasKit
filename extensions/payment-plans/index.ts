/**
 * Custom Payment Plans Extension
 *
 * Add custom payment plan implementations here to extend the built-in plans.
 *
 * Example:
 * ```typescript
 * import { registry, BasePricingPlan } from '@chaaskit/server';
 *
 * class EnterprisePlan extends BasePricingPlan {
 *   id = 'enterprise';
 *   name = 'Enterprise';
 *   type = 'custom';
 *
 *   async checkLimits(userId: string) {
 *     // Custom limit checking logic
 *     return true;
 *   }
 *
 *   async incrementUsage(userId: string) {
 *     // Custom usage tracking
 *   }
 * }
 *
 * registry.register('payment-plan', 'enterprise', EnterprisePlan);
 * ```
 */

// Import example payment plans
// Uncomment to enable:
// import './enterprise-plan.js';

export {};
