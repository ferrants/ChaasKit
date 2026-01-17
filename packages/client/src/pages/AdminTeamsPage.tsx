import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { LayoutDashboard, X, Users, Building2 } from 'lucide-react';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';
import type { AdminTeam, AdminTeamsResponse } from '@chaaskit/shared';

export default function AdminTeamsPage() {
  const appPath = useAppPath();
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTeams = useCallback(async () => {
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

      const response = await api.get<AdminTeamsResponse>(`/api/admin/teams?${params}`);
      setTeams(response.teams);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
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
            className="flex items-center gap-1.5 rounded-full bg-background-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary/80"
          >
            <Users size={16} />
            Users
          </Link>
          <Link
            to={appPath('/admin/teams')}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            <Building2 size={16} />
            Teams
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-error/10 p-4 text-sm text-error">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-6 rounded-lg bg-background-secondary p-4">
          <form onSubmit={handleSearch} className="flex gap-2 sm:gap-4">
            <input
              type="text"
              placeholder="Search by team name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 rounded-lg border border-input-border bg-input-background px-3 sm:px-4 py-2 text-text-primary focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 sm:px-4 py-2 font-medium text-white hover:bg-primary-hover"
            >
              Search
            </button>
          </form>
        </div>

        {/* Teams List */}
        <div className="rounded-lg bg-background-secondary overflow-hidden">
          {/* Header - Hidden on mobile */}
          <div className="hidden sm:block px-4 py-3 bg-background">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-text-muted">
              <div className="col-span-4">Team</div>
              <div className="col-span-2">Members</div>
              <div className="col-span-2">Threads</div>
              <div className="col-span-4">Created</div>
            </div>
          </div>

          {/* Body */}
          <div className="divide-y divide-background">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-text-muted">
                Loading...
              </div>
            ) : teams.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-muted">
                No teams found
              </div>
            ) : (
              teams.map((team) => (
                <Link
                  key={team.id}
                  to={`/admin/teams/${team.id}`}
                  className="block px-4 py-3 hover:bg-background/50"
                >
                  {/* Desktop View */}
                  <div className="hidden sm:grid grid-cols-12 gap-4 items-center">
                    {/* Team Name */}
                    <div className="col-span-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
                          {team.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text-primary">
                            {team.name}
                          </div>
                          {team.archivedAt && (
                            <span className="text-xs text-text-muted">
                              (archived)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Members */}
                    <div className="col-span-2 text-sm text-text-primary">
                      {team.memberCount}
                    </div>

                    {/* Threads */}
                    <div className="col-span-2 text-sm text-text-primary">
                      {team.threadCount}
                    </div>

                    {/* Created */}
                    <div className="col-span-4 text-sm text-text-muted">
                      {new Date(team.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Mobile View */}
                  <div className="sm:hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
                          {team.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text-primary">
                            {team.name}
                          </div>
                          <div className="text-xs text-text-muted">
                            {team.memberCount} members · {team.threadCount} threads
                            {team.archivedAt && ' · archived'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-text-muted">
                        {new Date(team.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-background">
              <div className="text-xs sm:text-sm text-text-muted">
                {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded bg-background-secondary px-3 py-1 text-sm text-text-primary hover:bg-background-secondary/80 disabled:opacity-50"
                >
                  Prev
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
