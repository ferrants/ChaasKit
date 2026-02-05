import { Form, redirect, useNavigation } from 'react-router';
import type { Route } from './+types/register';
import { config } from '../../config/app.config';

export async function loader({}: Route.LoaderArgs) {
  return { config };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const res = await fetch(`${apiUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    // Try to parse JSON, fallback to text for rate limit errors etc.
    let errorMessage = 'Registration failed';
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        const data = await res.json();
        // Handle both {error: "string"} and {error: {message: "string"}} formats
        errorMessage = typeof data.error === 'string'
          ? data.error
          : data.error?.message || data.message || 'Registration failed';
      } catch {
        errorMessage = await res.text() || 'Registration failed';
      }
    } else {
      errorMessage = await res.text() || 'Registration failed';
    }
    return { error: errorMessage };
  }

  const data = await res.json();

  // Handle email verification flow
  if (data.requiresVerification) {
    return redirect('/verify-email');
  }

  // Forward the session cookie and redirect to chat
  const setCookie = res.headers.get('set-cookie');
  return redirect('/chat', {
    headers: setCookie ? { 'Set-Cookie': setCookie } : {},
  });
}

export function meta({}: Route.MetaArgs) {
  return [{ title: `Create Account - ${config.app.name}` }];
}

export default function Register({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { config } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const hasGoogle = config.auth?.methods?.includes('google') ?? false;
  const hasGitHub = config.auth?.methods?.includes('github') ?? false;
  const hasEmailPassword = config.auth?.methods?.includes('email-password') ?? true;

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgb(var(--color-background))',
        padding: '1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '28rem' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          {config.ui?.logo && (
            <img
              src={
                typeof config.ui.logo === 'string'
                  ? config.ui.logo
                  : config.ui.logo.light
              }
              alt={config.app.name}
              style={{
                height: '4rem',
                width: '4rem',
                marginLeft: 'auto',
                marginRight: 'auto',
                marginBottom: '1rem',
                borderRadius: '0.5rem',
                objectFit: 'contain',
              }}
            />
          )}
          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              color: 'rgb(var(--color-text-primary))',
              margin: 0,
            }}
          >
            Create an account
          </h1>
          <p
            style={{
              marginTop: '0.5rem',
              color: 'rgb(var(--color-text-secondary))',
            }}
          >
            Get started with {config.app.name}
          </p>
        </div>

        {/* OAuth buttons */}
        {(hasGoogle || hasGitHub) && (
          <div
            style={{
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {hasGoogle && (
              <a
                href="/api/auth/oauth/google"
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgb(var(--color-border))',
                  backgroundColor: 'rgb(var(--color-background))',
                  padding: '0.5rem 1rem',
                  color: 'rgb(var(--color-text-primary))',
                  textDecoration: 'none',
                }}
              >
                Sign up with Google
              </a>
            )}
            {hasGitHub && (
              <a
                href="/api/auth/oauth/github"
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgb(var(--color-border))',
                  backgroundColor: 'rgb(var(--color-background))',
                  padding: '0.5rem 1rem',
                  color: 'rgb(var(--color-text-primary))',
                  textDecoration: 'none',
                }}
              >
                Sign up with GitHub
              </a>
            )}
          </div>
        )}

        {(hasGoogle || hasGitHub) && hasEmailPassword && (
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  borderTop: '1px solid rgb(var(--color-border))',
                }}
              />
            </div>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                fontSize: '0.875rem',
              }}
            >
              <span
                style={{
                  backgroundColor: 'rgb(var(--color-background))',
                  padding: '0 0.5rem',
                  color: 'rgb(var(--color-text-muted))',
                }}
              >
                Or continue with email
              </span>
            </div>
          </div>
        )}

        {hasEmailPassword && (
          <Form
            method="post"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div>
              <label
                htmlFor="name"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'rgb(var(--color-text-primary))',
                }}
              >
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                style={{
                  marginTop: '0.25rem',
                  width: '100%',
                  borderRadius: '0.5rem',
                  border: '1px solid rgb(var(--color-input-border))',
                  backgroundColor: 'rgb(var(--color-input-background))',
                  padding: '0.5rem 1rem',
                  color: 'rgb(var(--color-text-primary))',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'rgb(var(--color-text-primary))',
                }}
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                style={{
                  marginTop: '0.25rem',
                  width: '100%',
                  borderRadius: '0.5rem',
                  border: '1px solid rgb(var(--color-input-border))',
                  backgroundColor: 'rgb(var(--color-input-background))',
                  padding: '0.5rem 1rem',
                  color: 'rgb(var(--color-text-primary))',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'rgb(var(--color-text-primary))',
                }}
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                minLength={8}
                style={{
                  marginTop: '0.25rem',
                  width: '100%',
                  borderRadius: '0.5rem',
                  border: '1px solid rgb(var(--color-input-border))',
                  backgroundColor: 'rgb(var(--color-input-background))',
                  padding: '0.5rem 1rem',
                  color: 'rgb(var(--color-text-primary))',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {actionData?.error && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '0.5rem',
                  color: 'rgb(239, 68, 68)',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                }}
              >
                {actionData.error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                borderRadius: '0.5rem',
                backgroundColor: 'rgb(var(--color-primary))',
                padding: '0.5rem 1rem',
                fontWeight: 500,
                color: 'white',
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </Form>
        )}

        <p
          style={{
            marginTop: '1rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'rgb(var(--color-text-muted))',
          }}
        >
          By signing up, you agree to our{' '}
          <a
            href={config.legal?.termsOfServiceUrl || '/terms'}
            style={{
              color: 'rgb(var(--color-primary))',
              textDecoration: 'none',
            }}
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href={config.legal?.privacyPolicyUrl || '/privacy'}
            style={{
              color: 'rgb(var(--color-primary))',
              textDecoration: 'none',
            }}
          >
            Privacy Policy
          </a>
        </p>

        <p
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'rgb(var(--color-text-secondary))',
          }}
        >
          Already have an account?{' '}
          <a
            href="/login"
            style={{
              color: 'rgb(var(--color-primary))',
              textDecoration: 'none',
            }}
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
