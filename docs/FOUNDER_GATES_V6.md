# Brand OS V6 — Founder Gates: Pricing, Launch Cut Line, and Retention Kill Criteria

Last reviewed: 2026-09-13

This document converts three strategic questions into explicit operating rules. The goal is to prevent Brand OS from hiding behind vague promises such as “we need more polish” or “Business Memory needs another iteration.”

## 1. Founding Pro at $19 is a deliberate grandfather clause

**Policy:** Founding Pro is $19/month **locked while continuously subscribed**.

This is not the default pricing behavior. It is a deliberate early-cohort contract and trust incentive.

### Rules

- The promise applies only to accounts explicitly sold the Founding Pro offer.
- The $19 price remains while that subscription remains continuously active.
- If the customer cancels and later returns, the founding price is **not automatically restored** unless Motion Supply explicitly chooses to restore it.
- Future Standard Pro pricing can change for new subscribers without repricing the founding cohort.
- A future materially different plan/tier is not automatically included in the founding promise. The promise protects the Founding Pro plan, not every future product Motion Supply may create.
- Customer-facing copy must say this clearly before checkout. Do not imply “lifetime access”; say “$19/month locked while continuously subscribed.”

### Economic consequence

For the founding cohort, subscription ARPU is capped at $19/month unless the customer voluntarily buys a separate/additional product or moves to a different tier. CAC decisions for this cohort must therefore be justified using the economics of a $19/month subscription, not a hypothetical future $29 price.

Do not use uncapped future pricing to rationalize paid acquisition for founding members.

---

## 2. Pre-launch proof has a finite cut line

We are **not** trying to prove every production assumption before 50–100 customers arrive. That is impossible and delays learning. We divide assumptions into three classes.

### Class A — must be proven before taking live paid customers

These can directly lose money, expose customer data, deny paid access, corrupt decisions, or make the service unusable.

**Money / entitlement**
- live checkout creates the correct subscription
- webhook grants the correct entitlement
- Billing Portal opens for the correct customer
- cancellation/downgrade removes Pro access according to policy
- renewal keeps access
- failed/past-due payment has a defined access policy and visible state
- duplicate webhook delivery is safe/idempotent enough not to duplicate customer/subscription state
- Free limits are enforced server-side, not only in the UI

**Identity / data isolation**
- signup, confirmation, sign-in, refresh/session expiry, forgot/reset password
- User A cannot read/write User B’s brands, SKUs, snapshots, recommendations, billing references, or imports
- Supabase privileged credentials never ship to browser code
- RLS remains enabled for user-owned cloud data

**Financial correctness**
- locked financial-engine unit tests pass
- blank inputs cannot silently masquerade as real business values
- negative/impossible input handling is safe
- Pro server endpoints enforce entitlement
- imported Shopify values are labeled by source and do not pretend Orders CSV equals accounting/net-sales truth

**Operational minimum**
- production `/api/health` works
- unknown `/api/*` paths return explicit API errors rather than the SPA
- request-size limits exist
- errors do not expose secrets
- basic rate/abuse controls exist for auth and expensive/write endpoints
- support contact, Terms, Privacy, cancellation terms, data handling/deletion policy and decision-support disclaimer exist
- mobile critical flows work: sign in, checkout/return, core calculator, navigation, billing/account

If any Class A item is unproven, broad paid launch is blocked.

### Class B — may be proven under the first 50–100 customers, but must be instrumented

These require real behavior/load to learn and are safe to iterate if failures are observable and reversible.

- onboarding wording and sequence
- which recommendation creates the strongest aha moment
- which tools users revisit weekly
- Business Memory cadence
- recommendation ranking
- snapshot frequency
- history/trend presentation
- Shopify parser edge cases that do not corrupt canonical user data
- mobile polish on non-critical screens
- performance under realistic first-cohort usage
- email/support workflow quality
- pricing page conversion
- whether $19 attracts the intended founder segment

Every Class B assumption needs an owner, event/log/metric, review cadence, and rollback/fix path. “We’ll see what happens” is not a monitoring plan.

### Class C — intentionally deferred

Do not block launch on these.

- direct Shopify OAuth/sync
- multi-user teams
- advanced permissions
- native mobile app
- predictive AI/ML
- universal industry benchmarks
- sophisticated cohort LTV
- GMROI without historical inventory data
- full accounting integrations
- higher-tier packaging
- enterprise-grade scale that the first cohort cannot generate

---

## 3. First-cohort launch envelope

Launch intentionally, not infinitely.

### Cohort

- Start with 25–50 paid founding accounts.
- Expand toward 100 only if Class A remains healthy and support load is manageable.
- Do not buy meaningful paid acquisition until activation and early retention evidence exist.

### Monitoring during cohort

Review at least weekly:

- signup completion
- activation completion
- time to first recommendation
- accounts reaching a second meaningful session
- weekly active paid accounts
- core decision workflows completed
- Business Memory/history viewed when available
- checkout success/failure
- webhook failures
- entitlement mismatches
- cancellation requests and stated reason
- support tickets by category
- server/API error rate and latency

### Definition of activation for Brand OS

A signup alone is not activation.

A user is **Core Activated** when they:
1. enter one real product’s price + landed cost,
2. complete the variable-cost model sufficiently to trust contribution,
3. set a post-CAC contribution floor,
4. enter/calculate CAC,
5. receive a real Next Move recommendation.

A user is **Operating Activated** when, after Core Activation, they complete at least one recurring operating workflow such as store funnel/import, inventory/reorder, cash/PO, or return to review a changed recommendation/history.

Track both. Do not redefine activation later merely to make the number look better.

---

## 4. Retention hypothesis — falsifiable version

### Hypothesis

Clothing-brand founders will repeatedly use Brand OS because it remembers their operating state, detects meaningful changes, and produces useful next actions around economics, acquisition, inventory, and cash.

Business Memory is a mechanism. **Recurring decision value is the hypothesis.**

If users do not return to make/monitor decisions, adding more memory features is not automatically the answer.

### Evidence that supports the hypothesis

We want to see all three:

1. **Activation:** a meaningful share of qualified new paid users reaches Core Activation quickly.
2. **Return behavior:** activated founders come back without being personally chased every time.
3. **Decision behavior:** returning founders do something valuable — update/import data, review a change, run a scenario, act on/close a recommendation, or use an operating workflow. Merely opening the dashboard is weak evidence.

### Internal first-cohort thresholds

These are founder operating gates, not universal SaaS benchmarks.

After enough eligible users exist to avoid reading noise as truth:

**Green / continue investing**
- >=60% of qualified paid accounts reach Core Activation within 7 days
- >=50% of Core Activated paid accounts perform a second meaningful session within 14 days
- >=40% of Core Activated paid accounts perform a meaningful operating action in days 22–35
- >=30% of the original qualified paid cohort is still meaningfully active in days 50–70
- qualitative interviews repeatedly identify a recurring decision they would be worse off making without Brand OS

**Yellow / one focused iteration**
- Core Activation is 40–59%, or
- 14-day meaningful return is 30–49%, or
- days 22–35 meaningful operating action is 20–39%, or
- users clearly value one workflow but the rest of the product is noise.

Response: fix the specific broken step or narrow the product around the workflow that shows pull. Do not add broad features.

**Red / retention hypothesis failed in current form**
Treat the current recurring-product hypothesis as failed if, after **two materially different retention experiments** across **at least ~50 Core Activated qualified paid accounts in aggregate**, either of these remains true:

- fewer than 20% perform a meaningful operating action in days 22–35, or
- fewer than 15% are meaningfully active in days 50–70,

**and** interviews show no repeated high-value operating job that users miss when they stop using Brand OS.

At Red, do not respond with “Business Memory V3.” Stop feature expansion and reconsider the product shape: narrower single-job SaaS, episodic paid tool, service + software, different customer segment, different pricing, or a non-subscription product.

### Anti-self-deception rules

- Do not count automated emails, notifications, or page opens as meaningful retention.
- Do not count founder-assisted sessions where Motion Supply personally walks the customer through the app as organic return behavior; track them separately.
- Do not change cohort windows after seeing bad results.
- Do not mix free/demo accounts into paid retention to inflate the curve.
- Segment activated vs non-activated users.
- Record cancellation reasons verbatim and code them later.
- A feature request is not retention evidence. Repeated voluntary usage is.
- One power user does not prove PMF.

---

## 5. CAC policy while retention is unproven

Founding Pro’s grandfathered price means we must be conservative.

Before a stable retention curve exists:

- prefer founder-led, organic, partner, content and direct outreach acquisition
- treat paid acquisition as an experiment, not a scaling channel
- cap experiments by cash-at-risk, not by hypothetical LTV
- do not use assumed 12/24/36-month lifetimes to justify CAC
- report realized gross subscription revenue and observed retention separately from projected LTV

Once cohorts mature, CAC limits can be rebuilt from observed contribution after payment fees/support/variable SaaS costs and observed retention. Until then, the product should earn the right to scale acquisition.

---

## 6. Production reliability philosophy

“Prove everything” is replaced with:

> Prove what can catastrophically hurt a customer before launch. Instrument what can only be learned from customers. Defer what the first cohort does not need.

Set initial service indicators before pretending we have mature SLOs:

- availability of app/API
- p95 API latency for core endpoints
- 5xx/error rate
- checkout creation success
- webhook processing failures
- entitlement mismatch count
- auth failure anomaly rate
- import/parser failure rate

Use the first cohort to establish realistic objectives. Do not invent enterprise SLOs without measurements.

---

## 7. Decision review cadence

Every week during Founding Cohort:

**Product:** activation, return behavior, workflows used, abandoned steps.

**Customer:** interviews, support themes, cancellation reasons, missing jobs.

**Money:** MRR, realized revenue, refunds, failed payments, acquisition spend, support burden.

**Reliability:** errors, webhook failures, auth problems, entitlement mismatches, import failures.

**Decision:** Keep / Fix / Narrow / Kill for each active hypothesis.

At day 35 and again around day 70, write a cohort decision memo. No moving the goalposts without explicitly documenting why.
