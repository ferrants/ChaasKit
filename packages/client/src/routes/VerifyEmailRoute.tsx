/**
 * Verify Email Route - Email verification page
 */
import { ChatProviders } from '../index';
import VerifyEmailPage from '../pages/VerifyEmailPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Verify Email' }];
}

export function links() {
  return [{ rel: 'stylesheet', href: '/node_modules/@chaaskit/client/dist/lib/styles.css' }];
}

export default function VerifyEmailRoute() {
  return (
    <ChatProviders>
      <VerifyEmailPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
