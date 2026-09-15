# Motion Supply Brand OS — Final Launch Plan

This document is the single launch plan for Motion Supply Brand OS. It is intentionally stricter than a normal MVP checklist: a gate is only marked complete when the live behavior has actually been verified.

## 1. Launch principle

Do not merge or release because CI is green. Green CI proves the repository contract; it does not prove email delivery, Stripe delivery, auth redirects, deployment environment variables, mobile behavior, or real browser flows.

Release order:

1. P0 production correctness
2. Merge PR #2
3. Production deployment verification
4. Guided UX / calculator audit
5. Pricing audit
6. Mobile architecture
7. TestFlight / Play internal testing
8. Public mobile release

## 2. Current release architecture

- GitHub repository: `motionsupplyco/motion-supply-brand-os`
- P0 branch: `p0-production-hardening`
- PR #2 stays open until the remaining live gates are proven.
- Production is currently not the complete P0 code surface. Do not treat the production UI as proof that P0 auth/account features are missing from the branch.
- Browser application data must continue through same-origin `/api/*` routes.
- Supabase and Stripe secrets stay server-side only.

## 3. P0 gate board

### Verified live

- Create account
- Sign in
- Session refresh
- Stripe Checkout session creation
- Stripe subscription payment in Sandbox
- Billing Portal opens from Brand OS
- Cancellation-at-period-end behavior in Stripe
- Pro remains active while an active subscription is scheduled to cancel
- Immediate Stripe cancellation in Sandbox
- Brand OS can show Free after subscription termination
- Production Stripe webhook endpoint accepts a correctly signed Stripe event with HTTP 200
- Billing environment variables are present for the deployed environments tested

### Verified by code / database / CI but still requires live E2E where noted

- Free plan: 1 saved brand
- Free plan: 5 saved SKUs
- Pro Business Memory gate
- Duplicate checkout protection
- Billing recovery routing
- Payment-failure state handling
- Retry-safe webhook claim/retry contract on the P0 handler
- Owner-scoped data access / RLS defense in depth
- Account-deletion cascade schema
- Deletion audit retention
- Signed-in product-event deletion cascade
- API payload limit and security-header contracts

### Still blocking merge

1. **Password recovery E2E**
   - public recovery entrypoint visible
   - recovery email actually delivered
   - recovery link returns to the intended build
   - reset-password UI appears
   - new password saves
   - old password no longer signs in
   - new password signs in

2. **P0 retry-safe webhook E2E**
   - Stripe must hit the P0 webhook handler, not only the older production/main handler
   - `stripe_webhook_events` must record the event
   - duplicate resend must not double-process
   - failed/retried event must recover correctly

3. **Free-plan live limits**
   - second brand rejected with expected 402/code
   - sixth SKU rejected with expected 402/code
   - existing free data remains usable

4. **Duplicate subscription live test**
   - active/trialing Pro user cannot create a second checkout
   - canceled user can resubscribe normally

5. **Payment failure / billing recovery live test**
   - failed invoice state is stored
   - account UI warns the user
   - user is routed to Manage billing rather than duplicate checkout
   - successful recovery clears the failed state

6. **Account deletion live test**
   - active subscription canceled
   - Auth user deleted
   - user-owned rows cascade
   - signed-in product events cascade
   - deletion audit survives
   - old token is rejected afterward

7. **Two-account isolation test**
   - Account A cannot read or mutate Account B brands, SKUs, memory, snapshots, recommendations, or imports

8. **Malformed/error-path E2E**
   - malformed JSON / validation error
   - oversized request -> 413
   - unauthenticated -> 401
   - Pro required -> 402
   - missing owner resource -> 404
   - rate limit -> 429
   - controlled server error -> generic 500

## 4. Password recovery final design

Password recovery must never depend on a hidden modal alone.

Required surfaces:

- Sign-in screen: visible `Forgot password?`
- Public page: `/forgot-password.html`
- Support page: direct password-reset link
- Recovery request: `/api/auth/recover`
- Reset completion: authenticated `/api/auth/update-password`

Production requirements:

- exact production Site URL configured in Supabase
- exact production reset redirect allowlisted
- preview redirect rules only while preview testing is required
- production-grade SMTP before real launch; default/best-effort auth email delivery is not an acceptable long-term dependency
- generic response text must not reveal whether an email account exists
- server-side delivery errors and rate limits must be observable without leaking secrets

## 5. Stripe final design

### Checkout

- one recurring Pro product/price
- no second subscription for an already active/trialing account
- canceled users can subscribe again
- return URLs use exact production `APP_URL`

### Link / phone-code behavior

Stripe Link is optional. Brand OS must not require a customer to receive a Link SMS code to subscribe. If Link creates friction during launch testing, disable Link for Checkout or in the applicable Stripe payment-method configuration and keep ordinary card checkout available.

### Webhooks

Required events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Production webhook must be publicly reachable by Stripe and must not sit behind Vercel authentication protection.

P0 acceptance criteria:

- valid signed event -> 2xx
- invalid signature -> 400
- event recorded once in `stripe_webhook_events`
- duplicate delivery -> acknowledged without reprocessing
- failed processing -> retryable
- stale claim -> reclaimable after safety window

## 6. Product experience after P0

Brand OS should not feel like a folder of calculators. The main product becomes a guided operating system.

Primary entry question:

**What are you trying to solve?**

Flows:

- Not enough profit
- How much inventory should I order?
- Can I afford this drop?
- What should I charge?
- Scale my ads
- Worried about cash
- Understand my Shopify numbers
- I don't know what's wrong

Every result should follow:

1. **What's happening**
2. **Why it matters**
3. **What to do next**

Contextual actions:

- Fix My Margin
- Build a Restock Plan
- Diagnose My Ad Spend
- Can I Afford This Drop?
- See What Price I Need
- Protect My Cash
- Run Scenario
- Set This as My Guardrail

Business Memory carries context between tools so users do not repeatedly type the same assumptions.

## 7. Calculator and decision-system audit

Before public marketing, every calculation must be audited against independent examples and edge cases.

Audit areas:

- landed cost and gross margin
- target margin / required retail price
- discount ceiling
- CAC ceiling
- break-even units / revenue
- cash runway / cash checkpoint
- PO affordability
- reorder timing / safety stock assumptions
- wholesale economics
- 3PL normalization
- Shopify order de-duplication
- refunds / captured payment totals
- zero / negative / missing / malformed inputs
- currency rounding and presentation

No fake business numbers should be prefilled outside an explicitly selected demo.

## 8. Pricing plan

Do not lock public pricing until the product/retention audit is complete.

Founding price under test: **$19/month**.

If grandfathering is offered, document it explicitly as a commercial promise: the founding subscriber keeps that subscription price while continuously subscribed, subject to the final terms.

Pricing audit inputs:

- activation rate
- first-value time
- 7-day and 30-day retention
- percentage of users repeatedly using actionable workflows
- support burden
- Stripe/payment costs
- expected CAC
- willingness-to-pay interviews
- free-to-Pro conversion

## 9. Production launch checklist

Before charging non-test customers:

- custom production domain
- production `APP_URL`
- production Supabase Site URL + redirect allowlist
- production-grade SMTP
- production Stripe keys/price/webhook secret
- Stripe webhook publicly reachable
- Billing Portal configured
- real support destination
- privacy policy
- terms
- cancellation/refund wording
- monitoring/error visibility
- database backup/recovery expectations documented
- no secrets in browser bundle
- Node runtime aligned between CI and Vercel
- representative mobile Safari/Chrome testing
- representative Shopify CSV testing

## 10. Mobile app plan

Do not wrap the current web app and submit it immediately.

First make the web product production-correct. Then choose the mobile architecture based on store billing and UX requirements.

Mobile phases:

1. authenticated mobile shell / navigation
2. API reuse with server-only secrets unchanged
3. secure token storage
4. native/deep-link password recovery
5. account deletion inside the app
6. platform-compliant digital subscription billing review/implementation
7. privacy manifests / store disclosures
8. TestFlight and Play internal testing
9. crash/error instrumentation
10. accessibility and small-screen QA
11. App Store / Google Play submission

## 11. Scale plan

### 0-100 paying customers

- correctness over feature volume
- founder-led onboarding
- observe support tickets manually
- instrument activation and repeat use
- fix confusing workflows immediately

### 100-1,000 paying customers

- shared/distributed rate limiting
- stronger observability
- lifecycle email system
- support queue / SLAs
- database/index usage review
- structured billing reconciliation job
- retention cohorts

### 1,000+ paying customers

- queue background jobs
- webhook reconciliation / dead-letter workflow
- regional/performance review
- stronger incident response
- formal security review
- data-export tooling
- role/team features only if customer evidence supports them

## 12. Never ship with these conditions

Do not launch publicly if any of these are true:

- password reset link is missing or unverified
- webhook is behind deployment authentication
- subscription can remain Pro after terminal cancellation
- an active customer can create duplicate subscriptions
- a user can access another user's records
- account deletion leaves customer-owned application data unexpectedly active
- calculations contain demo/prefilled results that look like real business data
- support has no real contact path
- secrets are exposed client-side
- production deploy does not match the commit that was verified

## 13. Definition of done for PR #2

PR #2 is mergeable only when:

- CI is green on exact head SHA
- every P0 live blocker above is either PASS or explicitly documented as an external paid-plan limitation that does not break required product behavior
- production environment variables are confirmed
- password reset is proven end-to-end
- P0 webhook ledger is proven live
- billing lifecycle is proven live
- account deletion and owner isolation are proven live
- final production deployment is created from the merged commit and smoke-tested again
