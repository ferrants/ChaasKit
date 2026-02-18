/**
 * Login Route - Sign in page
 */
import { ChatProviders } from '../index';
import LoginPage from '../pages/LoginPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Sign In' }];
}

export function links() {
  return [];
}

export default function LoginRoute() {
  return (
    <ChatProviders>
      <LoginPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
