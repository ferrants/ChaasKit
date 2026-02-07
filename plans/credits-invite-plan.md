# Credits, Invites, and Metering Plan (Wishlist 1-4)

Date: 2026-02-06

## Scope (Items 1-4)
1. Public config boundary (no plan IDs, agent prompts, or secrets in client config).
2. Invite-only and gated signups (closed/caps/timed windows) with waitlist and admin invite flow.
3. Credit grants + promo codes (expiring credits, FIFO by soonest expiry), referral credits.
4. Token-based credits with prompt/completion metering across supported providers.

## Decisions and Requirements
- Public config must exclude secrets, plan IDs, agent prompts, internal feature flags.
- Invite gating supports: `open`, `invite_only`, `closed`, `timed_window`, `capacity_limit`.
- Waitlist required, with admin UI at `/admin` for list + invite action.
- Invite tokens: single-use, configurable expiration (days) via config.
- Credits:
  - Expiring credits supported; spend order is earliest expiry first.
  - Team vs personal credits: spend based on context (team usage spends team credits; otherwise personal).
  - Promo codes: max uses, one use per user, time-limited availability window.
- Referral credits:
  - Configurable triggers: `signup`, `first_message`, `paying` (one or multiple enabled).
- Token metering:
  - Track prompt and completion tokens separately per message.
  - Supported providers that expose token usage.
- Ledger is source of truth; `credits_balance` table updated transactionally with ledger and can be recalculated.

## Data Model (Draft)
- waitlist_entry
  - id, email, name, createdAt, invitedAt, invitedByUserId, status
- invite_token
  - id, token, email, createdAt, expiresAt, usedAt, usedByUserId, createdByUserId
- credits_ledger
  - id, ownerType (`user` | `team`), ownerId, delta, currency (`credits`),
    reason, sourceType (promo/referral/admin/grant/usage),
    expiresAt?, createdAt, metadata (json)
- credits_balance
  - ownerType, ownerId, balance, updatedAt
- promo_code
  - id, code, maxUses, startsAt, endsAt, createdAt
- promo_code_redemption
  - id, promoCodeId, userId, redeemedAt
- referral
  - id, referrerUserId, referredUserId, createdAt, status
- usage_meter
  - id, provider, model, promptTokens, completionTokens,
    totalTokens, userId, teamId?, messageId?, createdAt

## Config Additions (Draft)
- publicConfig: explicit allowlist mapping of safe fields
- auth.gating:
  - mode: `open` | `invite_only` | `closed` | `timed_window` | `capacity_limit`
  - inviteExpiryDays
  - windowStart?, windowEnd?
  - capacityLimit?
  - waitlistEnabled
- credits:
  - enabled
  - expiryEnabled
  - referralTriggers: { signup: bool, firstMessage: bool, paying: bool }
  - promoEnabled
- metering:
  - enabled
  - recordPromptCompletion: true

## API Endpoints (Draft)
- POST /api/auth/waitlist (join waitlist)
- GET /api/admin/waitlist (list)
- POST /api/admin/waitlist/:id/invite (send invite)
- POST /api/auth/invite/accept (redeem invite token)
- POST /api/credits/redeem (promo code redemption)
- POST /api/credits/grant (admin grant, internal)
- GET /api/credits/balance
- POST /api/usage/record (internal, from agent service)

## Implementation Phases
1. Config & public config boundary
2. Schema + server services for gating/waitlist/invites
3. Credits ledger + balance updates, promo + referral flows
4. Token metering integration from agent service
5. Admin UI at `/admin`
6. Tests for config leak, gating rules, credits spend order, promo redemption limits, and metering

## Test Plan (High Level)
- Config: ensure secrets never in public config response
- Auth gating: open/invite_only/closed/timed_window/capacity_limit
- Waitlist: join + admin invite creates token and marks invited
- Invite token: expiration, single-use, bypass when closed/capped
- Credits: ledger and balance sync, expiry FIFO, team vs personal
- Promo: max uses, one use per user, time window
- Referrals: triggers grant credits
- Metering: prompt/completion token capture, per message record
