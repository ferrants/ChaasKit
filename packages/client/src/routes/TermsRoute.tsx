/**
 * Terms Route - Terms of service page
 */
import { ChatProviders } from '../index';
import TermsPage from '../pages/TermsPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Terms of Service' }];
}

export function links() {
  return [];
}

export default function TermsRoute() {
  return (
    <ChatProviders>
      <TermsPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
