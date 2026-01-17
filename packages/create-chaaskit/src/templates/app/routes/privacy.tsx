import type { Route } from './+types/privacy';
import { config } from '../../config/app.config';

export function meta({}: Route.MetaArgs) {
  return [
    { title: `Privacy Policy - ${config.app.name}` },
    { name: 'description', content: `Privacy Policy for ${config.app.name}` },
  ];
}

export default function Privacy() {
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
            Privacy Policy
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
            <Section title="Information We Collect">
              <p>
                We collect information you provide directly to us, such as when
                you create an account, use our services, or contact us for
                support.
              </p>
              <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  Account information (name, email address)
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Chat conversations and messages
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Usage data and preferences
                </li>
              </ul>
            </Section>

            <Section title="How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  Provide, maintain, and improve our services
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Process your requests and respond to your inquiries
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Send you technical notices and support messages
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Detect, prevent, and address technical issues
                </li>
              </ul>
            </Section>

            <Section title="Data Security">
              <p>
                We implement appropriate security measures to protect your
                personal information. However, no method of transmission over the
                Internet or electronic storage is 100% secure.
              </p>
            </Section>

            <Section title="AI Processing">
              <p>
                Your conversations may be processed by AI models to provide
                responses. We do not use your conversations to train AI models
                without your explicit consent.
              </p>
            </Section>

            <Section title="Data Retention">
              <p>
                We retain your information for as long as your account is active
                or as needed to provide you services. You can request deletion of
                your data at any time.
              </p>
            </Section>

            <Section title="Third-Party Services">
              <p>
                We may use third-party services that collect, monitor, and
                analyze data. These services have their own privacy policies
                addressing how they use such information.
              </p>
            </Section>

            <Section title="Your Rights">
              <p>You have the right to:</p>
              <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  Access your personal data
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Correct inaccurate data
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Request deletion of your data
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Export your data
                </li>
              </ul>
            </Section>

            <Section title="Changes to This Policy">
              <p>
                We may update this privacy policy from time to time. We will
                notify you of any changes by posting the new policy on this page.
              </p>
            </Section>

            <Section title="Contact Us">
              <p>
                If you have any questions about this Privacy Policy, please
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
