# Motion Supply Brand OS — Multi-Million-Dollar Product Plan

Last updated: 2026-09-13

## North star

Brand OS should not be a calculator collection. It should become a clothing-brand operating system that understands the business, remembers changes, identifies financial risk/opportunity, explains why, and guides the founder toward the next decision.

**Product loop:** connected data → normalized business state → financial engine → business memory → risk/opportunity rules → prioritized next moves → action → new results.

## Information architecture target

### 1. Command Center
- Business Health
- Your 3 Moves
- profitability, acquisition, inventory and cash status
- data freshness/source indicators
- period-over-period changes
- unresolved warnings

### 2. Products & Profit
Combine the current Profit & Pricing and Discount Ceiling concepts around a product/SKU model.
- price and landed cost
- complete variable-cost stack
- pre/post-CAC contribution
- discount/affiliate scenarios
- price-change scenarios
- SKU-level saved economics

### 3. Growth & Sales
Combine CAC and Store Funnel into one acquisition workflow.
- observed/calculated CAC
- maximum first-order CAC
- funnel stages
- period comparison
- source/date-range labels
- later: LTV/repeat purchase and channel data when source quality supports it

### 4. Inventory & Operations
Group Inventory, PO planning and 3PL decisions.
- demand/lead-time review point
- inventory position and cover
- proposed reorder scenario
- PO cash handoff
- fulfillment comparison
- later: direct SKU/variant inventory sync and purchase-order history

### 5. Cash & Decisions
Group Cash Checkpoint, PO Cash Gate, Launch and Wholesale decision models where cash timing matters.
- protected cash floor
- commitment timeline
- supplier balances
- launch break-even
- wholesale contribution/receivables
- later: 13-week cash-flow module or integration rather than pretending the quick checkpoint is one

### 6. Data & Integrations
- Shopify import now
- direct Shopify connection later
- payment/ad/fulfillment integrations only when metric definitions are controlled
- import history, source, freshness and reconciliation status

### 7. Learn
- searchable Founder Handbook
- glossary
- worked Foundry Eight demo
- contextual “What does this mean?” help
- first-run guided setup

### 8. Account & Settings
- profile and plan
- billing portal
- password reset
- email verification state
- export data
- delete account
- legal/support links

## P0 — before charging broadly

1. Complete mobile QA on current iPhone/Android widths and desktop.
2. Verify every financial calculation against locked unit tests and edge cases.
3. Verify Stripe checkout, portal, cancellation, downgrade, renewal/update and failed-payment entitlement behavior.
4. Verify account isolation with at least two real test users.
5. Add password-reset flow and clear email-verification UX.
6. Add Terms, Privacy, subscription/cancellation/refund language, support contact and estimates disclaimer.
7. Remove tracked dependencies/build artifacts from repository history going forward; keep node_modules ignored.
8. Add production error monitoring, structured server logs and uptime monitoring.
9. Add automated deployment checks so a broken build cannot silently become production.
10. Test Shopify parser with multiple real exports and malformed/edge-case CSVs.
11. Accessibility pass: labels, keyboard flow, focus state, modal behavior, contrast and touch targets.
12. Backup/recovery procedure for Supabase data.

## P1 — retention and product-market fit

1. Business Memory: daily/weekly snapshots of normalized business state.
2. Trend engine: compare current values with prior snapshots using consistent source definitions.
3. Advisor V2: evidence, calculation, severity, affected area, recommended action and historical context for every recommendation.
4. “Your 3 Moves” Command Center.
5. Saved product economics linked to SKUs instead of one global local model.
6. Decision history: what the founder modeled, chose and what happened afterward.
7. Data freshness labels and stale-input warnings.
8. Guided beginner setup and contextual handbook links.
9. Email/in-app weekly operating brief when enough real data exists.

## P2 — scale

1. Direct Shopify integration with secure OAuth and scoped permissions.
2. Automated product/order/inventory synchronization.
3. Variant/size-level inventory planning.
4. Cohort/repeat-purchase and LTV layer when reliable customer/order history is connected.
5. Channel acquisition imports with explicit attribution definitions.
6. Team roles and multi-user organizations.
7. Multi-store/multi-brand rollups.
8. Audit log for important account/data actions.
9. API/webhooks for partners.
10. Enterprise security/compliance work only when customer segment requires it.

## Product rules

- Never invent business data.
- Never label missing data as healthy.
- Never hide metric source/date range.
- Never present a planning estimate as accounting truth.
- Never recommend a PO from demand alone; cash must be part of the decision.
- Never recommend scaling acquisition from revenue alone; contribution must be part of the decision.
- Use the founder's own history before generic benchmarks whenever enough comparable history exists.
- Every recommendation must answer: what changed, why it matters, how it was calculated, what to do next, and what could make the conclusion wrong.

## Competitive direction

Large ecommerce analytics platforms increasingly unify real-time business data, attribution, product analysis, inventory and AI-assisted recommendations. Brand OS should not try to win by cloning their breadth. It should win earlier in the founder journey with clothing-brand-specific decisions, transparent math, education, cash discipline and a lower-friction operating workflow.

## Pricing architecture to test

- Free — core economics, CAC/funnel basics, 1 brand, 5 SKUs, limited Advisor.
- Founding Pro — $19/month locked while continuously subscribed for early adopters.
- Pro — target $29/month after founding cohort, subject to willingness-to-pay testing.
- Scale — $59–$79/month only after automation, direct integrations, history and team/multi-store value justify it.

Do not add a higher tier just to raise ARPU. Tie every tier to a clear increase in recurring value or operational leverage.

## Success metrics

Activation should mean a user has completed enough real inputs to receive a trustworthy first decision—not merely created an account.

Track:
- visitor → signup
- signup → activated model
- activation → first Advisor action
- free → paid
- week-1/week-4 retained operators
- weekly active paid accounts
- number of real decision workflows completed
- cancellation reason
- support issue category
- time to first useful result
- percentage of recommendations with fresh inputs

Revenue metrics:
- MRR / ARR
- paid accounts
- ARPA
- gross margin
- payment failure/churn
- logo churn and revenue churn
- expansion revenue when higher tiers exist
- CAC and CAC payback only after acquisition spend is measured reliably

## Definition of launch-ready

Launch-ready means the product is understandable by a beginner, trustworthy enough for its stated decision-support scope, resilient on mobile/desktop, secure enough for the data it stores, supportable when something fails, legally presented for subscription sales, and instrumented well enough to know whether customers activate, retain and pay.
