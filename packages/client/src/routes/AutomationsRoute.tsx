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
  return [];
}

export default function AutomationsRoute() {
  return (
    <ChatProviders>
      <ScheduledPromptsPage />
    </ChatProviders>
  );
}

export { SimpleLoadingSkeleton as LoadingSkeleton };
