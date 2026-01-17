/**
 * Server-safe message list component for SSR.
 * This is a simplified, read-only version of MessageList that doesn't use:
 * - Browser APIs (localStorage, window, navigator)
 * - React hooks that require client-side state (useState, useEffect)
 * - Context providers that require browser APIs (ThemeContext, etc.)
 *
 * For interactive features, hydrate with the full MessageList component.
 */

import type { Message } from '@chaaskit/shared';
import { SSRMarkdownRenderer } from './content/SSRMarkdownRenderer';

interface SSRMessageListProps {
  messages: Message[];
  appName?: string;
}

function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function SSRMessageItem({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex gap-3 flex-row-reverse">
        {/* Avatar */}
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary"
          style={{ backgroundColor: 'rgb(var(--color-primary))' }}
        >
          <span className="text-white">
            <UserIcon />
          </span>
        </div>

        {/* Message Content */}
        <div
          className="flex max-w-[85%] flex-col items-end"
          style={{ maxWidth: '85%' }}
        >
          <div
            className="rounded-lg px-3 py-2 bg-user-message-bg text-user-message-text"
            style={{
              backgroundColor: 'rgb(var(--color-user-message-bg))',
              color: 'rgb(var(--color-user-message-text))',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
            }}
          >
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', margin: 0 }}>
              {message.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-secondary"
        style={{ backgroundColor: 'rgb(var(--color-secondary))' }}
      >
        <span className="text-white">
          <BotIcon />
        </span>
      </div>

      {/* Message Content */}
      <div className="flex max-w-[85%] flex-col items-start" style={{ maxWidth: '85%' }}>
        <div
          className="rounded-lg px-3 py-2 bg-assistant-message-bg text-assistant-message-text"
          style={{
            backgroundColor: 'rgb(var(--color-assistant-message-bg))',
            color: 'rgb(var(--color-assistant-message-text))',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.75rem',
          }}
        >
          <div className="markdown-content" style={{ fontSize: '0.875rem' }}>
            <SSRMarkdownRenderer content={message.content} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SSRMessageList({ messages }: SSRMessageListProps) {
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-6"
      style={{
        maxWidth: '48rem',
        marginLeft: 'auto',
        marginRight: 'auto',
        padding: '1.5rem 1rem',
      }}
    >
      <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((message) => (
          <SSRMessageItem key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}

export default SSRMessageList;
