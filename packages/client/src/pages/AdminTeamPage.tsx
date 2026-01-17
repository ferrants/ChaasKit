import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { LayoutDashboard, X, Users, Building2 } from 'lucide-react';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';
import type { AdminTeamDetails } from '@chaaskit/shared';

export default function AdminTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const appPath = useAppPath();
  const [team, setTeam] = useState<AdminTeamDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTeam() {
      if (!teamId) return;

      setIsLoading(true);
      setError('');

      try {
        const response = await api.get<AdminTeamDetails>(`/api/admin/teams/${teamId}`);
        setTeam(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team');
      } finally {
        setIsLoading(false);
      }
    }

    loadTeam();
  }, [teamId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-background-secondary rounded mb-6 sm:mb-8" />
            <div className="h-64 bg-background-secondary rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !team) {
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

          <div className="rounded-lg bg-error/10 p-4 text-sm text-error">
            {error || 'Team not found'}
          </div>
          <Link
            to={appPath('/admin/teams')}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Back to teams
          </Link>
        </div>
      </div>
    );
  }

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

        {/* Team Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary flex items-center justify-center text-white text-lg sm:text-xl font-medium">
            {team.name[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text-primary">
              {team.name}
            </h2>
            {team.archivedAt && (
              <span className="text-xs text-text-muted">(archived)</span>
            )}
          </div>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="rounded-lg bg-background-secondary p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-text-muted">Members</div>
            <div className="text-xl sm:text-2xl font-bold text-text-primary">
              {team.memberCount}
            </div>
          </div>
          <div className="rounded-lg bg-background-secondary p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-text-muted">Threads</div>
            <div className="text-xl sm:text-2xl font-bold text-text-primary">
              {team.threadCount}
            </div>
          </div>
          <div className="rounded-lg bg-background-secondary p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-text-muted">Created</div>
            <div className="text-xl sm:text-2xl font-bold text-text-primary">
              {new Date(team.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
            <div className="text-xs text-text-muted hidden sm:block">
              {new Date(team.createdAt).getFullYear()}
            </div>
          </div>
        </div>

        {/* Team Context */}
        {team.context && (
          <div className="mb-6 rounded-lg bg-background-secondary p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-2">
              Team Context
            </h3>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">
              {team.context}
            </p>
          </div>
        )}

        {/* Members List */}
        <div className="rounded-lg bg-background-secondary overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-background">
            <h3 className="text-base sm:text-lg font-semibold text-text-primary">
              Members ({team.members.length})
            </h3>
          </div>

          <div className="divide-y divide-background">
            {team.members.map((member) => (
              <div
                key={member.id}
                className="px-4 sm:px-6 py-3 hover:bg-background/50"
              >
                {/* Desktop View */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
                        {(member.name || member.email)[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <Link
                        to={`/admin/users?search=${encodeURIComponent(member.email)}`}
                        className="text-sm font-medium text-text-primary hover:text-primary"
                      >
                        {member.name || member.email}
                      </Link>
                      {member.name && (
                        <div className="text-xs text-text-muted">
                          {member.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      member.role === 'owner'
                        ? 'bg-primary/10 text-primary'
                        : member.role === 'admin'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-background text-text-muted'
                    }`}>
                      {member.role}
                    </span>
                    <span className="text-xs text-text-muted">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Mobile View */}
                <div className="sm:hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt=""
                          className="w-10 h-10 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium flex-shrink-0">
                          {(member.name || member.email)[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          to={`/admin/users?search=${encodeURIComponent(member.email)}`}
                          className="text-sm font-medium text-text-primary hover:text-primary truncate block"
                        >
                          {member.name || member.email}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${
                            member.role === 'owner'
                              ? 'bg-primary/10 text-primary'
                              : member.role === 'admin'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-background text-text-muted'
                          }`}>
                            {member.role}
                          </span>
                          <span>
                            {new Date(member.joinedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
