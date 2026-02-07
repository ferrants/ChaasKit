import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { LayoutDashboard, Users, Building2, X, Mail, Tag } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';
import type { AdminWaitlistEntry, AdminWaitlistResponse } from '@chaaskit/shared';

export default function AdminWaitlistPage() {
  const config = useConfig();
  const appPath = useAppPath();
  const [entries, setEntries] = useState<AdminWaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadWaitlist() {
    setIsLoading(true);
    setError('');

    try {
      const response = await api.get<AdminWaitlistResponse>('/api/admin/waitlist');
      setEntries(response.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load waitlist');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadWaitlist();
  }, []);

  async function handleInvite(entryId: string, email: string) {
    setError('');
    setSuccess('');

    try {
      await api.post(`/api/admin/waitlist/${entryId}/invite`, {});
      setSuccess(`Invite sent to ${email}`);
      loadWaitlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Admin</h1>
          <Link
            to={appPath('/')}
            className="flex items-center justify-center rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-background-secondary"
            aria-label="Close"
          >
            <X size={20} />
          </Link>
        </div>

        <div className="flex items-center gap-2 mb-6 sm:mb-8">
          <Link
            to={appPath('/admin')}
            className="flex items-center gap-1.5 rounded-full bg-background-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary/80"
          >
            <LayoutDashboard size={16} />
            Overview
          </Link>
          <Link
            to={appPath('/admin/users')}
            className="flex items-center gap-1.5 rounded-full bg-background-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary/80"
          >
            <Users size={16} />
            Users
          </Link>
          {config.teams?.enabled && (
            <Link
              to={appPath('/admin/teams')}
              className="flex items-center gap-1.5 rounded-full bg-background-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary/80"
            >
              <Building2 size={16} />
              Teams
            </Link>
          )}
          <Link
            to={appPath('/admin/promo-codes')}
            className="flex items-center gap-1.5 rounded-full bg-background-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary/80"
          >
            <Tag size={16} />
            Promo Codes
          </Link>
          <span className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white">
            <Mail size={16} />
            Waitlist
          </span>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-error/10 p-4 text-sm text-error">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg bg-success/10 p-4 text-sm text-success">
            {success}
          </div>
        )}

        <div className="rounded-lg bg-background-secondary overflow-hidden">
          <div className="hidden md:block px-4 py-3 bg-background">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-text-muted">
              <div className="col-span-4">Email</div>
              <div className="col-span-2">Name</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Joined</div>
              <div className="col-span-2">Action</div>
            </div>
          </div>

          <div className="divide-y divide-background">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-text-muted">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-muted">No waitlist entries</div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="px-4 py-3 hover:bg-background/50">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 text-sm">
                    <div className="md:col-span-4 text-text-primary">{entry.email}</div>
                    <div className="md:col-span-2 text-text-secondary">{entry.name || '-'}</div>
                    <div className="md:col-span-2 capitalize text-text-secondary">{entry.status.replace('_', ' ')}</div>
                    <div className="md:col-span-2 text-text-muted">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </div>
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={() => handleInvite(entry.id, entry.email)}
                        disabled={entry.status === 'invited'}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                      >
                        {entry.status === 'invited' ? 'Invited' : 'Invite'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
