/**
 * Privacy Route - Privacy policy page
 */
import { ChatProviders } from '../index';
import PrivacyPage from '../pages/PrivacyPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Privacy Policy' }];
}

export function links() {
  return [];
}

export default function PrivacyRoute() {
  return (
    <ChatProviders>
      <PrivacyPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
