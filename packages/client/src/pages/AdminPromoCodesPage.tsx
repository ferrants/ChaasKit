import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { LayoutDashboard, Users, Building2, X, Mail, Tag } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { useAppPath } from '../hooks/useAppPath';
import { api } from '../utils/api';
import type {
  AdminPromoCode,
  AdminPromoCodesResponse,
  AdminCreatePromoCodeRequest,
  AdminCreatePromoCodeResponse,
  AdminUpdatePromoCodeRequest,
  AdminUpdatePromoCodeResponse,
} from '@chaaskit/shared';

export default function AdminPromoCodesPage() {
  const config = useConfig();
  const appPath = useAppPath();
  const [promoCodes, setPromoCodes] = useState<AdminPromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'scheduled'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: '',
    credits: 10,
    maxUses: 100,
    startsAt: '',
    endsAt: '',
    creditsExpiresAt: '',
  });

  async function loadPromoCodes() {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set('search', search.trim());
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      const query = params.toString();
      const response = await api.get<AdminPromoCodesResponse>(`/api/admin/promo-codes${query ? `?${query}` : ''}`);
      setPromoCodes(response.promoCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promo codes');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPromoCodes();
  }, [search, statusFilter]);

  async function handleCreatePromoCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const payload: AdminCreatePromoCodeRequest = {
        code: form.code.trim(),
        credits: Number(form.credits),
        maxUses: Number(form.maxUses),
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
        creditsExpiresAt: form.creditsExpiresAt || undefined,
      };

      const response = await api.post<AdminCreatePromoCodeResponse>('/api/admin/promo-codes', payload);
      setPromoCodes((prev) => [response.promoCode, ...prev]);
      setSuccess(`Promo code ${response.promoCode.code} created`);
      setForm({
        code: '',
        credits: 10,
        maxUses: 100,
        startsAt: '',
        endsAt: '',
        creditsExpiresAt: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create promo code');
    }
  }

  const promoEnabled = config.credits?.enabled && config.credits?.promoEnabled !== false;

  async function handleDeactivate(promo: AdminPromoCode) {
    setError('');
    setSuccess('');
    try {
      const response = await api.patch<AdminUpdatePromoCodeResponse>(`/api/admin/promo-codes/${promo.id}`, {
        endsAt: new Date().toISOString(),
      } satisfies AdminUpdatePromoCodeRequest);
      setPromoCodes((prev) => prev.map((p) => (p.id === promo.id ? response.promoCode : p)));
      setSuccess(`Promo code ${promo.code} deactivated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate promo code');
    }
  }

  async function handleReactivate(promo: AdminPromoCode) {
    setError('');
    setSuccess('');
    try {
      const response = await api.patch<AdminUpdatePromoCodeResponse>(`/api/admin/promo-codes/${promo.id}`, {
        endsAt: null,
      } satisfies AdminUpdatePromoCodeRequest);
      setPromoCodes((prev) => prev.map((p) => (p.id === promo.id ? response.promoCode : p)));
      setSuccess(`Promo code ${promo.code} reactivated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate promo code');
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy code');
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
            to={appPath('/admin/waitlist')}
            className="flex items-center gap-1.5 rounded-full bg-background-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary/80"
          >
            <Mail size={16} />
            Waitlist
          </Link>
          <span className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white">
            <Tag size={16} />
            Promo Codes
          </span>
        </div>

        {!promoEnabled && (
          <div className="mb-6 rounded-lg bg-warning/10 p-4 text-sm text-warning">
            Promo codes are disabled in config. Enable `credits.promoEnabled` to use this page.
          </div>
        )}

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 rounded-lg bg-background-secondary p-4">
            <h2 className="text-base font-semibold text-text-primary mb-4">Create Promo Code</h2>
            <form onSubmit={handleCreatePromoCode} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-primary" htmlFor="promo-code">
                  Code
                </label>
                <input
                  id="promo-code"
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                  placeholder="WELCOME10"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-primary" htmlFor="promo-credits">
                    Credits
                  </label>
                  <input
                    id="promo-credits"
                    type="number"
                    min={1}
                    value={form.credits}
                    onChange={(e) => setForm((prev) => ({ ...prev, credits: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary" htmlFor="promo-uses">
                    Max Uses
                  </label>
                  <input
                    id="promo-uses"
                    type="number"
                    min={1}
                    value={form.maxUses}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxUses: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary" htmlFor="promo-start">
                  Starts At (optional)
                </label>
                <input
                  id="promo-start"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary" htmlFor="promo-end">
                  Ends At (optional)
                </label>
                <input
                  id="promo-end"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary" htmlFor="promo-expires">
                  Credits Expire At (optional)
                </label>
                <input
                  id="promo-expires"
                  type="datetime-local"
                  value={form.creditsExpiresAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, creditsExpiresAt: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!promoEnabled}
                className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                Create promo code
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 rounded-lg bg-background-secondary overflow-hidden">
            <div className="px-4 py-3 bg-background flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[160px] rounded-lg border border-input-border bg-input-background px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-lg border border-input-border bg-input-background px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="hidden md:block px-4 py-3 bg-background">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium text-text-muted">
                <div className="col-span-3">Code</div>
                <div className="col-span-2">Credits</div>
                <div className="col-span-2">Uses</div>
                <div className="col-span-2">Active</div>
                <div className="col-span-3">Actions</div>
              </div>
            </div>

            <div className="divide-y divide-background">
              {isLoading ? (
                <div className="px-4 py-8 text-center text-text-muted">Loading...</div>
              ) : promoCodes.length === 0 ? (
                <div className="px-4 py-8 text-center text-text-muted">No promo codes yet</div>
              ) : (
                promoCodes.map((promo) => {
                  const now = new Date();
                  const startsAt = promo.startsAt ? new Date(promo.startsAt) : null;
                  const endsAt = promo.endsAt ? new Date(promo.endsAt) : null;
                  const active = (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);

                  return (
                    <div key={promo.id} className="px-4 py-3 hover:bg-background/50">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 text-sm">
                        <div className="md:col-span-3 font-medium text-text-primary flex items-center gap-2">
                          <span>{promo.code}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(promo.code)}
                            className="text-xs text-primary hover:underline"
                          >
                            {copiedCode === promo.code ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className="md:col-span-2 text-text-secondary">{promo.credits}</div>
                        <div className="md:col-span-2 text-text-secondary">
                          {promo.redeemedCount} / {promo.maxUses}
                        </div>
                        <div className={`md:col-span-2 ${active ? 'text-success' : 'text-text-muted'}`}>
                          {active ? 'Active' : 'Inactive'}
                        </div>
                        <div className="md:col-span-3 text-text-muted flex items-center gap-2">
                          <span>{new Date(promo.createdAt).toLocaleDateString()}</span>
                          <button
                            type="button"
                            onClick={() => (active ? handleDeactivate(promo) : handleReactivate(promo))}
                            className="rounded-lg border border-input-border px-2 py-1 text-xs text-text-primary hover:bg-background"
                          >
                            {active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
