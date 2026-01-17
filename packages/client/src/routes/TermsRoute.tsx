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
  return [{ rel: 'stylesheet', href: '/node_modules/@chaaskit/client/dist/lib/styles.css' }];
}

export default function TermsRoute() {
  return (
    <ChatProviders>
      <TermsPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
