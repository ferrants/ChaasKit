import type { Route } from './+types/_index';
import { config } from '../../config/app.config';

export function meta({}: Route.MetaArgs) {
  return [
    { title: config.app.name },
    { name: 'description', content: config.app.description },
  ];
}

/**
 * Landing page route.
 *
 * Customize this page for your marketing content, or redirect to /chat
 * if you don't need a separate landing page.
 *
 * For a marketing page example, see the chaaskit-app repository.
 */
export default function Index() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: 'rgb(var(--color-text-primary))',
        }}
      >
        Welcome to {config.app.name}
      </h1>
      <p
        style={{
          fontSize: '1.25rem',
          color: 'rgb(var(--color-text-secondary))',
          marginBottom: '2rem',
          maxWidth: '600px',
        }}
      >
        {config.app.description}
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <a
          href="/chat"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'rgb(var(--color-primary))',
            color: 'white',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Get Started
        </a>
        <a
          href="/login"
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid rgb(var(--color-border))',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            color: 'rgb(var(--color-text-primary))',
          }}
        >
          Sign In
        </a>
      </div>
    </div>
  );
}
