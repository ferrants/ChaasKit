export type PlanType = 'free' | 'monthly' | 'credits';

// Who can subscribe to this plan
export type PlanScope = 'personal' | 'team' | 'both';

export interface FreePlanParams {
  monthlyMessageLimit: number;
}

export interface MonthlyPlanParams {
  priceUSD: number;
  monthlyMessageLimit: number;
  stripePriceId: string;
  seatBased?: boolean;        // For team plans, charge per seat
  pricePerSeatUSD?: number;   // Price per team member
}

export interface CreditsPlanParams {
  pricePerCredit: number;
  messagesPerCredit: number;
}

export interface PaymentPlan {
  id: string;
  name: string;
  description?: string;
  type: PlanType;
  scope?: PlanScope;  // Defaults to 'personal' if not specified
  params: FreePlanParams | MonthlyPlanParams | CreditsPlanParams;
}

// Team subscription info
export interface TeamSubscription {
  teamId: string;
  plan: string;
  planName: string;
  messagesThisMonth: number;
  monthlyLimit: number;
  credits: number;
  hasStripeCustomer: boolean;
}

// Billing context for determining which entity to charge
export interface BillingContext {
  type: 'personal' | 'team';
  entityId: string;
  plan: string;
  credits: number;
  messagesThisMonth: number;
  monthlyLimit: number;
}

export interface Subscription {
  id: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export interface BillingPortalSession {
  url: string;
}
