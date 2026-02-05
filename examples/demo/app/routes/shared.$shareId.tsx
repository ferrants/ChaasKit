import type { Route } from './+types/shared.$shareId';
import { loadSharedThread } from '@chaaskit/server/loaders';
import { config } from '../../config/app.config';

// Simple SSR-safe message list component
// This renders messages as plain text for SEO, markdown hydration happens client-side if needed
function SimpleMessageList({ messages }: { messages: Array<{ id: string; role: string; content: string }> }) {
  return (
    <div style={{ maxWidth: '48rem', marginLeft: 'auto', marginRight: 'auto', padding: '1rem' }}>
      {messages.map((message) => (
        <div
          key={message.id}
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor:
              message.role === 'user'
                ? 'rgb(var(--color-user-message-bg))'
                : 'rgb(var(--color-assistant-message-bg))',
            color:
              message.role === 'user'
                ? 'rgb(var(--color-user-message-text))'
                : 'rgb(var(--color-assistant-message-text))',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              opacity: 0.7,
            }}
          >
            {message.role === 'user' ? 'You' : 'Assistant'}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
        </div>
      ))}
    </div>
  );
}

export async function loader({ params }: Route.LoaderArgs) {
  try {
    const data = await loadSharedThread(params.shareId!);
    return { ...data, config, error: null };
  } catch (error: any) {
    return {
      thread: null,
      config,
      error: {
        message: error.message || 'Failed to load thread',
        status: error.status || 500,
      },
    };
  }
}

export function meta({ data }: Route.MetaArgs) {
  if (data?.error || !data?.thread) {
    return [{ title: 'Thread Not Found' }];
  }
  return [
    { title: `${data.thread.title} | ${data.config.app.name}` },
    {
      name: 'description',
      content: `A shared conversation with ${data.thread.messages.length} messages`,
    },
    { property: 'og:title', content: data.thread.title },
    {
      property: 'og:description',
      content: `A shared conversation with ${data.thread.messages.length} messages`,
    },
    { property: 'og:type', content: 'article' },
  ];
}

export default function SharedThread({ loaderData }: Route.ComponentProps) {
  const { thread, config, error } = loaderData;

  if (error || !thread) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '1rem',
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            color: 'rgb(var(--color-text-primary))',
          }}
        >
          {error?.status === 410
            ? 'Link Expired'
            : 'Conversation not available'}
        </h1>
        <p
          style={{
            color: 'rgb(var(--color-text-secondary))',
            marginBottom: '1.5rem',
          }}
        >
          {error?.status === 410
            ? 'This share link has expired.'
            : 'This shared conversation was not found or has been removed.'}
        </p>
        <a
          href="/"
          style={{
            backgroundColor: 'rgb(var(--color-primary))',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
          }}
        >
          Go to Home
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'rgb(var(--color-background))',
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid rgb(var(--color-border))',
          backgroundColor: 'rgb(var(--color-background-secondary))',
        }}
      >
        <div
          style={{
            maxWidth: '48rem',
            marginLeft: 'auto',
            marginRight: 'auto',
            padding: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: 'rgb(var(--color-text-primary))',
                  margin: 0,
                }}
              >
                {thread.title}
              </h1>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'rgb(var(--color-text-muted))',
                  margin: '0.25rem 0 0 0',
                }}
              >
                Shared conversation from {config.app.name}
              </p>
            </div>
            <a
              href="/"
              style={{
                backgroundColor: 'rgb(var(--color-primary))',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                textDecoration: 'none',
              }}
            >
              Try {config.app.name}
            </a>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main style={{ paddingBottom: '2rem' }}>
        <SimpleMessageList messages={thread.messages} />
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid rgb(var(--color-border))',
          backgroundColor: 'rgb(var(--color-background-secondary))',
          padding: '1rem',
        }}
      >
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'rgb(var(--color-text-muted))',
            margin: 0,
          }}
        >
          Powered by {config.app.name}
        </p>
      </footer>
    </div>
  );
}
