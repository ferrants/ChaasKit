/**
 * API Keys Route - User API key management
 */
import { ChatProviders } from '../index';
import ApiKeysPage from '../pages/ApiKeysPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'API Keys' }];
}

export function links() {
  return [];
}

export default function ApiKeysRoute() {
  return (
    <ChatProviders>
      <ApiKeysPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
