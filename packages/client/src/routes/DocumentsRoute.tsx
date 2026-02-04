/**
 * Documents Route - Document management
 */
import { ChatProviders } from '../index';
import DocumentsPage from '../pages/DocumentsPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Documents' }];
}

export function links() {
  return [];
}

export default function DocumentsRoute() {
  return (
    <ChatProviders>
      <DocumentsPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
