import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router';
import { Key, Plus, Trash2, Copy, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { useConfig, useConfigLoaded } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { useTeam } from '../contexts/TeamContext';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  teamId: string | null;
  team: { id: string; name: string } | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreateKeyResponse {
  key: {
    id: string;
    name: string;
    keyPrefix: string;
    teamId: string | null;
    teamName: string | null;
    createdAt: string;
    expiresAt: string | null;
  };
  secret: string;
}

export default function ApiKeysPage() {
  const config = useConfig();
  const configLoaded = useConfigLoaded();
  const { user } = useAuth();
  const { teams } = useTeam();
  const appPath = useAppPath();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState('');
  const [newKeyExpiration, setNewKeyExpiration] = useState('never');
  const [isCreating, setIsCreating] = useState(false);

  const [createdKey, setCreatedKey] = useState<CreateKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  const [canAccess, setCanAccess] = useState<boolean | null>(null);

  const teamsEnabled = config.teams?.enabled ?? false;
  const showScopeSelector = teamsEnabled && teams.length > 0;

  // Check access on mount (wait for config to load first)
  useEffect(() => {
    if (!configLoaded) return;

    if (!config.api?.enabled) {
      setCanAccess(false);
      setIsLoading(false);
      return;
    }

    api.get<{ canAccess: boolean }>('/api/api-keys/access')
      .then((res) => {
        setCanAccess(res.canAccess);
        if (res.canAccess) {
          loadKeys();
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => {
        setCanAccess(false);
        setIsLoading(false);
      });
  }, [configLoaded, config.api?.enabled]);

  async function loadKeys() {
    try {
      const res = await api.get<{ keys: ApiKey[] }>('/api/api-keys');
      setKeys(res.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setError('');

    try {
      let expiresAt: string | undefined;
      if (newKeyExpiration !== 'never') {
        const date = new Date();
        switch (newKeyExpiration) {
          case '30d':
            date.setDate(date.getDate() + 30);
            break;
          case '90d':
            date.setDate(date.getDate() + 90);
            break;
          case '1y':
            date.setFullYear(date.getFullYear() + 1);
            break;
        }
        expiresAt = date.toISOString();
      }

      const res = await api.post<CreateKeyResponse>('/api/api-keys', {
        name: newKeyName || 'Untitled Key',
        teamId: newKeyScope || undefined,
        expiresAt,
      });

      setCreatedKey(res);
      setShowCreateModal(false);
      setNewKeyName('');
      setNewKeyScope('');
      setNewKeyExpiration('never');
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteKey(keyId: string) {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    setDeletingKeyId(keyId);
    setError('');

    try {
      await api.delete(`/api/api-keys/${keyId}`);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
    } finally {
      setDeletingKeyId(null);
    }
  }

  function handleCopyKey() {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatRelativeDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  }

  // Redirect if feature is disabled
  if (canAccess === false) {
    return <Navigate to={appPath('/')} replace />;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <Key size={24} className="text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">
              API Keys
            </h1>
          </div>
          <Link
            to={appPath('/')}
            className="flex items-center justify-center rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-background-secondary"
            aria-label="Close"
          >
            <X size={20} />
          </Link>
        </div>

        {/* Description */}
        <div className="mb-6 text-sm text-text-secondary">
          API keys allow you to access the API programmatically. Keep your keys secret and never share them publicly.
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-error/10 p-4 text-sm text-error">
            {error}
          </div>
        )}

        {/* Create Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Plus size={16} />
            Create API Key
          </button>
        </div>

        {/* Keys List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-border bg-background-secondary p-8 text-center">
            <Key size={48} className="mx-auto mb-4 text-text-muted" />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No API Keys
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Create an API key to start using the API programmatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="rounded-lg border border-border bg-background-secondary p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-text-primary truncate">
                        {key.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-background text-text-muted font-mono">
                        {key.keyPrefix}...
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                      <span>
                        Scope: {key.team ? key.team.name : 'Personal'}
                      </span>
                      <span>
                        Created: {formatDate(key.createdAt)}
                      </span>
                      <span>
                        Last used: {formatRelativeDate(key.lastUsedAt)}
                      </span>
                      {key.expiresAt && (
                        <span>
                          Expires: {formatDate(key.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    disabled={deletingKeyId === key.id}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-error hover:bg-error/10 disabled:opacity-50"
                  >
                    {deletingKeyId === key.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowCreateModal(false)}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-background p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                Create API Key
              </h2>
              <form onSubmit={handleCreateKey}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., My CLI Tool"
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
                    />
                  </div>

                  {showScopeSelector && (
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Scope
                      </label>
                      <select
                        value={newKeyScope}
                        onChange={(e) => setNewKeyScope(e.target.value)}
                        className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                      >
                        <option value="">Personal</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-text-muted">
                        Team-scoped keys operate in the team context for all API requests.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Expiration
                    </label>
                    <select
                      value={newKeyExpiration}
                      onChange={(e) => setNewKeyExpiration(e.target.value)}
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                    >
                      <option value="never">Never</option>
                      <option value="30d">30 days</option>
                      <option value="90d">90 days</option>
                      <option value="1y">1 year</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-background-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    {isCreating && <Loader2 size={14} className="animate-spin" />}
                    Create Key
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Created Key Modal */}
        {createdKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative w-full max-w-md rounded-2xl bg-background p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={20} className="text-warning" />
                <h2 className="text-lg font-semibold text-text-primary">
                  Save Your API Key
                </h2>
              </div>

              <div className="mb-4 rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
                Make sure to copy your API key now. You won't be able to see it again!
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Your API Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={createdKey.secret}
                    readOnly
                    className="flex-1 rounded-lg border border-input-border bg-input-background px-3 py-2 text-sm font-mono text-text-primary"
                  />
                  <button
                    onClick={handleCopyKey}
                    className="flex items-center justify-center rounded-lg border border-border bg-background-secondary p-2 hover:bg-background"
                  >
                    {copied ? (
                      <Check size={18} className="text-success" />
                    ) : (
                      <Copy size={18} className="text-text-secondary" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setCreatedKey(null)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
