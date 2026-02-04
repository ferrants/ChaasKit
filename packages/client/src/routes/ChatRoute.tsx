/**
 * Chat Route - Main chat interface with sidebar
 * Wraps ChatPage with ChatProviders and MainLayout
 */
import { ChatProviders } from '../index';
import MainLayout from '../layouts/MainLayout';
import ChatPage from '../pages/ChatPage';
import { ChatLoadingSkeleton } from '../components/LoadingSkeletons';

export function meta() {
  return [{ title: 'Chat' }];
}

export function links() {
  // CSS is bundled via app's Tailwind preset - no separate stylesheet needed
  return [];
}

export default function ChatRoute() {
  return (
    <ChatProviders>
      <MainLayout>
        <ChatPage />
      </MainLayout>
    </ChatProviders>
  );
}

export { ChatLoadingSkeleton as LoadingSkeleton };
