/**
 * Server-safe markdown renderer for SSR.
 * Uses react-markdown which is SSR-compatible.
 * Does not use browser APIs or client-side state.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SSRMarkdownRendererProps {
  content: string;
}

export function SSRMarkdownRenderer({ content }: SSRMarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match && !String(children).includes('\n');

          if (isInline) {
            return (
              <code
                style={{
                  backgroundColor: 'rgb(var(--color-background-secondary))',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.875rem',
                }}
                {...props}
              >
                {children}
              </code>
            );
          }

          // For code blocks, render a simple pre/code without syntax highlighting
          // Syntax highlighting will be added on client-side hydration
          const language = match?.[1] || 'text';
          const codeString = String(children).replace(/\n$/, '');

          return (
            <div
              style={{
                margin: '1rem 0',
                borderRadius: '0.5rem',
                border: '1px solid rgb(var(--color-border))',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgb(var(--color-background-secondary))',
                  padding: '0.5rem 1rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'rgb(var(--color-text-muted))',
                    textTransform: 'uppercase',
                  }}
                >
                  {language}
                </span>
              </div>

              {/* Code */}
              <pre
                style={{
                  margin: 0,
                  padding: '1rem',
                  overflow: 'auto',
                  backgroundColor: 'rgb(var(--color-background-secondary))',
                }}
              >
                <code
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre',
                  }}
                >
                  {codeString}
                </code>
              </pre>
            </div>
          );
        },
        pre({ children }) {
          // Avoid double wrapping from ReactMarkdown
          return <>{children}</>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'rgb(var(--color-primary))' }}
            >
              {children}
            </a>
          );
        },
        table({ children }) {
          return (
            <div style={{ margin: '1rem 0', overflowX: 'auto' }}>
              <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th
              style={{
                border: '1px solid rgb(var(--color-border))',
                padding: '0.5rem 1rem',
                textAlign: 'left',
                backgroundColor: 'rgb(var(--color-background-secondary))',
                fontWeight: 600,
              }}
            >
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td
              style={{
                border: '1px solid rgb(var(--color-border))',
                padding: '0.5rem 1rem',
                textAlign: 'left',
              }}
            >
              {children}
            </td>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default SSRMarkdownRenderer;
