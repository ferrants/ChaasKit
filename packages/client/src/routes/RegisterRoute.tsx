/**
 * Register Route - Sign up page
 */
import { ChatProviders } from '../index';
import RegisterPage from '../pages/RegisterPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Create Account' }];
}

export function links() {
  return [];
}

export default function RegisterRoute() {
  return (
    <ChatProviders>
      <RegisterPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
