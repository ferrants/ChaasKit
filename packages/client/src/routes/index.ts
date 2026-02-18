/**
 * Route modules for @chaaskit/client
 *
 * Each route exports:
 * - meta() - page metadata for React Router
 * - links() - stylesheet links
 * - default - wrapped component with ChatProviders
 * - LoadingSkeleton - SSR-safe loading component
 *
 * @example
 * ```tsx
 * // In your route file
 * import { lazy, Suspense } from 'react';
 * import { ClientOnly, SimpleLoadingSkeleton } from '@chaaskit/client';
 *
 * const ChatRoute = lazy(() => import('@chaaskit/client/routes/ChatRoute'));
 *
 * export { meta, links } from '@chaaskit/client/routes/ChatRoute';
 *
 * export default function Chat() {
 *   return (
 *     <ClientOnly fallback={<SimpleLoadingSkeleton />}>
 *       {() => (
 *         <Suspense fallback={<SimpleLoadingSkeleton />}>
 *           <ChatRoute />
 *         </Suspense>
 *       )}
 *     </ClientOnly>
 *   );
 * }
 * ```
 */

// Chat routes (with sidebar layout)
export { default as ChatRoute, meta as chatMeta, links as chatLinks, LoadingSkeleton as ChatLoadingSkeleton } from './ChatRoute';

// Settings/management routes
export { default as ApiKeysRoute, meta as apiKeysMeta, links as apiKeysLinks, LoadingSkeleton as ApiKeysLoadingSkeleton } from './ApiKeysRoute';
export { default as DocumentsRoute, meta as documentsMeta, links as documentsLinks, LoadingSkeleton as DocumentsLoadingSkeleton } from './DocumentsRoute';
export { default as AutomationsRoute, meta as automationsMeta, links as automationsLinks, LoadingSkeleton as AutomationsLoadingSkeleton } from './AutomationsRoute';
export { default as TeamSettingsRoute, meta as teamSettingsMeta, links as teamSettingsLinks, LoadingSkeleton as TeamSettingsLoadingSkeleton } from './TeamSettingsRoute';

// Admin routes
export { default as AdminDashboardRoute, meta as adminDashboardMeta, links as adminDashboardLinks, LoadingSkeleton as AdminDashboardLoadingSkeleton } from './AdminDashboardRoute';
export { default as AdminUsersRoute, meta as adminUsersMeta, links as adminUsersLinks, LoadingSkeleton as AdminUsersLoadingSkeleton } from './AdminUsersRoute';
export { default as AdminTeamsRoute, meta as adminTeamsMeta, links as adminTeamsLinks, LoadingSkeleton as AdminTeamsLoadingSkeleton } from './AdminTeamsRoute';
export { default as AdminTeamRoute, meta as adminTeamMeta, links as adminTeamLinks, LoadingSkeleton as AdminTeamLoadingSkeleton } from './AdminTeamRoute';
export { default as AdminWaitlistRoute, meta as adminWaitlistMeta, links as adminWaitlistLinks, LoadingSkeleton as AdminWaitlistLoadingSkeleton } from './AdminWaitlistRoute';
export { default as AdminPromoCodesRoute, meta as adminPromoCodesMeta, links as adminPromoCodesLinks, LoadingSkeleton as AdminPromoCodesLoadingSkeleton } from './AdminPromoCodesRoute';

// Auth-related routes
export { default as LoginRoute, meta as loginMeta, links as loginLinks, LoadingSkeleton as LoginLoadingSkeleton } from './LoginRoute';
export { default as RegisterRoute, meta as registerMeta, links as registerLinks, LoadingSkeleton as RegisterLoadingSkeleton } from './RegisterRoute';
export { default as VerifyEmailRoute, meta as verifyEmailMeta, links as verifyEmailLinks, LoadingSkeleton as VerifyEmailLoadingSkeleton } from './VerifyEmailRoute';
export { default as AcceptInviteRoute, meta as acceptInviteMeta, links as acceptInviteLinks, LoadingSkeleton as AcceptInviteLoadingSkeleton } from './AcceptInviteRoute';

// Public routes
export { default as PricingRoute, meta as pricingMeta, links as pricingLinks, LoadingSkeleton as PricingLoadingSkeleton } from './PricingRoute';
export { default as OAuthConsentRoute, meta as oauthConsentMeta, links as oauthConsentLinks, LoadingSkeleton as OAuthConsentLoadingSkeleton } from './OAuthConsentRoute';
export { default as PrivacyRoute, meta as privacyMeta, links as privacyLinks, LoadingSkeleton as PrivacyLoadingSkeleton } from './PrivacyRoute';
export { default as TermsRoute, meta as termsMeta, links as termsLinks, LoadingSkeleton as TermsLoadingSkeleton } from './TermsRoute';
