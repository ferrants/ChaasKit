import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Check, Loader2, Users, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { useTeam } from '../contexts/TeamContext';

interface Plan {
  id: string;
  name: string;
  description?: string;
  type: 'free' | 'monthly' | 'credits';
  scope: 'personal' | 'team' | 'both';
  priceUSD: number;
  monthlyMessageLimit?: number;
}

export default function PricingPage() {
  const { user } = useAuth();
  const config = useConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { teams } = useTeam();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Get teamId from query params if present
  const teamIdFromParams = searchParams.get('teamId');

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (teamIdFromParams && teams.length > 0) {
      const team = teams.find((t) => t.id === teamIdFromParams);
      if (team && (team.role === 'owner' || team.role === 'admin')) {
        setSelectedTeamId(teamIdFromParams);
      }
    }
  }, [teamIdFromParams, teams]);

  async function loadPlans() {
    try {
      const response = await fetch('/api/payments/plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCheckout(planId: string) {
    if (!user) {
      navigate('/login?redirect=/pricing');
      return;
    }

    setError('');
    setCheckoutLoading(planId);

    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planId,
          teamId: selectedTeamId || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start checkout');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setCheckoutLoading(null);
    }
  }

  // Get available teams for team billing (where user is admin/owner)
  const adminTeams = teams.filter((t) => t.role === 'owner' || t.role === 'admin');

  // Filter plans based on selected context (personal vs team)
  const filteredPlans = plans.filter((plan) => {
    if (selectedTeamId) {
      return plan.scope === 'team' || plan.scope === 'both';
    }
    return plan.scope === 'personal' || plan.scope === 'both';
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-text-primary mb-4">
            Choose Your Plan
          </h1>
          <p className="text-text-secondary max-w-2xl mx-auto">
            Select the plan that best fits your needs. Upgrade or downgrade anytime.
          </p>

          {/* Team/Personal Toggle */}
          {user && adminTeams.length > 0 && (
            <div className="mt-8 inline-flex items-center gap-4 p-1 bg-background-secondary rounded-lg">
              <button
                onClick={() => setSelectedTeamId(null)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !selectedTeamId
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <User size={16} />
                Personal
              </button>
              <div className="relative">
                <select
                  value={selectedTeamId || ''}
                  onChange={(e) => setSelectedTeamId(e.target.value || null)}
                  className={`appearance-none flex items-center gap-2 px-4 py-2 pr-8 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    selectedTeamId
                      ? 'bg-primary text-white'
                      : 'bg-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <option value="">Team billing</option>
                  {adminTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <Users
                  size={16}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                    selectedTeamId ? 'text-white' : 'text-text-secondary'
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-8 rounded-lg bg-error/10 p-4 text-center text-sm text-error">
            {error}
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPlans
            .filter((plan) => plan.type !== 'credits')
            .map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl border p-6 ${
                  plan.id === 'pro'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background-secondary'
                }`}
              >
                {/* Plan Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      plan.scope === 'team'
                        ? 'bg-secondary/10 text-secondary'
                        : plan.scope === 'both'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-background text-text-muted'
                    }`}
                  >
                    {plan.scope === 'team' && <Users size={12} />}
                    {plan.scope === 'personal' && <User size={12} />}
                    {plan.scope === 'both' && (
                      <>
                        <User size={12} />
                        <span>/</span>
                        <Users size={12} />
                      </>
                    )}
                    {plan.scope === 'team'
                      ? 'Team'
                      : plan.scope === 'both'
                      ? 'Personal or Team'
                      : 'Personal'}
                  </span>
                  {plan.id === 'pro' && (
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
                      Popular
                    </span>
                  )}
                </div>

                {/* Plan Name & Price */}
                <h3 className="text-xl font-bold text-text-primary">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-text-primary">
                    ${plan.priceUSD}
                  </span>
                  {plan.type === 'monthly' && (
                    <span className="text-text-muted">/month</span>
                  )}
                </div>

                {plan.description && (
                  <p className="mt-2 text-sm text-text-secondary">{plan.description}</p>
                )}

                {/* Features */}
                <ul className="mt-6 space-y-3">
                  <li className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check size={16} className="mt-0.5 text-success shrink-0" />
                    <span>
                      {plan.monthlyMessageLimit === -1
                        ? 'Unlimited messages'
                        : `${plan.monthlyMessageLimit?.toLocaleString()} messages/month`}
                    </span>
                  </li>
                  {plan.type === 'monthly' && (
                    <li className="flex items-start gap-2 text-sm text-text-secondary">
                      <Check size={16} className="mt-0.5 text-success shrink-0" />
                      <span>Priority support</span>
                    </li>
                  )}
                  {plan.scope === 'team' && (
                    <li className="flex items-start gap-2 text-sm text-text-secondary">
                      <Check size={16} className="mt-0.5 text-success shrink-0" />
                      <span>Shared message pool for all team members</span>
                    </li>
                  )}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={plan.type === 'free' || checkoutLoading === plan.id}
                  className={`mt-6 w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    plan.type === 'free'
                      ? 'bg-background-secondary text-text-muted cursor-default'
                      : plan.id === 'pro'
                      ? 'bg-primary text-white hover:bg-primary-hover'
                      : 'bg-background text-text-primary border border-border hover:bg-background-secondary'
                  } disabled:opacity-50`}
                >
                  {checkoutLoading === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : plan.type === 'free' ? (
                    'Current Plan'
                  ) : (
                    'Get Started'
                  )}
                </button>
              </div>
            ))}
        </div>

        {/* Credits Section */}
        {filteredPlans.some((p) => p.type === 'credits') && (
          <div className="mt-12 rounded-xl border border-border bg-background-secondary p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  Need more messages?
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  Buy credits to use when you exceed your monthly limit.
                </p>
              </div>
              <Link
                to={user ? '/settings' : '/login'}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Buy Credits
              </Link>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-text-muted hover:text-text-primary">
            Back to {config.app.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
