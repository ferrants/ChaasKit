/**
 * OAuth Consent Route - OAuth authorization consent
 */
import { ChatProviders } from '../index';
import OAuthConsentPage from '../pages/OAuthConsentPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'OAuth Consent' }];
}

export function links() {
  return [{ rel: 'stylesheet', href: '/node_modules/@chaaskit/client/dist/lib/styles.css' }];
}

export default function OAuthConsentRoute() {
  return (
    <ChatProviders>
      <OAuthConsentPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
