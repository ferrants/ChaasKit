import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const appPath = useAppPath();
  const { register } = useAuth();
  const config = useConfig();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();

  const inviteToken = searchParams.get('invite') || undefined;
  const referralCode = searchParams.get('ref') || undefined;
  const gating = config.auth.gating;
  const signupsRestricted = gating?.mode && gating.mode !== 'open' && !inviteToken;
  const waitlistEnabled = gating?.waitlistEnabled ?? false;
  const showWaitlist = !!signupsRestricted && waitlistEnabled;
  const showRestrictedMessage = !!signupsRestricted && !waitlistEnabled;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'submitted'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const { requiresVerification } = await register(email, password, name || undefined, {
        inviteToken,
        referralCode,
      });
      if (requiresVerification) {
        navigate('/verify-email');
      } else {
        navigate(appPath('/'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      await api.post('/api/auth/waitlist', { email, name: name || undefined });
      setWaitlistStatus('submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join waitlist');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {config.ui.logo && (
            <img
              src={typeof config.ui.logo === 'string' ? config.ui.logo : (theme === 'dark' ? config.ui.logo.dark : config.ui.logo.light)}
              alt={config.app.name}
              className="mx-auto mb-4 h-16 w-16 rounded-lg object-contain"
            />
          )}
          <h1 className="text-3xl font-bold text-text-primary">Create account</h1>
          <p className="mt-2 text-text-secondary">
            Get started with {config.app.name}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">
            {error}
          </div>
        )}

        {showRestrictedMessage ? (
          <div className="rounded-lg border border-border bg-background-secondary p-4 text-sm text-text-secondary">
            Signups are currently closed. Please check back later.
          </div>
        ) : showWaitlist ? (
          <div className="rounded-lg border border-border bg-background-secondary p-4">
            <p className="text-sm text-text-secondary">
              Signups are currently restricted. Join the waitlist to get an invite.
            </p>

            {waitlistStatus === 'submitted' ? (
              <div className="mt-4 rounded-lg bg-success/10 p-3 text-sm text-success">
                Thanks! You’re on the waitlist.
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="waitlist-name" className="block text-sm font-medium text-text-primary">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    id="waitlist-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-4 py-2 text-text-primary focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="waitlist-email" className="block text-sm font-medium text-text-primary">
                    Email
                  </label>
                  <input
                    type="email"
                    id="waitlist-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-4 py-2 text-text-primary focus:border-primary focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
                >
                  Join waitlist
                </button>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-text-primary"
            >
              Name (optional)
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-4 py-2 text-text-primary focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-primary"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-4 py-2 text-text-primary focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-primary"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-4 py-2 text-text-primary focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-text-muted">
              Must be at least 8 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        )}

        {!signupsRestricted && (
          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        )}

        <p className="mt-4 text-center text-xs text-text-muted">
          By creating an account, you agree to our{' '}
          <Link to={config.legal.termsOfServiceUrl} className="text-primary hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to={config.legal.privacyPolicyUrl} className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
