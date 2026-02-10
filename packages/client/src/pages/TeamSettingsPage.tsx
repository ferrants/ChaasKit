import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, Navigate, useSearchParams } from 'react-router';
import { CreditCard, ExternalLink, Loader2, X, MessageSquare } from 'lucide-react';
import { useTeam } from '../contexts/TeamContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';
import type { TeamRole, TeamStats, TeamActivityItem, TeamStatsResponse } from '@chaaskit/shared';

interface SlackIntegrationStatus {
  connected: boolean;
  integration?: {
    id: string;
    workspaceId: string;
    workspaceName: string;
    notificationChannel: string | null;
    aiChatEnabled: boolean;
    status: string;
    statusMessage: string | null;
    installedAt: string;
  };
}

interface TeamSubscription {
  plan: string;
  planName: string;
  messagesThisMonth: number;
  monthlyLimit: number;
  credits: number;
  hasStripeCustomer: boolean;
}

export default function TeamSettingsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const appPath = useAppPath();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const config = useConfig();
  const paymentsEnabled = config.payments?.enabled ?? false;
  const {
    teams,
    currentTeam,
    isLoadingTeamDetails,
    loadTeamDetails,
    updateTeam,
    archiveTeam,
    inviteMember,
    removeMember,
    updateMemberRole,
    cancelInvite,
    leaveTeam,
  } = useTeam();

  const [teamName, setTeamName] = useState('');
  const [teamContext, setTeamContext] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [activity, setActivity] = useState<TeamActivityItem[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [subscription, setSubscription] = useState<TeamSubscription | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  // Slack integration state
  const [slackStatus, setSlackStatus] = useState<SlackIntegrationStatus | null>(null);
  const [isLoadingSlack, setIsLoadingSlack] = useState(true);
  const [slackAiChatEnabled, setSlackAiChatEnabled] = useState(true);
  const [slackNotificationChannel, setSlackNotificationChannel] = useState('');
  const [isSavingSlack, setIsSavingSlack] = useState(false);
  const [isDisconnectingSlack, setIsDisconnectingSlack] = useState(false);

  const currentTeamRole = teams.find((t) => t.id === teamId)?.role;
  const isOwner = currentTeamRole === 'owner';
  const isAdmin = currentTeamRole === 'owner' || currentTeamRole === 'admin';
  const teamsEnabled = config.teams?.enabled ?? false;
  const slackEnabled = (config as unknown as { slack?: { enabled: boolean } }).slack?.enabled ?? false;

  useEffect(() => {
    if (teamId && teamsEnabled) {
      loadTeamDetails(teamId);
    }
  }, [teamId, teamsEnabled, loadTeamDetails]);

  useEffect(() => {
    if (currentTeam) {
      setTeamName(currentTeam.name);
      setTeamContext(currentTeam.context || '');
    }
  }, [currentTeam]);

  useEffect(() => {
    if (teamId && teamsEnabled) {
      setIsLoadingStats(true);
      api.get<TeamStatsResponse>(`/api/teams/${teamId}/stats`)
        .then(res => {
          setStats(res.stats);
          setActivity(res.recentActivity);
        })
        .catch(() => {
          // Silently fail - stats are not critical
        })
        .finally(() => setIsLoadingStats(false));
    }
  }, [teamId, teamsEnabled]);

  // Load team subscription data
  useEffect(() => {
    if (teamId && teamsEnabled && paymentsEnabled) {
      setIsLoadingSubscription(true);
      api.get<TeamSubscription>(`/api/payments/team/${teamId}/subscription`)
        .then(setSubscription)
        .catch(() => {
          // Silently fail - subscription may not exist
        })
        .finally(() => setIsLoadingSubscription(false));
    } else {
      setIsLoadingSubscription(false);
    }
  }, [teamId, teamsEnabled, paymentsEnabled]);

  // Load Slack integration status
  useEffect(() => {
    if (teamId && teamsEnabled && slackEnabled) {
      setIsLoadingSlack(true);
      api.get<SlackIntegrationStatus>(`/api/slack/${teamId}/status`)
        .then(data => {
          setSlackStatus(data);
          if (data.integration) {
            setSlackAiChatEnabled(data.integration.aiChatEnabled);
            setSlackNotificationChannel(data.integration.notificationChannel || '');
          }
        })
        .catch(() => {
          setSlackStatus({ connected: false });
        })
        .finally(() => setIsLoadingSlack(false));
    } else {
      setIsLoadingSlack(false);
      setSlackStatus(null);
    }
  }, [teamId, teamsEnabled, slackEnabled]);

  // Check for Slack connection status in URL params
  useEffect(() => {
    const slackParam = searchParams.get('slack');
    if (slackParam === 'connected') {
      setSuccess('Slack connected successfully!');
      // Reload slack status
      if (teamId) {
        api.get<SlackIntegrationStatus>(`/api/slack/${teamId}/status`)
          .then(data => {
            setSlackStatus(data);
            if (data.integration) {
              setSlackAiChatEnabled(data.integration.aiChatEnabled);
              setSlackNotificationChannel(data.integration.notificationChannel || '');
            }
          })
          .catch(() => {});
      }
    } else if (slackParam === 'error') {
      const message = searchParams.get('message');
      setError(`Failed to connect Slack: ${message || 'Unknown error'}`);
    }
  }, [searchParams, teamId]);

  // Check for payment success/failure in URL params
  useEffect(() => {
    const payment = searchParams.get('payment');
    const credits = searchParams.get('credits');

    if (payment === 'success') {
      setSuccess('Plan upgraded successfully!');
      // Reload subscription data
      if (teamId) {
        api.get<TeamSubscription>(`/api/payments/team/${teamId}/subscription`)
          .then(setSubscription)
          .catch(() => {});
      }
    } else if (payment === 'cancelled') {
      setError('Payment was cancelled');
    } else if (credits === 'success') {
      setSuccess('Credits purchased successfully!');
      // Reload subscription data
      if (teamId) {
        api.get<TeamSubscription>(`/api/payments/team/${teamId}/subscription`)
          .then(setSubscription)
          .catch(() => {});
      }
    } else if (credits === 'cancelled') {
      setError('Credits purchase was cancelled');
    }
  }, [searchParams, teamId]);

  // Redirect if teams feature is disabled
  if (!teamsEnabled) {
    return <Navigate to={appPath('/')} replace />;
  }

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await updateTeam(teamId, { name: teamName });
      setSuccess('Team name updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;

    setError('');
    setSuccess('');
    setIsSavingContext(true);

    try {
      await updateTeam(teamId, { context: teamContext || null });
      setSuccess('Team context updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team context');
    } finally {
      setIsSavingContext(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;

    setError('');
    setSuccess('');
    setInviteUrl('');
    setIsSubmitting(true);

    try {
      const result = await inviteMember(teamId, inviteEmail, inviteRole);
      setInviteUrl(result.inviteUrl);
      setInviteEmail('');
      setSuccess('Invite sent successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!teamId) return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    setError('');
    setSuccess('');

    try {
      await removeMember(teamId, userId);
      setSuccess('Member removed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (userId: string, role: TeamRole) => {
    if (!teamId) return;

    setError('');
    setSuccess('');

    try {
      await updateMemberRole(teamId, userId, role);
      setSuccess('Role updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!teamId) return;
    if (!confirm('Are you sure you want to cancel this invite?')) return;

    setError('');
    setSuccess('');

    try {
      await cancelInvite(teamId, inviteId);
      setSuccess('Invite cancelled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invite');
    }
  };

  const handleArchiveTeam = async () => {
    if (!teamId) return;
    if (!confirm('Are you sure you want to archive this team? Team threads will be preserved but the team will be hidden.')) return;

    setError('');

    try {
      await archiveTeam(teamId);
      navigate(appPath('/'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive team');
    }
  };

  const handleLeaveTeam = async () => {
    if (!teamId) return;
    if (!confirm('Are you sure you want to leave this team?')) return;

    setError('');

    try {
      await leaveTeam(teamId);
      navigate(appPath('/'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave team');
    }
  };

  const copyInviteUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
    setSuccess('Invite link copied to clipboard');
  };

  const handleConnectSlack = () => {
    // Redirect to Slack OAuth install
    window.location.href = `/api/slack/install/${teamId}`;
  };

  const handleDisconnectSlack = async () => {
    if (!teamId) return;
    if (!confirm('Are you sure you want to disconnect Slack? You will need to reconnect to use Slack features.')) return;

    setError('');
    setIsDisconnectingSlack(true);

    try {
      await api.delete(`/api/slack/${teamId}`);
      setSlackStatus({ connected: false });
      setSuccess('Slack disconnected successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Slack');
    } finally {
      setIsDisconnectingSlack(false);
    }
  };

  const handleSaveSlackSettings = async () => {
    if (!teamId) return;

    setError('');
    setIsSavingSlack(true);

    try {
      await api.patch(`/api/slack/${teamId}/settings`, {
        aiChatEnabled: slackAiChatEnabled,
        notificationChannel: slackNotificationChannel || null,
      });
      setSuccess('Slack settings updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Slack settings');
    } finally {
      setIsSavingSlack(false);
    }
  };

  const handleUpgradeTeamPlan = () => {
    navigate(`/pricing?teamId=${teamId}`);
  };

  const handleOpenTeamBillingPortal = async () => {
    if (!teamId) return;
    setIsBillingLoading(true);
    try {
      const response = await fetch(`/api/payments/team/${teamId}/billing-portal`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to open billing portal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setIsBillingLoading(false);
    }
  };

  const formatRelativeTime = (date: Date | string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  if (isLoadingTeamDetails || !currentTeam) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-background-secondary rounded mb-6 sm:mb-8" />
            <div className="h-64 bg-background-secondary rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary">
            Team Settings
          </h1>
          <Link
            to={appPath('/')}
            className="flex items-center justify-center rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-background-secondary"
            aria-label="Close"
          >
            <X size={20} />
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

        {/* Team Stats */}
        <div className="mb-6">
          {isLoadingStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-lg bg-background-secondary p-6 animate-pulse">
                  <div className="h-4 w-20 bg-background rounded mb-2" />
                  <div className="h-8 w-12 bg-background rounded" />
                </div>
              ))}
            </div>
          ) : stats && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div className="rounded-lg bg-background-secondary p-4 sm:p-6">
                  <div className="text-xs sm:text-sm text-text-muted mb-1">Threads</div>
                  <div className="text-xl sm:text-2xl font-semibold text-text-primary">{stats.totalThreads}</div>
                  {stats.threadsThisMonth > 0 && (
                    <div className="text-xs text-text-muted mt-1">+{stats.threadsThisMonth} this month</div>
                  )}
                </div>
                <div className="rounded-lg bg-background-secondary p-4 sm:p-6">
                  <div className="text-xs sm:text-sm text-text-muted mb-1">Messages</div>
                  <div className="text-xl sm:text-2xl font-semibold text-text-primary">{stats.totalMessages}</div>
                </div>
                <div className="rounded-lg bg-background-secondary p-4 sm:p-6">
                  <div className="text-xs sm:text-sm text-text-muted mb-1">This Month</div>
                  <div className="text-xl sm:text-2xl font-semibold text-text-primary">{stats.messagesThisMonth}</div>
                  <div className="text-xs text-text-muted mt-1">messages</div>
                </div>
                <div className="rounded-lg bg-background-secondary p-4 sm:p-6">
                  <div className="text-xs sm:text-sm text-text-muted mb-1">Members</div>
                  <div className="text-xl sm:text-2xl font-semibold text-text-primary">{stats.memberCount}</div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="rounded-lg bg-background-secondary p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-text-primary mb-4">Recent Activity</h2>
                {activity.length === 0 ? (
                  <div className="text-text-muted text-sm">No recent activity</div>
                ) : (
                  <div className="space-y-2">
                    {activity.map((item, index) => (
                      <div
                        key={`${item.type}-${item.timestamp}-${index}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-background gap-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.type === 'thread_created' ? (
                            <svg className="w-5 h-5 flex-shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 flex-shrink-0 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                          )}
                          <div className="text-sm truncate">
                            <span className="text-text-primary">{item.user.name || item.user.email}</span>
                            <span className="text-text-muted">
                              {item.type === 'thread_created'
                                ? ` created "${item.details}"`
                                : ' joined the team'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm text-text-muted flex-shrink-0 pl-8 sm:pl-0">
                          {formatRelativeTime(item.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Team Plan (Billing) */}
        {paymentsEnabled && isAdmin && (
          <div className="mb-6 rounded-lg bg-background-secondary p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="text-base sm:text-lg font-semibold text-text-primary">Team Plan</h2>
            </div>

            {isLoadingSubscription ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : subscription ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <div className="text-sm">
                    <span className="text-text-secondary">Current Plan: </span>
                    <span className="font-medium text-text-primary">{subscription.planName}</span>
                  </div>
                  <span className="self-start sm:self-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {subscription.plan}
                  </span>
                </div>

                {/* Usage Progress */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Messages this month</span>
                    <span className="text-text-primary">
                      {subscription.messagesThisMonth.toLocaleString()}
                      {subscription.monthlyLimit > 0 ? (
                        <span className="text-text-muted"> / {subscription.monthlyLimit.toLocaleString()}</span>
                      ) : (
                        <span className="text-text-muted"> / Unlimited</span>
                      )}
                    </span>
                  </div>

                  {subscription.monthlyLimit > 0 && (
                    <div className="h-2 overflow-hidden rounded-full bg-background">
                      <div
                        className={`h-full rounded-full transition-all ${
                          subscription.messagesThisMonth / subscription.monthlyLimit > 0.9
                            ? 'bg-error'
                            : subscription.messagesThisMonth / subscription.monthlyLimit > 0.7
                            ? 'bg-warning'
                            : 'bg-primary'
                        }`}
                        style={{
                          width: `${Math.min(100, (subscription.messagesThisMonth / subscription.monthlyLimit) * 100)}%`,
                        }}
                      />
                    </div>
                  )}

                  {subscription.credits > 0 && (
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-text-secondary">Credits remaining</span>
                      <span className="text-text-primary">{subscription.credits.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Billing Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleUpgradeTeamPlan}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                  >
                    <CreditCard size={14} />
                    {subscription.plan === 'free' ? 'Upgrade Team Plan' : 'Change Plan'}
                  </button>
                  {subscription.hasStripeCustomer && (
                    <button
                      onClick={handleOpenTeamBillingPortal}
                      disabled={isBillingLoading}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-background-secondary disabled:opacity-50"
                    >
                      {isBillingLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ExternalLink size={14} />
                      )}
                      Manage Subscription
                    </button>
                  )}
                </div>

                <p className="mt-4 text-xs text-text-muted">
                  Team plans provide a shared message pool for all team members.
                  Personal plans still apply to personal chats.
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-text-secondary mb-4">
                  Your team is on the free plan. Upgrade to get a shared message pool for all members.
                </p>
                <button
                  onClick={handleUpgradeTeamPlan}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  Upgrade Team Plan
                </button>
              </div>
            )}
          </div>
        )}

        {/* Slack Integration */}
        {slackEnabled && isAdmin && (
          <div className="mb-6 rounded-lg bg-background-secondary p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="text-base sm:text-lg font-semibold text-text-primary">Slack Integration</h2>
            </div>

            {isLoadingSlack ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : slackStatus?.connected ? (
              <>
                {/* Connected state */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <div className="text-sm">
                    <span className="text-text-secondary">Connected to: </span>
                    <span className="font-medium text-text-primary">{slackStatus.integration?.workspaceName}</span>
                  </div>
                  <span className="self-start sm:self-auto rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                    Active
                  </span>
                </div>

                {/* Settings */}
                <div className="space-y-4 mb-4">
                  {/* AI Chat Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-text-primary">AI Chat</div>
                      <div className="text-xs text-text-muted">Respond to @mentions with AI</div>
                    </div>
                    <button
                      onClick={() => setSlackAiChatEnabled(!slackAiChatEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        slackAiChatEnabled ? 'bg-primary' : 'bg-border'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          slackAiChatEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Notification Channel */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Notification Channel
                    </label>
                    <input
                      type="text"
                      value={slackNotificationChannel}
                      onChange={(e) => setSlackNotificationChannel(e.target.value)}
                      placeholder="#general"
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
                    />
                    <p className="text-xs text-text-muted mt-1">
                      Channel where team notifications will be sent (e.g., thread shared, new members)
                    </p>
                  </div>
                </div>

                {/* Save button */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveSlackSettings}
                    disabled={isSavingSlack}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    {isSavingSlack ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    Save Settings
                  </button>
                  <button
                    onClick={handleDisconnectSlack}
                    disabled={isDisconnectingSlack}
                    className="flex items-center gap-1.5 rounded-lg border border-error bg-transparent px-3 py-2 text-sm font-medium text-error hover:bg-error/10 disabled:opacity-50"
                  >
                    {isDisconnectingSlack ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    Disconnect
                  </button>
                </div>

                <p className="mt-4 text-xs text-text-muted">
                  Connected since {new Date(slackStatus.integration?.installedAt || '').toLocaleDateString()}
                </p>
              </>
            ) : (
              <>
                {/* Not connected state */}
                <p className="text-sm text-text-secondary mb-4">
                  Connect your team's Slack workspace to chat with your AI assistant directly from Slack.
                  Team members can @mention the bot in any channel to get instant responses.
                </p>
                <button
                  onClick={handleConnectSlack}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-white"
                  style={{ backgroundColor: '#4A154B' }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                  Add to Slack
                </button>
              </>
            )}
          </div>
        )}

        {/* Team Name */}
        <div className="mb-6 rounded-lg bg-background-secondary p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary mb-4">
            Team Name
          </h2>
          <form onSubmit={handleUpdateTeam} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              disabled={!isAdmin}
              className="flex-1 rounded-lg border border-input-border bg-input-background px-3 sm:px-4 py-2 text-text-primary focus:border-primary focus:outline-none disabled:opacity-50"
            />
            {isAdmin && (
              <button
                type="submit"
                disabled={isSubmitting || teamName === currentTeam.name}
                className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                Save
              </button>
            )}
          </form>
        </div>

        {/* Team Context */}
        {isAdmin && (
          <div className="mb-6 rounded-lg bg-background-secondary p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-text-primary mb-2">
              Team Context
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mb-4">
              Additional context that will be provided to the AI assistant for all team conversations.
              This is shared across all team members.
            </p>
            <form onSubmit={handleUpdateContext}>
              <textarea
                value={teamContext}
                onChange={(e) => setTeamContext(e.target.value)}
                placeholder="e.g., Project guidelines, coding standards, team preferences..."
                rows={4}
                className="w-full rounded-lg border border-input-border bg-input-background px-3 sm:px-4 py-3 text-sm sm:text-base text-text-primary placeholder-text-muted focus:border-primary focus:outline-none resize-y"
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingContext || teamContext === (currentTeam.context || '')}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {isSavingContext ? 'Saving...' : 'Save Context'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Invite Members */}
        {isAdmin && (
          <div className="mb-6 rounded-lg bg-background-secondary p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-text-primary mb-4">
              Invite Members
            </h2>
            <form onSubmit={handleInvite} className="space-y-3 sm:space-y-0 sm:flex sm:gap-4 mb-4">
              <input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="w-full sm:flex-1 rounded-lg border border-input-border bg-input-background px-3 sm:px-4 py-2 text-text-primary focus:border-primary focus:outline-none"
              />
              <div className="flex gap-3 sm:gap-4">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                  className="flex-1 sm:flex-none rounded-lg border border-input-border bg-input-background px-3 sm:px-4 py-2 text-text-primary focus:border-primary focus:outline-none"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  Invite
                </button>
              </div>
            </form>

            {inviteUrl && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 bg-transparent text-xs sm:text-sm text-text-secondary min-w-0"
                />
                <button
                  onClick={copyInviteUrl}
                  className="flex-shrink-0 text-sm text-primary hover:underline"
                >
                  Copy
                </button>
              </div>
            )}

            {/* Pending Invites */}
            {currentTeam.invites && currentTeam.invites.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-text-muted mb-2">
                  Pending Invites
                </h3>
                <div className="space-y-2">
                  {currentTeam.invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-background"
                    >
                      <div>
                        <span className="text-text-primary">{invite.email}</span>
                        <span className="ml-2 text-xs text-text-muted capitalize">
                          ({invite.role})
                        </span>
                      </div>
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        className="text-sm text-error hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Members */}
        <div className="mb-6 rounded-lg bg-background-secondary p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary mb-4">
            Members ({currentTeam.members.length})
          </h2>
          <div className="space-y-3">
            {currentTeam.members.map((member) => (
              <div
                key={member.id}
                className="p-3 rounded-lg bg-background"
              >
                {/* Desktop View */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {member.user?.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm">
                        {(member.user?.name || member.user?.email || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-text-primary">
                        {member.user?.name || member.user?.email}
                        {member.userId === user?.id && (
                          <span className="ml-2 text-xs text-text-muted">(you)</span>
                        )}
                      </div>
                      {member.user?.name && (
                        <div className="text-xs text-text-muted">
                          {member.user.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isOwner && member.userId !== user?.id && member.role !== 'owner' ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.userId, e.target.value as TeamRole)}
                        className="rounded border border-input-border bg-input-background px-2 py-1 text-sm text-text-primary"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="text-sm text-text-muted capitalize">
                        {member.role}
                      </span>
                    )}
                    {isAdmin && member.userId !== user?.id && member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-sm text-error hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile View */}
                <div className="sm:hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {member.user?.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt=""
                          className="w-10 h-10 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm flex-shrink-0">
                          {(member.user?.name || member.user?.email || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate">
                          {member.user?.name || member.user?.email}
                          {member.userId === user?.id && (
                            <span className="ml-1 text-xs text-text-muted">(you)</span>
                          )}
                        </div>
                        {member.user?.name && (
                          <div className="text-xs text-text-muted truncate">
                            {member.user.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-text-muted capitalize flex-shrink-0 ml-2">
                      {member.role}
                    </span>
                  </div>
                  {isOwner && member.userId !== user?.id && member.role !== 'owner' && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.userId, e.target.value as TeamRole)}
                        className="flex-1 rounded border border-input-border bg-input-background px-2 py-1 text-xs text-text-primary"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-xs text-error hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {isAdmin && !isOwner && member.userId !== user?.id && member.role !== 'owner' && (
                    <div className="flex justify-end mt-2 pt-2 border-t border-border">
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-xs text-error hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-error bg-error/10 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-error mb-4">
            Danger Zone
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {isOwner ? (
              <>
                <div>
                  <p className="text-sm sm:text-base text-text-primary">Archive this team</p>
                  <p className="text-xs sm:text-sm text-text-muted">
                    Team threads will be preserved but the team will be hidden
                  </p>
                </div>
                <button
                  onClick={handleArchiveTeam}
                  className="self-start sm:self-auto rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/90"
                >
                  Archive Team
                </button>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm sm:text-base text-text-primary">Leave this team</p>
                  <p className="text-xs sm:text-sm text-text-muted">
                    You will lose access to team threads
                  </p>
                </div>
                <button
                  onClick={handleLeaveTeam}
                  className="self-start sm:self-auto rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/90"
                >
                  Leave Team
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
