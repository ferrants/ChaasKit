import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import type { Thread } from '@chaaskit/shared';
import { useConfig } from '../contexts/ConfigContext';
import { api, ApiError } from '../utils/api';
import MessageList from '../components/MessageList';

export default function SharedThreadPage() {
  const { shareId } = useParams();
  const config = useConfig();
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadThread() {
      try {
        const response = await api.get<{ thread: Thread }>(
          `/api/share/view/${shareId}`
        );
        setThread(response.thread);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setError('This shared conversation was not found.');
          } else if (err.status === 410) {
            setError('This shared link has expired.');
          } else if (err.status === 401) {
            setError('Please sign in to view this shared conversation.');
          } else if (err.status === 403) {
            setError('You don\'t have access to this conversation. It may be shared only with team members.');
          } else {
            setError(err.message);
          }
        } else {
          setError('Failed to load conversation');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (shareId) {
      loadThread();
    }
  }, [shareId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-text-primary">
            Conversation not available
          </h1>
          <p className="mb-6 text-text-secondary">{error}</p>
          <Link
            to="/"
            className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-hover"
          >
            Go to {config.app.name}
          </Link>
        </div>
      </div>
    );
  }

  if (!thread) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background-secondary">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                {thread.title}
              </h1>
              <p className="text-sm text-text-muted">
                Shared conversation from {config.app.name}
              </p>
            </div>
            <Link
              to="/"
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover"
            >
              Try {config.app.name}
            </Link>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="pb-8">
        <MessageList messages={thread.messages} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background-secondary py-4">
        <p className="text-center text-sm text-text-muted">
          Powered by {config.app.name}
        </p>
      </footer>
    </div>
  );
}
