/**
 * Admin Users Route - User management
 */
import { ChatProviders } from '../index';
import AdminUsersPage from '../pages/AdminUsersPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Admin - Users' }];
}

export function links() {
  return [];
}

export default function AdminUsersRoute() {
  return (
    <ChatProviders>
      <AdminUsersPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
