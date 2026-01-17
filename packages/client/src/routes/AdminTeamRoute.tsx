/**
 * Admin Team Route - Single team management
 */
import { ChatProviders } from '../index';
import AdminTeamPage from '../pages/AdminTeamPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Admin - Team Details' }];
}

export function links() {
  return [{ rel: 'stylesheet', href: '/node_modules/@chaaskit/client/dist/lib/styles.css' }];
}

export default function AdminTeamRoute() {
  return (
    <ChatProviders>
      <AdminTeamPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
