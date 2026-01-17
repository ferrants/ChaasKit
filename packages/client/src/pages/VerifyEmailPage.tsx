import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppPath } from '../hooks/useAppPath';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const appPath = useAppPath();
  const { user, verifyEmail, resendVerification, logout } = useAuth();
  const config = useConfig();
  const { theme } = useTheme();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hasRequestedInitialCode, setHasRequestedInitialCode] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Request initial verification code for existing unverified users
  useEffect(() => {
    if (user && !user.emailVerified && !hasRequestedInitialCode) {
      setHasRequestedInitialCode(true);
      // Send initial code on page load
      handleResend(true);
    }
  }, [user, hasRequestedInitialCode]);

  // Redirect if user is verified or not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    } else if (user.emailVerified) {
      navigate(appPath('/'), { replace: true });
    }
  }, [user, navigate, appPath]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (code.length < 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);

    try {
      await verifyEmail(code);
      navigate(appPath('/'), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend(silent = false) {
    if (resendCooldown > 0) return;

    if (!silent) {
      setError('');
      setIsResending(true);
    }

    try {
      await resendVerification();
      setResendCooldown(60); // 60 second cooldown
      if (!silent) {
        setCode(''); // Clear the input for new code
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to resend code');
      }
    } finally {
      if (!silent) {
        setIsResending(false);
      }
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  // Handle input - only allow numeric characters
  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  }

  if (!user) {
    return null;
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
          <h1 className="text-3xl font-bold text-text-primary">Verify your email</h1>
          <p className="mt-2 text-text-secondary">
            We sent a verification code to
          </p>
          <p className="mt-1 font-medium text-text-primary">{user.email}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-text-primary text-center mb-2"
            >
              Enter 6-digit code
            </label>
            <input
              ref={inputRef}
              type="text"
              id="code"
              value={code}
              onChange={handleCodeChange}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              className="w-full rounded-lg border border-input-border bg-input-background px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] text-text-primary focus:border-primary focus:outline-none"
              style={{ letterSpacing: '0.5em' }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || code.length < 6}
            className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-text-secondary">
            Didn't receive the code?{' '}
            {resendCooldown > 0 ? (
              <span className="text-text-muted">
                Resend in {resendCooldown}s
              </span>
            ) : (
              <button
                onClick={() => handleResend()}
                disabled={isResending}
                className="text-primary hover:underline disabled:opacity-50"
              >
                {isResending ? 'Sending...' : 'Resend code'}
              </button>
            )}
          </p>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={handleLogout}
            className="text-sm text-text-muted hover:text-text-secondary"
          >
            Sign out and use a different email
          </button>
        </div>
      </div>
    </div>
  );
}
