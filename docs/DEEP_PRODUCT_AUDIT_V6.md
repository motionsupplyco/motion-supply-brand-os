# Motion Supply Brand OS - Deep Product Audit and V6 Operating Plan

Last reviewed: 2026-09-13

## Executive decision

Brand OS should **not** become a collection of more calculators. The current financial tools are directionally strong, but the product needs to feel like one connected operating system with a clear sequence, persistent business memory, source-aware data, and recurring decisions.

The product promise should remain:

> Your store tells you what happened. Brand OS tells you whether the next decision makes financial sense.

The next evolution should become:

> Connect your brand -> Brand OS understands the business -> detects risks and opportunities -> tells you what to do next -> shows the financial impact -> remembers what happened after the decision.

## Product architecture

CUSTOMER DATA
-> NORMALIZATION
-> FINANCIAL ENGINE
-> BUSINESS STATE
-> BUSINESS MEMORY
-> RISK / OPPORTUNITY RULES
-> NEXT MOVE ADVISOR
-> ACTION
-> NEW RESULTS
-> BUSINESS MEMORY

The missing monetizable layer is not another calculator. It is the loop between current state, history, recommendation, action, and outcome.

---

# 1. Information architecture

The existing tools make more sense when organized as five connected workspaces.

## A. Command Center

- Business Health
- Next Move Advisor
- Business Memory / trends (V6)
- Data freshness and source labels (V6)

Purpose: answer **What deserves attention right now?**

## B. Make Money

- Profit & Pricing
- Customer Acquisition
- Discount Ceiling
- Launch & Break-Even

Purpose: answer **Does this customer/order/offer create enough contribution to justify scaling it?**

These tools should eventually feel like one Unit Economics workspace with tabs/scenarios rather than four unrelated calculators.

## C. Read the Store

- Store Funnel
- Shopify Import
- Period comparisons (V6)
- Product/SKU performance (V6)
- Customer/retention layer when trustworthy data is available (later)

Purpose: answer **What happened, where did performance change, and which source proves it?**

## D. Protect Cash

- Inventory & Reorder
- Cash Checkpoint
- PO Cash Gate
- 3PL Decision
- 13-week cash runway (V6)

Purpose: answer **Can the business fund inventory and operations without creating a cash problem?**

Inventory and cash belong together because inventory is working capital, not merely units on a shelf.

## E. Expand & Organize

- Wholesale Economics
- Brands & SKUs
- Wholesale account economics/history (later)
- Saved SKU economics/history (V6)

Purpose: answer **Can the brand expand channels without destroying economics or operational control?**

---

# 2. What is already strong

## Blank-first behavior

Fresh users are not shown fake business health from demo/default values. This is essential for trust.

## Decision-specific calculations

The strongest calculations are those tied directly to expensive decisions:

- contribution before acquisition
- first-order CAC ceiling
- discount floor
- break-even orders
- reorder review point
- protected cash floor
- PO payment timeline
- normalized 3PL cost
- wholesale contribution

## Source separation

Manual planning inputs, demo data, and Shopify imports are labeled separately. Continue this discipline.

## Free/Pro model

Free proves core value. Pro should increasingly own recurring monitoring, history, saved operating context, and deeper decision workflows rather than simply hiding calculators.

---

# 3. P0 - must be trustworthy before broad paid launch

## Billing lifecycle

Current subscription activation works, but production readiness requires the whole lifecycle.

Required:

- Customer Portal verified end-to-end
- cancellation and downgrade verified
- resubscribe verified
- subscription status refresh after portal return
- failed payment state visible to the customer
- payment-action-required state visible when applicable
- Stripe Smart Retries / recovery settings reviewed
- webhook events for invoice payment failures and successful renewals considered
- clear access policy for past_due / unpaid / canceled states

Reason: subscription businesses are asynchronous. Successful checkout is only the first billing event.

## Account lifecycle

Required:

- forgot password
- password reset completion
- clearer email-confirmation state
- sign-out/session-expiry behavior
- export my data
- delete account
- deletion policy for cloud rows and billing references

## API behavior

Required:

- explicit JSON 404 for unknown `/api/*` routes before SPA fallback
- consistent definition of `billingConfigured` between public config and health endpoint
- structured error codes for important client states
- request-size limits appropriate to each endpoint

## Security

Required:

- keep Supabase secret key server-only
- verify no secret is in repository/frontend bundles
- keep RLS on all user-owned tables
- index owner/user columns used by RLS and common queries
- consider RLS performance patterns as data grows
- move in-memory rate limiting to a durable/serverless-compatible strategy before meaningful traffic
- add a production-safe Content Security Policy
- add HSTS on HTTPS production responses
- review CORS assumptions if APIs are ever separated from the same origin
- centralized structured logging without secrets or customer CSV rows

## Data correctness

Required:

- retain existing automated financial-engine tests
- add browser/integration tests for the happy path and locked Pro paths
- add account-isolation test with two real test users
- test Shopify CSV parser against exports from multiple stores/date ranges
- test subscription downgrade actually locks server-side Pro endpoints

---

# 4. P1 - product clarity and activation

## Beginner onboarding

The first useful experience should not be a feature tour. It should lead to a business result.

Recommended activation sequence:

1. Enter one product's price and landed cost.
2. Complete variable order costs.
3. Choose post-CAC contribution floor.
4. Enter CAC or calculate it.
5. Receive first real recommendation.

Then ask for funnel, inventory, and cash data.

The user should reach a useful answer before being asked to configure every part of the app.

## Persistent Start Here guide

The in-product beginner guide should remain available from every page and explain:

- the question each tool answers
- where to get each input
- how tools feed one another
- common beginner mistakes
- what the output does and does not prove

## Tool page standard

Every operating tool should eventually use one consistent structure:

1. **Business question** - what decision is this tool for?
2. **Before you start** - which upstream inputs must be complete?
3. **Inputs** - where to find each number.
4. **Result** - one primary decision output.
5. **Why it matters** - plain-English explanation.
6. **What changed it** - key drivers / sensitivity.
7. **What to do next** - link to downstream tool.
8. **Limitations** - what the result does not prove.

This reduces the feeling of navigating calculators.

---

# 5. P1 - Brands & SKUs needs to become real business memory

Current cloud saving is useful but underpowered.

The server accepts more SKU economics than the current UI collects. The saved SKU model should capture at minimum:

- SKU
- product name
- retail price
- landed cost
- on-hand units
- brand

Later:

- variant/size/color
- target contribution floor
- supplier
- supplier lead time
- reorder parameters
- packaging profile
- active/discontinued state

Important: do not duplicate data users already imported from Shopify if the app can reliably map it.

---

# 6. P1 - Business Memory is the retention engine

The backend already has snapshot and recommendation-history foundations. V6 should make them useful.

## Automatic snapshots

Create snapshots when meaningful state changes, not every keystroke. Useful cadence:

- after an import
- after a saved operating decision
- weekly scheduled snapshot for active Pro brands

## History UI

Command Center should show:

- current value
- previous comparable value
- absolute/percentage change when mathematically appropriate
- source
- date range
- freshness
- whether the value is manual, imported, or derived

## Recommendation history

Each recommendation should store:

- rule key
- priority
- title
- evidence values
- source/freshness
- timestamp
- whether user marked it done/ignored
- outcome at next snapshot when measurable

The differentiator becomes: Brand OS remembers what it told the founder and whether the business improved afterward.

---

# 7. P2 - Unit Economics workspace V2

Profit, CAC, Discounts, and Launch currently share upstream math. V6 should make this explicit.

Recommended workspace:

## Product economics

Price, landed cost, packaging, shipping subsidy, return reserve, processing.

## Acquisition

Required post-CAC floor, observed CAC, calculated CAC.

## Offer scenarios

Compare full price and user-defined offers rather than only hard-coded discount levels.

Scenario inputs can include:

- discount %
- affiliate commission
- free-shipping subsidy change
- expected CAC
- bundle/offer price later

Outputs:

- realized price
- pre-CAC contribution
- contribution after CAC
- pass/watch/fail vs user's floor

## Launch scenario

Fixed launch spend + inventory available + expected CAC + offer scenario.

This creates one coherent answer: **Can I afford this offer and how many orders recover the launch?**

---

# 8. P2 - Store Performance workspace V2

The current funnel is useful, but the recurring value comes from comparison.

Add only with trustworthy source data:

- period-over-period conversion
- AOV
- units/order
- new vs returning customer split
- repeat purchase rate
- return/refund rate by SKU
- revenue/contribution by SKU
- traffic source / channel when available

Avoid walls of KPIs. Organize metrics by the decision they support.

The app should never silently adopt a universal conversion benchmark as a PASS/FAIL threshold.

---

# 9. P2 - Inventory V2

Current reorder math is a useful planning trigger. Expand it into a working-capital view.

Potential additions when source data supports them:

- sell-through
- days/weeks of inventory remaining
- inventory value at cost
- stockout risk by SKU/variant
- slow-moving inventory
- inventory turnover
- GMROI
- size/color concentration risk
- historical demand pace
- PO arrival calendar

Important: GMROI and inventory turnover need period and average inventory data. Do not calculate them from one current inventory snapshot and pretend they are historical metrics.

---

# 10. P2 - Cash workspace V2

Cash Checkpoint is deliberately a quick model. The bigger paid tool should be a **13-week Cash Runway**.

Weekly rows:

- beginning cash
- DTC payouts
- wholesale collections
- other inflows
- payroll
- supplier deposits
- supplier balances
- freight/duties
- taxes
- marketing
- software/overhead
- other committed outflows
- ending cash
- headroom vs protected floor

Then the PO Gate should be able to place proposed supplier payments onto the runway rather than duplicating a separate cash model.

This is a major opportunity to combine two current tools into a stronger paid workflow.

---

# 11. P2 - 3PL Decision V2

The current normalized-cost comparison is useful but intentionally narrow. Real 3PL quotes often require more line items.

Recommended configurable inputs:

- receiving fees
- storage
- pick/pack base
- additional-item pick
- packaging/materials
- account/platform fee
- monthly minimum
- returns processing
- B2B/carton/pallet handling
- kitting/inserts
- postage basis / pass-through assumptions
- implementation/transition cost

Keep a clear separation between **cost-only result** and **vendor-quality decision**.

Service/operating checklist:

- SLA/cutoff time
- inventory accuracy
- claims/error policy
- returns
- integrations
- support response time
- peak capacity
- wholesale capability
- exit/transition terms

---

# 12. P2 - Wholesale V2

Current wholesale contribution is a good first gate. Expand it to the commercial terms that change cash and profitability.

Add:

- MOQ / opening order minimum
- case packs
- freight responsibility
- payment terms / net terms
- deposit
- rep/marketplace commission
- returns / markdown allowance
- discounts / tier pricing
- expected reorder cadence
- account receivable timing

Recurring B2B metrics later:

- reorder rate by account
- revenue per account
- average order value per account
- aging / collection timing
- contribution by account

---

# 13. Growth layer - retention, not just acquisition

Brand OS currently emphasizes first-order economics. That is appropriate for an MVP, but growth-stage brands need retention context.

Later data-backed layer:

- new vs returning customers
- repeat purchase rate
- purchase frequency
- customer lifetime contribution, not only revenue LTV
- cohort retention
- CAC payback / acquisition recovery

Do not bolt on LTV:CAC from a guessed LTV. Require a defensible historical source or label the value as an estimate.

---

# 14. Visual/product design direction

Brand OS should feel premium, focused, and operational - not like a generic admin template.

Keep:

- dark navigation
- warm off-white workspace
- gold accent
- restrained status colors
- strong typography hierarchy

Improve:

- grouped sidebar workspaces
- persistent Start Here/help
- progress and data-freshness states
- comparison arrows only when comparable historical data exists
- visual hierarchy around one primary result per tool
- compact secondary formulas behind expandable details
- mobile-first card stacking
- meaningful empty states with a next action

Avoid:

- decorative charts with no decision attached
- excessive gradients
- dozens of colored KPI cards
- fake gauges/scores
- benchmark red/green states not grounded in the user's own business constraints

---

# 15. SaaS business model

## Free

Purpose: prove the product's logic and reach the first useful recommendation.

- Product Economics
- CAC
- Store Funnel
- limited Advisor
- one brand
- five SKUs
- demo

## Founding Pro - $19/month while subscribed

Purpose: recurring operating layer.

- advanced decision tools
- unlimited saved brands/SKUs
- Shopify imports
- snapshots/history
- full Advisor
- cash/PO/inventory workflows
- future Business Memory

## Standard Pro - later around $29/month

Use after the recurring/history layer is genuinely valuable.

## Higher tier - only after value exists

Potential $49-$79+ tier can be justified by direct Shopify sync, automated monitoring, multi-brand/team support, richer inventory/cash planning, exports, and deeper historical reporting.

Do not raise price simply by locking more calculators.

---

# 16. Analytics / product instrumentation

Track activation and retention events that answer product questions.

Required funnel:

- landing viewed
- signup started
- signup completed
- first product economics completed
- CAC floor completed
- first real recommendation received
- second session
- Pro page viewed
- checkout started
- paid
- billing portal opened
- canceled
- failed renewal / recovered renewal where possible

Tool usage should be analyzed by account state and lifecycle, but avoid collecting sensitive raw business/customer data merely for product analytics.

---

# 17. Engineering / repository hygiene

- `node_modules` should not remain committed to source control.
- Add/verify `.gitignore` for `node_modules`, `.env`, logs, OS files and local build artifacts.
- Commit a lockfile intentionally.
- Add CI to run tests and syntax checks on every pull request / main push.
- Keep production secrets only in hosting secret/environment storage.
- Add deployment smoke check for `/api/health` plus static app response.
- Introduce release notes/changelog discipline as the product becomes paid.

---

# 18. Legal / support / customer trust

Before live paid launch:

- Terms of Service
- Privacy Policy
- subscription/cancellation terms
- refund policy where appropriate
- data deletion procedure
- support/contact email
- financial-estimate / decision-support disclaimer
- clear statement of Shopify CSV privacy handling
- incident/support process

Avoid overstating outputs as guaranteed forecasts or professional financial advice.

---

# 19. Recommended build sequence

## Sprint A - production trust

1. Billing cancel/downgrade/failure lifecycle
2. Password reset + delete/export account
3. API/security hardening
4. CI / repository cleanup
5. legal/support pages
6. mobile regression pass

## Sprint B - activation

1. Start Here guide
2. consistent tool-page structure
3. save landed cost/on-hand in SKU UI
4. first-value onboarding sequence
5. stronger empty states / next-step links

## Sprint C - retention

1. automatic Business Memory snapshots
2. history/trends
3. recommendation history/outcomes
4. Shopify import history comparisons
5. data freshness/source system

## Sprint D - paid depth

1. Unit Economics scenarios
2. 13-week Cash Runway
3. Inventory V2
4. 3PL quote builder
5. Wholesale terms/account economics

## Sprint E - integrations and scale

1. direct Shopify integration
2. scheduled monitoring
3. multi-brand/team support
4. exports/reports
5. higher-tier packaging

---

# Final product rule

Every new feature must pass three tests:

1. **Does a clothing-brand operator actually need this decision?**
2. **Can Brand OS calculate or infer it honestly from the data available?**
3. **Does it create recurring value instead of another one-time calculator?**

If the answer is no, do not add it.
