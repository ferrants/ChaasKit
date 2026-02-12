import { useState, useEffect } from 'react';
import { Key, Link, Unlink, ExternalLink, Loader2, Check, AlertCircle, Wrench } from 'lucide-react';
import type { MCPCredentialStatus, MCPAuthMode } from '@chaaskit/shared';

interface TeamMCPCredentialsSectionProps {
  teamId: string;
}

export default function TeamMCPCredentialsSection({ teamId }: TeamMCPCredentialsSectionProps) {
  const [credentials, setCredentials] = useState<MCPCredentialStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [savingStates, setSavingStates] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [connectingStates, setConnectingStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadCredentials();

    // Check for OAuth callback results in URL
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const serverId = params.get('server');

    if (success === 'oauth_connected' && serverId) {
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      loadCredentials();
    }
  }, [teamId]);

  async function loadCredentials() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/mcp/team/${teamId}/credentials`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load credentials');
      }

      const data = await response.json();
      setCredentials(data.credentials || []);
    } catch (err) {
      console.error('Failed to load team MCP credentials:', err);
      setError('Failed to load credentials');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveApiKey(serverId: string) {
    const apiKey = apiKeyInputs[serverId];
    if (!apiKey?.trim()) return;

    setSavingStates((prev) => ({ ...prev, [serverId]: 'saving' }));

    try {
      const response = await fetch(`/api/mcp/team/${teamId}/credentials/${serverId}/apikey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to save API key');
      }

      setSavingStates((prev) => ({ ...prev, [serverId]: 'saved' }));
      setApiKeyInputs((prev) => ({ ...prev, [serverId]: '' }));

      loadCredentials();

      setTimeout(() => {
        setSavingStates((prev) => ({ ...prev, [serverId]: 'idle' }));
      }, 2000);
    } catch (err) {
      console.error('Failed to save API key:', err);
      setSavingStates((prev) => ({ ...prev, [serverId]: 'error' }));
      setTimeout(() => {
        setSavingStates((prev) => ({ ...prev, [serverId]: 'idle' }));
      }, 2000);
    }
  }

  async function handleDisconnect(serverId: string) {
    try {
      const response = await fetch(`/api/mcp/team/${teamId}/credentials/${serverId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      loadCredentials();
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError('Failed to disconnect');
    }
  }

  async function handleOAuthConnect(serverId: string) {
    setConnectingStates((prev) => ({ ...prev, [serverId]: true }));

    try {
      const response = await fetch(`/api/mcp/team/${teamId}/oauth/${serverId}/authorize`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to start OAuth flow');
      }

      const data = await response.json();
      window.location.href = data.authorizationUrl;
    } catch (err) {
      console.error('Failed to start OAuth:', err);
      setError('Failed to start authentication');
      setConnectingStates((prev) => ({ ...prev, [serverId]: false }));
    }
  }

  function getAuthModeLabel(authMode: MCPAuthMode): string {
    switch (authMode) {
      case 'team-apikey':
        return 'API Key';
      case 'team-oauth':
        return 'OAuth';
      default:
        return authMode;
    }
  }

  if (isLoading) {
    return (
      <div className="mb-6 rounded-lg bg-background-secondary p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-5 h-5 text-primary" />
          <h2 className="text-base sm:text-lg font-semibold text-text-primary">Tool Connections</h2>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (credentials.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg bg-background-secondary p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="w-5 h-5 text-primary" />
        <h2 className="text-base sm:text-lg font-semibold text-text-primary">Tool Connections</h2>
      </div>

      <p className="text-xs sm:text-sm text-text-muted mb-4">
        Configure shared tool credentials for all team members. These tools will be available in team threads.
      </p>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="space-y-3">
        {credentials.map((cred) => (
          <div
            key={cred.serverId}
            className="rounded-lg border border-border bg-background p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {cred.authMode === 'team-apikey' ? (
                  <Key size={16} className="text-text-secondary" />
                ) : (
                  <Link size={16} className="text-text-secondary" />
                )}
                <span className="font-medium text-text-primary">{cred.serverName}</span>
                <span className="rounded-full bg-background-secondary px-2 py-0.5 text-xs text-text-muted">
                  {getAuthModeLabel(cred.authMode)}
                </span>
              </div>

              {cred.hasCredential && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check size={14} />
                    Connected
                  </span>
                  <button
                    onClick={() => handleDisconnect(cred.serverId)}
                    className="rounded p-1 text-text-secondary hover:bg-background-secondary hover:text-error"
                    title="Disconnect"
                  >
                    <Unlink size={14} />
                  </button>
                </div>
              )}
            </div>

            {cred.userInstructions && (
              <p className="mt-2 text-xs text-text-muted">{cred.userInstructions}</p>
            )}

            {!cred.hasCredential && cred.authMode === 'team-apikey' && (
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  value={apiKeyInputs[cred.serverId] || ''}
                  onChange={(e) =>
                    setApiKeyInputs((prev) => ({ ...prev, [cred.serverId]: e.target.value }))
                  }
                  placeholder="Enter API key..."
                  className="flex-1 rounded-lg border border-input-border bg-input-background px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => handleSaveApiKey(cred.serverId)}
                  disabled={
                    !apiKeyInputs[cred.serverId]?.trim() ||
                    savingStates[cred.serverId] === 'saving'
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {savingStates[cred.serverId] === 'saving' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : savingStates[cred.serverId] === 'saved' ? (
                    <Check size={14} />
                  ) : (
                    <Key size={14} />
                  )}
                  {savingStates[cred.serverId] === 'saving'
                    ? 'Saving...'
                    : savingStates[cred.serverId] === 'saved'
                    ? 'Saved'
                    : 'Save'}
                </button>
              </div>
            )}

            {!cred.hasCredential && cred.authMode === 'team-oauth' && (
              <div className="mt-3">
                <button
                  onClick={() => handleOAuthConnect(cred.serverId)}
                  disabled={connectingStates[cred.serverId]}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {connectingStates[cred.serverId] ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ExternalLink size={14} />
                  )}
                  {connectingStates[cred.serverId] ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            )}

            {cred.hasCredential && cred.authMode === 'team-apikey' && (
              <div className="mt-3">
                <details className="group">
                  <summary className="cursor-pointer text-xs text-text-muted hover:text-text-secondary">
                    Update API key
                  </summary>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="password"
                      value={apiKeyInputs[cred.serverId] || ''}
                      onChange={(e) =>
                        setApiKeyInputs((prev) => ({ ...prev, [cred.serverId]: e.target.value }))
                      }
                      placeholder="Enter new API key..."
                      className="flex-1 rounded-lg border border-input-border bg-input-background px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveApiKey(cred.serverId)}
                      disabled={
                        !apiKeyInputs[cred.serverId]?.trim() ||
                        savingStates[cred.serverId] === 'saving'
                      }
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50"
                    >
                      {savingStates[cred.serverId] === 'saving' ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : savingStates[cred.serverId] === 'saved' ? (
                        <Check size={14} />
                      ) : (
                        <Key size={14} />
                      )}
                      Update
                    </button>
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
