/**
 * Accept Invite Route - Team invitation acceptance
 */
import { ChatProviders } from '../index';
import AcceptInvitePage from '../pages/AcceptInvitePage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Accept Invitation' }];
}

export function links() {
  return [];
}

export default function AcceptInviteRoute() {
  return (
    <ChatProviders>
      <AcceptInvitePage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
