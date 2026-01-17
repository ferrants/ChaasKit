/**
 * Automations Route - Scheduled prompts management
 */
import { ChatProviders } from '../index';
import ScheduledPromptsPage from '../pages/ScheduledPromptsPage';
import { SimpleLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Automations' }];
}

export function links() {
  return [{ rel: 'stylesheet', href: '/node_modules/@chaaskit/client/dist/lib/styles.css' }];
}

export default function AutomationsRoute() {
  return (
    <ChatProviders>
      <ScheduledPromptsPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
