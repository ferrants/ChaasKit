import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Copy, Check, Trash2, X, Link, Clock, Loader2 } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';

interface ShareInfo {
  shareId: string;
  url: string;
  expiresAt: string | null;
  createdAt: string;
}

interface ShareModalProps {
  threadId: string;
  threadTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ threadId, threadTitle, isOpen, onClose }: ShareModalProps) {
  const config = useConfig();
  const [shares, setShares] = useState<ShareInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [error, setError] = useState<string | null>(null);

  const expirationOptions = config.sharing?.expirationOptions || ['1h', '24h', '7d', '30d', 'never'];

  useEffect(() => {
    if (isOpen) {
      loadShares();
    }
  }, [isOpen, threadId]);

  async function loadShares() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/share/thread/${threadId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load shares');
      }
      const data = await response.json();
      setShares(data.shares);
    } catch (err) {
      setError('Failed to load existing shares');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateShare() {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/share/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ expiresIn }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create share link');
      }
      const data = await response.json();
      setShares((prev) => [
        {
          shareId: data.shareId,
          url: data.url,
          expiresAt: data.expiresAt,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      // Auto-copy the new link
      await copyToClipboard(data.url, data.shareId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteShare(shareId: string) {
    try {
      const response = await fetch(`/api/share/${shareId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete share');
      }
      setShares((prev) => prev.filter((s) => s.shareId !== shareId));
    } catch (err) {
      setError('Failed to delete share link');
      console.error(err);
    }
  }

  async function copyToClipboard(url: string, shareId: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  function formatExpiration(expiresAt: string | null): string {
    if (!expiresAt) return 'Never expires';
    const date = new Date(expiresAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Expired';
    if (diff < 60 * 60 * 1000) {
      const mins = Math.round(diff / (60 * 1000));
      return `Expires in ${mins} min${mins !== 1 ? 's' : ''}`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.round(diff / (60 * 60 * 1000));
      return `Expires in ${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    const days = Math.round(diff / (24 * 60 * 60 * 1000));
    return `Expires in ${days} day${days !== 1 ? 's' : ''}`;
  }

  function formatExpirationLabel(option: string): string {
    const labels: Record<string, string> = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
      'never': 'Never',
    };
    return labels[option] || option;
  }

  if (!isOpen) return null;

  const sharingEnabled = config.sharing?.enabled;
  const scope = config.sharing?.scope || 'public';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl bg-background p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-text-primary">Share Conversation</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-background-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {!sharingEnabled ? (
          <p className="text-sm text-text-secondary">
            Sharing is currently disabled.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-text-secondary">
              {scope === 'team'
                ? 'Create a link to share this conversation with your team members.'
                : 'Create a public link to share this conversation with anyone.'}
            </p>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
                {error}
              </div>
            )}

            {/* Create new share */}
            <div className="mb-4 rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Link expires in
                  </label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    className="w-full rounded-md border border-input-border bg-input-background px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none"
                  >
                    {expirationOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatExpirationLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCreateShare}
                  disabled={isCreating}
                  className="mt-5 flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {isCreating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Link size={16} />
                  )}
                  Create Link
                </button>
              </div>
            </div>

            {/* Existing shares */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-text-primary">Active Links</h4>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-text-muted" />
                </div>
              ) : shares.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">
                  No active share links
                </p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {shares.map((share) => (
                    <div
                      key={share.shareId}
                      className="flex items-center gap-2 rounded-lg border border-border p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-mono text-text-secondary">
                          {share.url}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                          <Clock size={10} />
                          {formatExpiration(share.expiresAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(share.url, share.shareId)}
                        className="rounded p-1.5 text-text-muted hover:bg-background-secondary hover:text-text-primary"
                        title="Copy link"
                      >
                        {copiedId === share.shareId ? (
                          <Check size={16} className="text-success" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteShare(share.shareId)}
                        className="rounded p-1.5 text-text-muted hover:bg-error/10 hover:text-error"
                        title="Revoke link"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
