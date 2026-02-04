/**
 * Team Settings Route - Team management
 */
import { ChatProviders } from '../index';
import TeamSettingsPage from '../pages/TeamSettingsPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Team Settings' }];
}

export function links() {
  return [];
}

export default function TeamSettingsRoute() {
  return (
    <ChatProviders>
      <TeamSettingsPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
