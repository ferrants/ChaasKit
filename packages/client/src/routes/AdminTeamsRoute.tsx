/**
 * Admin Teams Route - Team list management
 */
import { ChatProviders } from '../index';
import AdminTeamsPage from '../pages/AdminTeamsPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Admin - Teams' }];
}

export function links() {
  return [{ rel: 'stylesheet', href: '/node_modules/@chaaskit/client/dist/lib/styles.css' }];
}

export default function AdminTeamsRoute() {
  return (
    <ChatProviders>
      <AdminTeamsPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
