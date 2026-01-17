/**
 * Admin Dashboard Route - Admin overview
 */
import { ChatProviders } from '../index';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Admin Dashboard' }];
}

export function links() {
  return [{ rel: 'stylesheet', href: '/node_modules/@chaaskit/client/dist/lib/styles.css' }];
}

export default function AdminDashboardRoute() {
  return (
    <ChatProviders>
      <AdminDashboardPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
