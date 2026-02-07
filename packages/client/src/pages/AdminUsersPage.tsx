import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { LayoutDashboard, X, Users, Building2, Mail, Tag } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import type { AdminUser, AdminUsersResponse } from '@chaaskit/shared';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const config = useConfig();
  const appPath = useAppPath();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) {
        params.set('search', search);
      }

      const response = await api.get<AdminUsersResponse>(`/api/admin/users?${params}`);
      setUsers(response.users);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    if (userId === currentUser?.id) {
      setError('Cannot modify your own admin status');
      return;
    }

    const action = currentIsAdmin ? 'remove admin status from' : 'make';
    if (!confirm(`Are you sure you want to ${action} this user ${currentIsAdmin ? '' : 'an admin'}?`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await api.patch(`/api/admin/users/${userId}`, { isAdmin: !currentIsAdmin });
      setSuccess(`User ${currentIsAdmin ? 'demoted' : 'promoted'} successfully`);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleChangePlan = async (userId: string, plan: string) => {
    setError('');
    setSuccess('');

    try {
      await api.patch(`/api/admin/users/${userId}`, { plan });
      setSuccess('Plan updated successfully');
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary">
            Admin
          </h1>
          <Link
            to={appPath('/')}
            className="flex items-center justify-center rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-background-secondary"
            aria-label="Close"
          >
            <X size={20} />
          </Link>
        </div>

        {/* Tab Navigation */}
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
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white"
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
            to={appPath('/admin/waitlist')}
            className="flex items-center gap-1.5 rounded-full bg-background-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary/80"
          >
            <Mail size={16} />
            Waitlist
          </Link>
          <Link
            to={appPath('/admin/promo-codes')}
            className="flex items-center gap-1.5 rounded-full bg-background-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary/80"
          >
            <Tag size={16} />
            Promo Codes
          </Link>
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

        {/* Search */}
        <div className="mb-6 rounded-lg bg-background-secondary p-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 rounded-lg border border-input-border bg-input-background px-4 py-2 text-text-primary focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
            >
              Search
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="rounded-lg bg-background-secondary overflow-hidden">
          {/* Header - Hidden on mobile */}
          <div className="hidden md:block px-4 py-3 bg-background">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-text-muted">
              <div className="col-span-3">User</div>
              <div className="col-span-1">Plan</div>
              <div className="col-span-1">Messages</div>
              <div className="col-span-3">Teams</div>
              <div className="col-span-1">Admin</div>
              <div className="col-span-3">Joined</div>
            </div>
          </div>

          {/* Body */}
          <div className="divide-y divide-background">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-text-muted">
                Loading...
              </div>
            ) : users.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-muted">
                No users found
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="px-4 py-3 hover:bg-background/50"
                >
                  {/* Desktop View */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                    {/* User Info */}
                    <div className="col-span-3 flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
                          {(user.name || user.email)[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-text-primary truncate">
                          {user.name || '-'}
                          {user.id === currentUser?.id && (
                            <span className="ml-2 text-xs text-text-muted">(you)</span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted truncate">
                          {user.email}
                          {user.oauthProvider && (
                            <span className="ml-1 capitalize">({user.oauthProvider})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Plan */}
                    <div className="col-span-1">
                      <select
                        value={user.plan}
                        onChange={(e) => handleChangePlan(user.id, e.target.value)}
                        className="w-full rounded border border-input-border bg-input-background px-2 py-1 text-xs text-text-primary"
                      >
                        <option value="free">Free</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>

                    {/* Messages */}
                    <div className="col-span-1 text-sm text-text-primary">
                      {user.messagesThisMonth}
                    </div>

                    {/* Teams */}
                    <div className="col-span-3">
                      {user.teams && user.teams.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.teams.map((team) => (
                            <Link
                              key={team.id}
                              to={`/admin/teams/${team.id}`}
                              className="inline-flex items-center rounded-full bg-background px-2 py-0.5 text-xs text-text-secondary hover:bg-primary/10 hover:text-primary"
                              title={`Role: ${team.role}`}
                            >
                              {team.name}
                              <span className="ml-1 text-text-muted">
                                ({team.role})
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </div>

                    {/* Admin */}
                    <div className="col-span-1">
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                        disabled={user.id === currentUser?.id}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          user.isAdmin
                            ? 'bg-primary/10 text-primary'
                            : 'bg-background text-text-muted'
                        } ${user.id === currentUser?.id ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'}`}
                      >
                        {user.isAdmin ? 'Admin' : 'User'}
                      </button>
                    </div>

                    {/* Joined */}
                    <div className="col-span-3 text-sm text-text-muted">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Mobile View - Card layout */}
                  <div className="md:hidden space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt=""
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
                            {(user.name || user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">
                            {user.name || '-'}
                            {user.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-text-muted">(you)</span>
                            )}
                          </div>
                          <div className="text-xs text-text-muted truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                        disabled={user.id === currentUser?.id}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          user.isAdmin
                            ? 'bg-primary/10 text-primary'
                            : 'bg-background text-text-muted'
                        } ${user.id === currentUser?.id ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        {user.isAdmin ? 'Admin' : 'User'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <select
                          value={user.plan}
                          onChange={(e) => handleChangePlan(user.id, e.target.value)}
                          className="rounded border border-input-border bg-input-background px-2 py-1 text-xs text-text-primary"
                        >
                          <option value="free">Free</option>
                          <option value="basic">Basic</option>
                          <option value="pro">Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                        <span className="text-text-muted">{user.messagesThisMonth} msgs</span>
                      </div>
                      <span className="text-text-muted">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-background">
              <div className="text-sm text-text-muted">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} users
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded bg-background-secondary px-3 py-1 text-sm text-text-primary hover:bg-background-secondary/80 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded bg-background-secondary px-3 py-1 text-sm text-text-primary hover:bg-background-secondary/80 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
