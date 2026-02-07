import { useState, useEffect } from 'react';
import { Loader2, ExternalLink, Trash2, Shield } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { api } from '../utils/api';

interface OAuthApp {
  clientId: string;
  clientName: string;
  clientUri?: string;
  scope?: string;
  authorizedAt: string;
}

export default function OAuthAppsSection() {
  const config = useConfig();
  const [apps, setApps] = useState<OAuthApp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Check if OAuth is enabled
  const oauthEnabled = config.mcp?.servers?.some((server) => server.authMode === 'user-oauth');

  useEffect(() => {
    if (oauthEnabled) {
      loadApps();
    }
  }, [oauthEnabled]);

  async function loadApps() {
    setIsLoading(true);
    try {
      const response = await api.get<{ apps: OAuthApp[] }>('/api/oauth/apps');
      setApps(response.apps);
    } catch (error) {
      console.error('Failed to load OAuth apps:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRevoke(clientId: string) {
    setRevokingId(clientId);
    try {
      await api.delete(`/api/oauth/apps/${clientId}`);
      setApps((prev) => prev.filter((app) => app.clientId !== clientId));
    } catch (error) {
      console.error('Failed to revoke app:', error);
    } finally {
      setRevokingId(null);
    }
  }

  // Don't render if OAuth is not enabled
  if (!oauthEnabled) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-background-secondary p-4">
      <div className="mb-3 flex items-center gap-2">
        <Shield size={18} className="text-primary" />
        <h3 className="font-medium text-text-primary">Connected Applications</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      ) : apps.length === 0 ? (
        <p className="text-sm text-text-muted">
          No applications have been authorized to access your account.
        </p>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <div
              key={app.clientId}
              className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary truncate">
                    {app.clientName}
                  </span>
                  {app.clientUri && (
                    <a
                      href={app.clientUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-muted hover:text-primary"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-text-muted">
                  Authorized {new Date(app.authorizedAt).toLocaleDateString()}
                  {app.scope && (
                    <span className="ml-2">
                      Scopes: {app.scope}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRevoke(app.clientId)}
                disabled={revokingId === app.clientId}
                className="ml-3 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-error hover:bg-error/10 disabled:opacity-50"
              >
                {revokingId === app.clientId ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
