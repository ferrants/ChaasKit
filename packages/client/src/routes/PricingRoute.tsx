/**
 * Pricing Route - Pricing/plans page
 */
import { ChatProviders } from '../index';
import PricingPage from '../pages/PricingPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Pricing' }];
}

export function links() {
  return [{ rel: 'stylesheet', href: '/node_modules/@chaaskit/client/dist/lib/styles.css' }];
}

export default function PricingRoute() {
  return (
    <ChatProviders>
      <PricingPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
