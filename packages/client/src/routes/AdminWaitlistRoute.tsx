/**
 * Admin Waitlist Route - Waitlist management
 */
import { ChatProviders } from '../index';
import AdminWaitlistPage from '../pages/AdminWaitlistPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Admin - Waitlist' }];
}

export function links() {
  return [];
}

export default function AdminWaitlistRoute() {
  return (
    <ChatProviders>
      <AdminWaitlistPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
