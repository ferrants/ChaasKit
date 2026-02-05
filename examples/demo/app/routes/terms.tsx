import type { Route } from './+types/terms';
import { config } from '../../config/app.config';

export function meta({}: Route.MetaArgs) {
  return [
    { title: `Terms of Service - ${config.app.name}` },
    { name: 'description', content: `Terms of Service for ${config.app.name}` },
  ];
}

export default function Terms() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'rgb(var(--color-background))',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ maxWidth: '48rem', marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <a
            href="/"
            style={{
              fontSize: '0.875rem',
              color: 'rgb(var(--color-primary))',
              textDecoration: 'none',
            }}
          >
            &larr; Back to {config.app.name}
          </a>
        </div>

        <article>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: 'rgb(var(--color-text-primary))',
              marginBottom: '1.5rem',
            }}
          >
            Terms of Service
          </h1>

          <p
            style={{
              color: 'rgb(var(--color-text-muted))',
              marginBottom: '2rem',
              fontSize: '0.875rem',
            }}
          >
            Last updated:{' '}
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>

          <div
            style={{
              color: 'rgb(var(--color-text-secondary))',
              lineHeight: 1.7,
            }}
          >
            <Section title="Agreement to Terms">
              <p>
                By accessing or using {config.app.name}, you agree to be bound by
                these Terms of Service. If you disagree with any part of the
                terms, you may not access the service.
              </p>
            </Section>

            <Section title="Use of Service">
              <p>
                You agree to use {config.app.name} only for lawful purposes and
                in accordance with these Terms. You agree not to:
              </p>
              <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  Use the service for any illegal purpose
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Attempt to gain unauthorized access to the service
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Interfere with or disrupt the service
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Use the service to send spam or unsolicited messages
                </li>
              </ul>
            </Section>

            <Section title="User Accounts">
              <p>
                When you create an account, you must provide accurate and
                complete information. You are responsible for maintaining the
                security of your account and password.
              </p>
            </Section>

            <Section title="AI-Generated Content">
              <p>
                {config.app.name} uses AI to generate responses. While we strive
                for accuracy, AI-generated content may contain errors or
                inaccuracies. You should verify important information
                independently.
              </p>
            </Section>

            <Section title="Intellectual Property">
              <p>
                The service and its original content, features, and
                functionality are owned by us and are protected by international
                copyright, trademark, and other intellectual property laws.
              </p>
            </Section>

            <Section title="Limitation of Liability">
              <p>
                In no event shall we be liable for any indirect, incidental,
                special, consequential, or punitive damages arising out of or
                relating to your use of the service.
              </p>
            </Section>

            <Section title="Changes to Terms">
              <p>
                We reserve the right to modify these terms at any time. We will
                notify users of any material changes by posting the new Terms of
                Service on this page.
              </p>
            </Section>

            <Section title="Contact Us">
              <p>
                If you have any questions about these Terms of Service, please
                contact us.
              </p>
            </Section>
          </div>
        </article>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <h2
        style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          marginTop: '2rem',
          marginBottom: '1rem',
          color: 'rgb(var(--color-text-primary))',
        }}
      >
        {title}
      </h2>
      {children}
    </>
  );
}
