import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
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

  const invitePath = `/invite/${token}`;

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-4 rounded-lg bg-error/10 p-4 text-error">
            {error}
          </div>
          <a
            href="/"
            className="text-primary hover:underline"
          >
            Go to homepage
          </a>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-4">
            Team Invitation
          </h1>
          {invite && (
            <div className="mb-6 rounded-lg border border-border bg-background-secondary p-6">
              <p className="text-text-primary mb-2">
                You've been invited to join
              </p>
              <p className="text-2xl font-bold text-text-primary mb-4">
                {invite.teamName}
              </p>
              <p className="text-sm text-text-muted">
                as {invite.role}
              </p>
            </div>
          )}
          <p className="text-text-secondary mb-6">
            Please sign in or create an account to accept this invitation.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href={`/login?redirect=${encodeURIComponent(invitePath)}`}
              className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-hover"
            >
              Sign In
            </a>
            <a
              href={`/register?invite=${token}&redirect=${encodeURIComponent(invitePath)}`}
              className="rounded-lg border border-border px-6 py-2 font-medium text-text-primary hover:bg-background-secondary"
            >
              Create Account
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-4">
          Team Invitation
        </h1>
        {invite && (
          <>
            <div className="mb-6 rounded-lg border border-border bg-background-secondary p-6">
              <p className="text-text-primary mb-2">
                You've been invited to join
              </p>
              <p className="text-2xl font-bold text-text-primary mb-4">
                {invite.teamName}
              </p>
              <p className="text-sm text-text-muted">
                as {invite.role}
              </p>
            </div>

            {user.email.toLowerCase() !== invite.email.toLowerCase() && (
              <div className="mb-6 rounded-lg bg-warning/10 p-4 text-sm text-warning">
                This invite was sent to {invite.email}. You are signed in as {user.email}.
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {isAccepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
              <a
                href="/"
                className="rounded-lg border border-border px-6 py-2 font-medium text-text-primary hover:bg-background-secondary"
              >
                Decline
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
