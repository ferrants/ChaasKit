import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router';
import { Shield, Check, X, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppPath } from '../hooks/useAppPath';

interface ClientInfo {
  clientId: string;
  clientName: string;
  clientUri?: string;
}

export default function OAuthConsentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const appPath = useAppPath();
  const { user, isLoading: authLoading } = useAuth();
  const config = useConfig();
  const { theme } = useTheme();

  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get params from URL
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const scope = searchParams.get('scope');
  const state = searchParams.get('state');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');

  // Get logo
  const logo = typeof config.ui.logo === 'string'
    ? config.ui.logo
    : (theme === 'dark' ? config.ui.logo.dark : config.ui.logo.light);

  // Load client info
  useEffect(() => {
    async function loadClientInfo() {
      if (!clientId) {
        setError('Missing client_id parameter');
        setIsLoading(false);
        return;
      }

      try {
        // For now, we'll just display the client_id
        // In a full implementation, we'd fetch client details from the server
        setClientInfo({
          clientId,
          clientName: clientId.startsWith('mcp_') ? 'MCP Client' : clientId,
        });
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load client information');
        setIsLoading(false);
      }
    }

    loadClientInfo();
  }, [clientId]);

  // Handle consent decision
  async function handleConsent(approved: boolean) {
    setIsSubmitting(true);
    setError(null);

    try {
      // OAuth endpoints are at the API root level, not under /api
      // In dev mode with separate servers, detect localhost:5173 and route to localhost:3000
      // In production, same-origin requests work since API and client are served together
      let apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl && window.location.hostname === 'localhost' && window.location.port === '5173') {
        apiUrl = 'http://localhost:3000';
      }
      const response = await fetch(`${apiUrl}/oauth/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod || 'S256',
          consent: approved ? 'approve' : 'deny',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.error?.message || error.message || 'Authorization failed');
      }

      const data = await response.json() as { redirect: string };
      // Redirect to the client's redirect URI
      window.location.href = data.redirect;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorization failed');
      setIsSubmitting(false);
    }
  }

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    const returnUrl = `/oauth/consent?${searchParams.toString()}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnUrl)}`} replace />;
  }

  // Parse scopes for display
  const scopeList = scope ? scope.split(' ') : [];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img
            src={logo}
            alt={config.app.name}
            className="mx-auto h-12 w-auto"
          />
        </div>

        {/* Consent Card */}
        <div className="rounded-2xl border border-border bg-background-secondary p-6 shadow-lg">
          {isLoading || authLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10">
                <X className="h-6 w-6 text-error" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Authorization Error</h2>
              <p className="mt-2 text-sm text-text-secondary">{error}</p>
              <button
                onClick={() => navigate(appPath('/'))}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Return Home
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Authorize Application
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">{clientInfo?.clientName}</span>
                  {' '}wants to access your account
                </p>
              </div>

              {/* Client Info */}
              {clientInfo?.clientUri && (
                <a
                  href={clientInfo.clientUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 flex items-center justify-center gap-1 text-sm text-primary hover:underline"
                >
                  Visit application website
                  <ExternalLink size={14} />
                </a>
              )}

              {/* Scopes */}
              {scopeList.length > 0 && (
                <div className="mb-6 rounded-lg border border-border bg-background p-4">
                  <p className="mb-3 text-sm font-medium text-text-primary">
                    This application will be able to:
                  </p>
                  <ul className="space-y-2">
                    {scopeList.map((s) => (
                      <li key={s} className="flex items-center gap-2 text-sm text-text-secondary">
                        <Check size={16} className="text-success" />
                        {s === 'mcp:tools' && 'Use available tools on your behalf'}
                        {s === 'mcp:resources' && 'Read resources on your behalf'}
                        {!['mcp:tools', 'mcp:resources'].includes(s) && s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* User Info */}
              <div className="mb-6 rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-text-muted">Authorizing as</p>
                <p className="text-sm font-medium text-text-primary">{user?.email}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleConsent(false)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary hover:text-text-primary disabled:opacity-50"
                >
                  Deny
                </button>
                <button
                  onClick={() => handleConsent(true)}
                  disabled={isSubmitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Authorize
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-text-muted">
          By authorizing, you allow this application to access your account
          according to its terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
