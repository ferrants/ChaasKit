import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { Users, Building2, X, LayoutDashboard, Mail, Tag } from 'lucide-react';
import { api } from '../utils/api';
import { useConfig } from '../contexts/ConfigContext';
import { useAppPath } from '../hooks/useAppPath';
import type { AdminStats, FeedbackStats, UsageDataPoint, AdminUsageResponse } from '@chaaskit/shared';
import UsageChart from '../components/UsageChart';

type UsageMetric = 'messages' | 'inputTokens' | 'outputTokens' | 'totalTokens';

export default function AdminDashboardPage() {
  const config = useConfig();
  const appPath = useAppPath();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Usage chart state
  const [usage, setUsage] = useState<UsageDataPoint[]>([]);
  const [usagePeriod, setUsagePeriod] = useState(30);
  const [usageMetric, setUsageMetric] = useState<UsageMetric>('messages');
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError('');

      try {
        const [statsResponse, feedbackResponse] = await Promise.all([
          api.get<AdminStats>('/api/admin/stats'),
          api.get<FeedbackStats>('/api/admin/feedback?limit=5'),
        ]);
        setStats(statsResponse);
        setFeedback(feedbackResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load admin data');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Fetch usage data
  useEffect(() => {
    async function loadUsage() {
      setIsLoadingUsage(true);
      try {
        const response = await api.get<AdminUsageResponse>(`/api/admin/usage?days=${usagePeriod}`);
        setUsage(response.usage);
      } catch (err) {
        console.error('Failed to load usage data:', err);
        setUsage([]);
      } finally {
        setIsLoadingUsage(false);
      }
    }

    loadUsage();
  }, [usagePeriod]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-background-secondary rounded mb-6 sm:mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-background-secondary rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-lg bg-error/10 p-4 text-error">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const planColors: Record<string, string> = {
    free: 'bg-gray-400',
    basic: 'bg-blue-400',
    pro: 'bg-purple-400',
    enterprise: 'bg-green-400',
  };

  const totalPlanUsers = Object.values(stats.planDistribution).reduce((a, b) => a + b, 0);

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
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white"
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            subtitle={`+${stats.newUsersLast30Days} last 30 days`}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
          <StatCard
            title="Active Teams"
            value={stats.totalTeams}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            title="Total Threads"
            value={stats.totalThreads}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            }
          />
          <StatCard
            title="Total Messages"
            value={stats.totalMessages}
            subtitle={`${stats.messagesLast30Days.toLocaleString()} last 30 days`}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>

        {/* Usage Chart */}
        <div className="rounded-lg bg-background-secondary p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-text-primary">
              Usage Over Time
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {/* Period selector */}
              <div className="flex rounded-lg bg-background overflow-hidden">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setUsagePeriod(days)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      usagePeriod === days
                        ? 'bg-primary text-white'
                        : 'text-text-muted hover:text-text-primary hover:bg-background-secondary'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>

              {/* Metric dropdown */}
              <select
                value={usageMetric}
                onChange={(e) => setUsageMetric(e.target.value as UsageMetric)}
                className="rounded-lg border border-input-border bg-input-background px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="messages">Messages</option>
                <option value="inputTokens">Input Tokens</option>
                <option value="outputTokens">Output Tokens</option>
                <option value="totalTokens">Total Tokens</option>
              </select>
            </div>
          </div>

          <UsageChart data={usage} metric={usageMetric} isLoading={isLoadingUsage} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Plan Distribution */}
          <div className="rounded-lg bg-background-secondary p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Plan Distribution
            </h2>
            <div className="space-y-4">
              {Object.entries(stats.planDistribution).map(([plan, count]) => {
                const percentage = totalPlanUsers > 0 ? (count / totalPlanUsers) * 100 : 0;
                return (
                  <div key={plan}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-primary capitalize">
                        {plan}
                      </span>
                      <span className="text-sm text-text-muted">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div
                        className={`h-full ${planColors[plan] || 'bg-gray-400'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feedback Summary */}
          <div className="rounded-lg bg-background-secondary p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Feedback Summary
            </h2>
            {feedback && (
              <>
                <div className="flex items-center gap-8 mb-6">
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-success" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                    </svg>
                    <span className="text-2xl font-bold text-text-primary">
                      {feedback.totalUp}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-error" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                    </svg>
                    <span className="text-2xl font-bold text-text-primary">
                      {feedback.totalDown}
                    </span>
                  </div>
                </div>

                {feedback.recentFeedback.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-text-muted mb-2">
                      Recent Feedback
                    </h3>
                    <div className="space-y-2">
                      {feedback.recentFeedback.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-background"
                        >
                          {item.type === 'up' ? (
                            <svg className="w-4 h-4 text-success flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-error flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                            </svg>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary truncate">
                              {item.message.content}
                            </p>
                            {item.comment && (
                              <p className="text-xs text-text-muted mt-1">
                                "{item.comment}"
                              </p>
                            )}
                            <p className="text-xs text-text-muted mt-1">
                              by {item.user.name || item.user.email}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-background-secondary p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-text-muted">{title}</span>
        <span className="text-text-muted">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-text-primary">
        {value.toLocaleString()}
      </div>
      {subtitle && (
        <p className="text-sm text-text-muted mt-1">{subtitle}</p>
      )}
    </div>
  );
}
