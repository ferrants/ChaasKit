import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router';
import { X, Loader2, Check, BarChart3, CreditCard, ExternalLink, Key, Tag } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAppPath } from '../hooks/useAppPath';
import MCPCredentialsSection from './MCPCredentialsSection';
import OAuthAppsSection from './OAuthAppsSection';
import { api } from '../utils/api';

interface UsageData {
  messagesThisMonth: number;
  monthlyLimit: number;
  credits: number;
  plan: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const config = useConfig();
  const { theme, setTheme, availableThemes } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const appPath = useAppPath();

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [canAccessApiKeys, setCanAccessApiKeys] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Load settings and usage when modal opens, reset promo state when it closes
  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
      loadUsage();
      // Check API keys access
      if (config.api?.enabled) {
        api.get<{ canAccess: boolean }>('/api/api-keys/access')
          .then((res) => setCanAccessApiKeys(res.canAccess))
          .catch(() => setCanAccessApiKeys(false));
      }
    }
    if (!isOpen) {
      setShowPromoInput(false);
      setPromoCode('');
      setPromoResult(null);
      setPromoError(null);
    }
  }, [isOpen, user, config.api?.enabled]);

  // Reset save status after showing
  useEffect(() => {
    if (saveStatus !== 'idle') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/settings', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || {});
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadUsage() {
    try {
      const response = await fetch('/api/user/usage', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setUsageData(data);
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...settings,
          themePreference: theme,
        }),
      });

      if (response.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }

  function handleFieldChange(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleThemeChange(newTheme: string) {
    setTheme(newTheme);
  }

  async function handleOpenBillingPortal() {
    setIsBillingLoading(true);
    try {
      const response = await fetch('/api/payments/billing-portal', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
    } finally {
      setIsBillingLoading(false);
    }
  }

  function handleUpgrade() {
    onClose();
    navigate('/pricing');
  }

  async function handleRedeemPromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoResult(null);
    setPromoError(null);
    try {
      const res = await api.post<{ granted: number }>('/api/credits/redeem', { code: promoCode.trim() });
      setPromoResult(`${res.granted} credits added!`);
      setPromoCode('');
      setShowPromoInput(false);
      loadUsage();
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Failed to redeem code');
    } finally {
      setPromoLoading(false);
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-t-2xl bg-background sm:rounded-2xl"
        style={{
          maxHeight: 'calc(100vh - env(safe-area-inset-top) - 1rem)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-4 py-4 sm:px-6" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Account Info */}
              {user && (
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <h3 className="mb-2 font-medium text-text-primary">Account</h3>
                  <div className="text-sm text-text-secondary">
                    <span className="text-text-muted">Email: </span>
                    <span className="text-text-primary">{user.email}</span>
                  </div>
                </div>
              )}

              {/* Usage Metrics */}
              {usageData && (
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <BarChart3 size={18} className="text-primary" />
                    <h3 className="font-medium text-text-primary">Usage</h3>
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {usageData.plan}
                    </span>
                  </div>

                  {/* Messages Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Messages this month</span>
                      <span className="text-text-primary">
                        {usageData.messagesThisMonth.toLocaleString()}
                        {usageData.monthlyLimit > 0 ? (
                          <span className="text-text-muted"> / {usageData.monthlyLimit.toLocaleString()}</span>
                        ) : (
                          <span className="text-text-muted"> / Unlimited</span>
                        )}
                      </span>
                    </div>

                    {usageData.monthlyLimit > 0 && (
                      <div className="h-2 overflow-hidden rounded-full bg-background">
                        <div
                          className={`h-full rounded-full transition-all ${
                            usageData.messagesThisMonth / usageData.monthlyLimit > 0.9
                              ? 'bg-error'
                              : usageData.messagesThisMonth / usageData.monthlyLimit > 0.7
                              ? 'bg-warning'
                              : 'bg-primary'
                          }`}
                          style={{
                            width: `${Math.min(100, (usageData.messagesThisMonth / usageData.monthlyLimit) * 100)}%`,
                          }}
                        />
                      </div>
                    )}

                    {usageData.credits > 0 && (
                      <div className="mt-3 flex justify-between text-sm">
                        <span className="text-text-secondary">Credits remaining</span>
                        <span className="text-text-primary">{usageData.credits.toLocaleString()}</span>
                      </div>
                    )}

                    {/* Billing Actions */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={handleUpgrade}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
                      >
                        <CreditCard size={14} />
                        {usageData.plan === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                      </button>
                      {usageData.plan !== 'free' && (
                        <button
                          onClick={handleOpenBillingPortal}
                          disabled={isBillingLoading}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-background-secondary disabled:opacity-50"
                        >
                          {isBillingLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <ExternalLink size={14} />
                          )}
                          Manage Subscription
                        </button>
                      )}
                      {config.credits?.promoEnabled && (
                        <button
                          onClick={() => { setShowPromoInput(!showPromoInput); setPromoError(null); setPromoResult(null); }}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-background-secondary"
                        >
                          <Tag size={14} />
                          Redeem Code
                        </button>
                      )}
                    </div>

                    {/* Promo Code Input */}
                    {showPromoInput && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRedeemPromo()}
                          placeholder="Enter promo code"
                          className="flex-1 rounded-lg border border-input-border bg-input-background px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={handleRedeemPromo}
                          disabled={promoLoading || !promoCode.trim()}
                          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                        >
                          {promoLoading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
                        </button>
                      </div>
                    )}

                    {/* Promo Result/Error */}
                    {promoResult && (
                      <p className="mt-2 text-xs text-success">{promoResult}</p>
                    )}
                    {promoError && (
                      <p className="mt-2 text-xs text-error">{promoError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Theme Selection */}
              {config.theming.allowUserThemeSwitch && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-primary">
                    Theme
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableThemes.map((t) => (
                      <button
                        key={t}
                        onClick={() => handleThemeChange(t)}
                        className={`rounded-lg px-4 py-2 text-sm capitalize ${
                          theme === t
                            ? 'bg-primary text-white'
                            : 'bg-background-secondary text-text-secondary hover:text-text-primary active:bg-primary/10'
                        }`}
                      >
                        {config.theming.themes[t]?.name || t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* User Settings Fields */}
              {config.userSettings.fields.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={field.key}
                    className="mb-2 block text-sm font-medium text-text-primary"
                  >
                    {field.label}
                  </label>

                  {field.type === 'text' && (
                    <input
                      id={field.key}
                      type="text"
                      value={settings[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2.5 text-base text-text-primary placeholder-text-muted focus:border-primary focus:outline-none sm:text-sm"
                    />
                  )}

                  {field.type === 'textarea' && (
                    <textarea
                      id={field.key}
                      value={settings[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2.5 text-base text-text-primary placeholder-text-muted focus:border-primary focus:outline-none sm:text-sm"
                    />
                  )}

                  {field.type === 'select' && field.options && (
                    <select
                      id={field.key}
                      value={settings[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      className="w-full rounded-lg border border-input-border bg-input-background px-3 py-2.5 text-base text-text-primary focus:border-primary focus:outline-none sm:text-sm"
                    >
                      <option value="">Select...</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}

              {/* MCP Credentials Section */}
              <MCPCredentialsSection />

              {/* OAuth Connected Applications */}
              <OAuthAppsSection />

              {/* API Keys Link */}
              {config.api?.enabled && canAccessApiKeys && (
                <div className="rounded-lg border border-border bg-background-secondary p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Key size={18} className="text-primary" />
                      <div>
                        <h3 className="font-medium text-text-primary">API Keys</h3>
                        <p className="text-xs text-text-muted">Manage keys for programmatic API access</p>
                      </div>
                    </div>
                    <Link
                      to={appPath('/api-keys')}
                      onClick={onClose}
                      className="text-sm text-primary hover:underline"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3 sm:px-6 sm:py-4">
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-sm text-success">
              <Check size={16} />
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-error">Failed to save</span>
          )}
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover active:bg-primary-hover disabled:opacity-50"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
