import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router';
import {
  Clock,
  Plus,
  Trash2,
  Play,
  Pencil,
  Check,
  X,
  Loader2,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { useConfig, useConfigLoaded } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { useTeam } from '../contexts/TeamContext';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';
import type {
  ScheduledPromptSummary,
  ScheduledPromptDetail,
  CreateScheduledPromptRequest,
  UpdateScheduledPromptRequest,
} from '@chaaskit/shared';

const SCHEDULE_PRESETS = [
  { label: 'Every morning (9 AM)', cron: '0 9 * * *' },
  { label: 'Every evening (6 PM)', cron: '0 18 * * *' },
  { label: 'Weekdays at 9 AM', cron: '0 9 * * 1-5' },
  { label: 'Every Monday', cron: '0 9 * * 1' },
  { label: 'First of month', cron: '0 9 1 * *' },
  { label: 'Every hour', cron: '0 * * * *' },
];

interface Agent {
  id: string;
  name: string;
  isDefault?: boolean;
}

export default function ScheduledPromptsPage() {
  const config = useConfig();
  const configLoaded = useConfigLoaded();
  const { user } = useAuth();
  const { teams, currentTeam } = useTeam();
  const appPath = useAppPath();

  const [prompts, setPrompts] = useState<ScheduledPromptSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Limits info
  const [limits, setLimits] = useState<{
    context: 'personal' | 'team' | 'all';
    current: number;
    max: number;
  } | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<ScheduledPromptDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formAgentId, setFormAgentId] = useState('');
  const [formSchedule, setFormSchedule] = useState('0 9 * * *');
  const [formSchedulePreset, setFormSchedulePreset] = useState('0 9 * * *');
  const [formIsCustomSchedule, setFormIsCustomSchedule] = useState(false);
  const [formTimezone, setFormTimezone] = useState('UTC');
  const [formNotifySlack, setFormNotifySlack] = useState(true);
  const [formNotifyEmail, setFormNotifyEmail] = useState(false);
  const [formEmailRecipients, setFormEmailRecipients] = useState('');
  const [formTeamId, setFormTeamId] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const featureName = config.scheduledPrompts?.featureName || 'Scheduled Prompts';
  const teamsEnabled = config.teams?.enabled ?? false;
  const slackEnabled = config.slack?.enabled ?? false;
  const emailEnabled = config.email?.enabled ?? false;

  // Wait for config to load before checking if feature is enabled
  if (!configLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Check if feature is enabled
  if (!config.scheduledPrompts?.enabled) {
    return <Navigate to={appPath('/')} replace />;
  }

  // Load prompts and agents
  useEffect(() => {
    loadPrompts();
    loadAgents();
  }, [currentTeam]);

  async function loadPrompts() {
    setIsLoading(true);
    try {
      // If a team is selected, filter by team; otherwise filter to personal prompts
      const params = currentTeam ? `?teamId=${currentTeam.id}` : '?personal=true';
      const res = await api.get<{
        prompts: ScheduledPromptSummary[];
        limits: { context: 'personal' | 'team' | 'all'; current: number; max: number };
      }>(`/api/scheduled-prompts${params}`);
      setPrompts(res.prompts);
      setLimits(res.limits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled prompts');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAgents() {
    try {
      const res = await api.get<{ agents: Agent[] }>('/api/agents');
      setAgents(res.agents);
    } catch {
      // Ignore agent loading errors
    }
  }

  function openCreateModal() {
    setEditingPrompt(null);
    setFormName('');
    setFormPrompt('');
    setFormAgentId('');
    setFormSchedule('0 9 * * *');
    setFormSchedulePreset('0 9 * * *');
    setFormIsCustomSchedule(false);
    setFormTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setFormNotifySlack(true);
    setFormNotifyEmail(false);
    setFormEmailRecipients('');
    setFormTeamId(currentTeam?.id || '');
    setShowModal(true);
  }

  async function openEditModal(id: string) {
    try {
      const res = await api.get<{ prompt: ScheduledPromptDetail }>(`/api/scheduled-prompts/${id}`);
      const prompt = res.prompt;
      setEditingPrompt(prompt);
      setFormName(prompt.name);
      setFormPrompt(prompt.prompt);
      setFormAgentId(prompt.agentId || '');
      setFormSchedule(prompt.schedule);
      setFormSchedulePreset(SCHEDULE_PRESETS.find((p) => p.cron === prompt.schedule)?.cron || '');
      setFormIsCustomSchedule(!SCHEDULE_PRESETS.find((p) => p.cron === prompt.schedule));
      setFormTimezone(prompt.timezone);
      setFormNotifySlack(prompt.notifySlack);
      setFormNotifyEmail(prompt.notifyEmail);
      setFormEmailRecipients(prompt.emailRecipients.join(', '));
      setFormTeamId(prompt.teamId || '');
      setShowModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompt');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    const emailRecipients = formEmailRecipients
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e);

    try {
      if (editingPrompt) {
        const data: UpdateScheduledPromptRequest = {
          name: formName,
          prompt: formPrompt,
          agentId: formAgentId || null,
          schedule: formSchedule,
          timezone: formTimezone,
          notifySlack: formNotifySlack,
          notifyEmail: formNotifyEmail,
          emailRecipients,
        };

        await api.put(`/api/scheduled-prompts/${editingPrompt.id}`, data);
      } else {
        const data: CreateScheduledPromptRequest = {
          name: formName,
          prompt: formPrompt,
          agentId: formAgentId || undefined,
          schedule: formSchedule,
          timezone: formTimezone,
          notifySlack: formNotifySlack,
          notifyEmail: formNotifyEmail,
          emailRecipients,
          teamId: formTeamId || undefined,
        };

        await api.post('/api/scheduled-prompts', data);
      }

      setShowModal(false);
      await loadPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this scheduled prompt?')) {
      return;
    }

    setDeletingId(id);
    try {
      await api.delete(`/api/scheduled-prompts/${id}`);
      // Reload to get updated counts
      await loadPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRun(id: string) {
    setRunningId(id);
    try {
      await api.post(`/api/scheduled-prompts/${id}/run`, {});
      // Show a brief success message
      setError('');
      alert('Run triggered successfully. Check the thread for results.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger run');
    } finally {
      setRunningId(null);
    }
  }

  async function handleToggle(id: string, currentEnabled: boolean) {
    setTogglingId(id);
    try {
      await api.put(`/api/scheduled-prompts/${id}`, { enabled: !currentEnabled });
      setPrompts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: !currentEnabled } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle');
    } finally {
      setTogglingId(null);
    }
  }

  function formatSchedule(schedule: string): string {
    const preset = SCHEDULE_PRESETS.find((p) => p.cron === schedule);
    return preset?.label || schedule;
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <Clock size={24} className="text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">
              {featureName}
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

        {/* Description and Limits */}
        <div className="mb-6">
          <p className="text-sm text-text-secondary mb-2">
            Create prompts that run automatically on a schedule. Results are saved to a thread and notifications sent to Slack or email.
          </p>
          {limits && limits.max > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-muted">
                {currentTeam ? currentTeam.name : 'Personal'}:
              </span>
              <span className={`font-medium ${limits.current >= limits.max ? 'text-error' : 'text-text-primary'}`}>
                {limits.current} of {limits.max}
              </span>
              <span className="text-text-muted">
                {featureName.toLowerCase()} used
              </span>
            </div>
          )}
          {limits && limits.max === 0 && (
            <div className="text-sm text-text-muted">
              {currentTeam ? currentTeam.name : 'Personal'}: {featureName} not available on this plan
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-error/10 p-4 text-sm text-error flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-error hover:text-error/80">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Create Button */}
        <div className="mb-6">
          <button
            onClick={openCreateModal}
            disabled={limits !== null && limits.current >= limits.max}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            title={limits !== null && limits.current >= limits.max ? 'Plan limit reached' : undefined}
          >
            <Plus size={16} />
            Create {featureName.replace(/s$/, '')}
          </button>
        </div>

        {/* Prompts List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : prompts.length === 0 ? (
          <div className="rounded-lg border border-border bg-background-secondary p-8 text-center">
            <Clock size={48} className="mx-auto mb-4 text-text-muted" />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              No {currentTeam ? `${currentTeam.name} ` : 'Personal '}{featureName}
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              {limits && limits.max === 0
                ? `${featureName} are not available on ${currentTeam ? "this team's" : 'your'} current plan.`
                : `Create your first ${currentTeam ? 'team ' : ''}scheduled prompt to automate tasks.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className={`rounded-lg border bg-background-secondary p-4 ${
                  prompt.enabled ? 'border-border' : 'border-border/50 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-text-primary truncate">
                        {prompt.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-background text-text-muted">
                        {prompt.agentName}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                      <span>{formatSchedule(prompt.schedule)}</span>
                      {prompt.lastRunAt && (
                        <span>
                          Last: {formatDate(prompt.lastRunAt)}
                          {prompt.lastRunStatus && (
                            <span
                              className={
                                prompt.lastRunStatus === 'success'
                                  ? 'text-success ml-1'
                                  : 'text-error ml-1'
                              }
                            >
                              ({prompt.lastRunStatus})
                            </span>
                          )}
                        </span>
                      )}
                      {prompt.enabled && prompt.nextRunAt && (
                        <span className="text-primary">
                          Next: {formatDate(prompt.nextRunAt)}
                        </span>
                      )}
                      <span>{prompt.runCount} runs</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(prompt.id, prompt.enabled)}
                      disabled={togglingId === prompt.id}
                      className="p-2 rounded-lg hover:bg-background text-text-muted"
                      title={prompt.enabled ? 'Disable' : 'Enable'}
                    >
                      {togglingId === prompt.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : prompt.enabled ? (
                        <ToggleRight size={18} className="text-success" />
                      ) : (
                        <ToggleLeft size={18} />
                      )}
                    </button>

                    {/* Run Now */}
                    <button
                      onClick={() => handleRun(prompt.id)}
                      disabled={runningId === prompt.id}
                      className="p-2 rounded-lg hover:bg-background text-text-muted hover:text-primary"
                      title="Run now"
                    >
                      {runningId === prompt.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Play size={18} />
                      )}
                    </button>

                    {/* View Thread */}
                    <Link
                      to={`/chat/${prompt.id}`}
                      className="p-2 rounded-lg hover:bg-background text-text-muted hover:text-primary"
                      title="View thread"
                    >
                      <MessageSquare size={18} />
                    </Link>

                    {/* Edit */}
                    <button
                      onClick={() => openEditModal(prompt.id)}
                      className="p-2 rounded-lg hover:bg-background text-text-muted hover:text-primary"
                      title="Edit"
                    >
                      <Pencil size={18} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(prompt.id)}
                      disabled={deletingId === prompt.id}
                      className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error"
                      title="Delete"
                    >
                      {deletingId === prompt.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-background p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                {editingPrompt ? 'Edit' : 'Create'} {featureName.replace(/s$/, '')}
              </h2>
              <form onSubmit={handleSave}>
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., Daily Summary"
                      required
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Prompt *
                    </label>
                    <textarea
                      value={formPrompt}
                      onChange={(e) => setFormPrompt(e.target.value)}
                      placeholder="Enter the prompt to run..."
                      required
                      rows={4}
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary placeholder-text-muted focus:border-primary focus:outline-none resize-y"
                    />
                  </div>

                  {/* Agent */}
                  {agents.length > 1 && (
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Agent
                      </label>
                      <select
                        value={formAgentId}
                        onChange={(e) => setFormAgentId(e.target.value)}
                        className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                      >
                        <option value="">Default</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Schedule */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Schedule *
                    </label>
                    {!formIsCustomSchedule ? (
                      <>
                        <select
                          value={formSchedulePreset}
                          onChange={(e) => {
                            if (e.target.value === 'custom') {
                              setFormIsCustomSchedule(true);
                            } else {
                              setFormSchedulePreset(e.target.value);
                              setFormSchedule(e.target.value);
                            }
                          }}
                          className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                        >
                          {SCHEDULE_PRESETS.map((preset) => (
                            <option key={preset.cron} value={preset.cron}>
                              {preset.label}
                            </option>
                          ))}
                          <option value="custom">Custom cron...</option>
                        </select>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formSchedule}
                          onChange={(e) => setFormSchedule(e.target.value)}
                          placeholder="0 9 * * *"
                          required
                          className="flex-1 rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary font-mono placeholder-text-muted focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormIsCustomSchedule(false);
                            setFormSchedule(formSchedulePreset);
                          }}
                          className="px-3 py-2 text-sm text-text-muted hover:text-text-primary"
                        >
                          Presets
                        </button>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-text-muted">
                      Uses cron syntax. Example: 0 9 * * * = 9 AM daily
                    </p>
                  </div>

                  {/* Timezone */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Timezone
                    </label>
                    <input
                      type="text"
                      value={formTimezone}
                      onChange={(e) => setFormTimezone(e.target.value)}
                      placeholder="UTC"
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* Notifications */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Notifications
                    </label>
                    <div className="space-y-2">
                      {slackEnabled && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formNotifySlack}
                            onChange={(e) => setFormNotifySlack(e.target.checked)}
                            className="rounded border-input-border"
                          />
                          <span className="text-sm text-text-secondary">Slack</span>
                        </label>
                      )}
                      {emailEnabled && (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formNotifyEmail}
                              onChange={(e) => setFormNotifyEmail(e.target.checked)}
                              className="rounded border-input-border"
                            />
                            <span className="text-sm text-text-secondary">Email</span>
                          </label>
                          {formNotifyEmail && (
                            <input
                              type="text"
                              value={formEmailRecipients}
                              onChange={(e) => setFormEmailRecipients(e.target.value)}
                              placeholder="email1@example.com, email2@example.com"
                              className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Team (for new prompts) */}
                  {teamsEnabled && !editingPrompt && teams.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Owner
                      </label>
                      <select
                        value={formTeamId}
                        onChange={(e) => setFormTeamId(e.target.value)}
                        className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                      >
                        <option value="">Personal</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-background-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    {isSaving && <Loader2 size={14} className="animate-spin" />}
                    {editingPrompt ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
