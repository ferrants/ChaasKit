import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useTeam } from '../contexts/TeamContext';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';

interface InviteDetails {
  email: string;
  role: string;
  teamName: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const appPath = useAppPath();
  const { user, isLoading: authLoading } = useAuth();
  const { loadTeams, setCurrentTeamId } = useTeam();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadInvite() {
      if (!token) return;

      try {
        const response = await api.get<{ invite: InviteDetails }>(`/api/teams/invite/${token}`);
        setInvite(response.invite);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invite');
      } finally {
        setIsLoading(false);
      }
    }

    loadInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    setIsAccepting(true);
    setError('');

    try {
      const response = await api.post<{ team: { id: string } }>(`/api/teams/invite/${token}/accept`, {});
      await loadTeams();
      setCurrentTeamId(response.team.id);
      navigate(appPath('/'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
      setIsAccepting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-4 rounded-lg bg-[var(--color-error)]/10 p-4 text-[var(--color-error)]">
            {error}
          </div>
          <Link
            to="/"
            className="text-[var(--color-primary)] hover:underline"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
            Team Invitation
          </h1>
          {invite && (
            <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-6">
              <p className="text-[var(--color-text-primary)] mb-2">
                You've been invited to join
              </p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
                {invite.teamName}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                as {invite.role}
              </p>
            </div>
          )}
          <p className="text-[var(--color-text-secondary)] mb-6">
            Please sign in or create an account to accept this invitation.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/login"
              className="rounded-lg bg-[var(--color-primary)] px-6 py-2 font-medium text-white hover:bg-[var(--color-primary-hover)]"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-lg border border-[var(--color-border)] px-6 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-background-secondary)]"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
          Team Invitation
        </h1>
        {invite && (
          <>
            <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-6">
              <p className="text-[var(--color-text-primary)] mb-2">
                You've been invited to join
              </p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
                {invite.teamName}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                as {invite.role}
              </p>
            </div>

            {user.email.toLowerCase() !== invite.email.toLowerCase() && (
              <div className="mb-6 rounded-lg bg-[var(--color-warning)]/10 p-4 text-sm text-[var(--color-warning)]">
                This invite was sent to {invite.email}. You are signed in as {user.email}.
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="rounded-lg bg-[var(--color-primary)] px-6 py-2 font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                {isAccepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
              <Link
                to="/"
                className="rounded-lg border border-[var(--color-border)] px-6 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-background-secondary)]"
              >
                Decline
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
