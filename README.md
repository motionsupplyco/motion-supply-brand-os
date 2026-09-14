# Motion Supply Brand OS — P0 Production Hardening

Motion Supply Brand OS is a full-stack operating system for clothing-brand founders. It combines decision tools, saved business context, account/subscription infrastructure, Shopify aggregate imports, and guided operating recommendations.

The P0 branch is focused on production correctness first: account lifecycle, billing lifecycle, security, privacy/deletion, reproducible deployments, and Business Memory. The larger guided/interactive UX pass comes after these gates are proven live.

## What works in this codebase

- Motion Supply operating tools: profit/pricing, CAC ceiling, store funnel, discount stack, inventory/reorder, wholesale, launch break-even, 3PL normalization, cash checkpoint, PO cash gate, Shopify import, and next-move rules.
- Blank-first onboarding: no business results are prefilled. Foundry Eight exists only behind an explicit demo button.
- Email/password accounts with Supabase Auth when configured.
- Server-mediated cloud brands and saved SKUs with ownership checks and Supabase RLS as defense in depth.
- Pro-gated Business Memory for durable company-wide and brand-specific operating context.
- Shopify **Orders CSV** import with order de-duplication across multi-line-item rows.
- Shopify **Transaction history CSV** import for captured payment and refund totals.
- Automatic KPI summaries from imported CSV data.
- Raw Shopify customer rows stay in the browser by default; only aggregate summaries are sent to the cloud service.
- Stripe subscription Checkout, signed retry-safe webhook processing, entitlement checks, payment-failure/cancellation state, duplicate-subscription protection, billing recovery, and Billing Portal.
- In-product Privacy, Terms, Support, password recovery, and account deletion.
- Demo/local mode remains usable before Supabase or Stripe are configured.
- Node 22 CI, pinned dependencies, synchronized lockfile enforcement, syntax checks, and contract tests for billing/auth/deletion/security behavior.

## Architecture boundary

This Pro version needs a Node-capable server because Stripe secret keys and the Supabase secret/service-role credential must never be placed in browser or mobile code.

Browser application data calls go through Brand OS `/api/*` routes. The final P0 database hardening removes direct `anon` and `authenticated` table grants from application tables. RLS remains enabled as an additional layer of defense.

The browser CSP is intentionally same-origin for network requests; server-side Supabase and Stripe calls happen from the Node service.

## Local setup

Requires **Node 22+**.

```bash
cp .env.example .env
npm ci
npm test
npm start
```

Then open `http://localhost:3000`.

The app starts in demo/local mode if the cloud keys are absent.

For development with automatic restart you can use:

```bash
npm run dev
```

## Supabase setup

1. Create a Supabase project.
2. Follow **`sql/README.md`** for the canonical fresh-environment / upgrade sequence. Do not assume `schema.sql` or `p0_production_migration.sql` alone represents the complete production database contract.
3. Copy the Project URL and current publishable key into `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
4. Copy the current server secret key into `SUPABASE_SECRET_KEY` **only on the server/hosting platform**. Legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` names remain supported for migration compatibility.
5. In Authentication settings, configure the exact production Site URL and allowed redirect URLs used for signup/recovery flows.
6. Run the Supabase security and performance advisors after applying schema changes.

### Current P0 access model

- Browser clients do **not** directly query application tables.
- Application tables have no direct `anon` / `authenticated` table grants after the final server-only Data API hardening migration.
- The Express API validates the bearer token against Supabase Auth, applies ownership/plan checks, and performs database work using the server credential.
- RLS stays enabled as defense in depth.
- Stripe webhook claim RPC execution is restricted to `service_role`.
- Signed-in product analytics cascade with account deletion; the server-only account-deletion lifecycle audit row intentionally survives deletion.

### Password security note

Supabase leaked-password protection is a Pro-plan Auth feature. If the Supabase organization is on Free, the security advisor will continue to report that warning until the project is upgraded and the feature is enabled.

## Stripe setup

1. Create a Stripe product such as `Motion Supply Brand OS Pro`.
2. Create a recurring price and copy its `price_...` ID to `STRIPE_PRO_PRICE_ID`.
3. Put the Stripe secret key in `STRIPE_SECRET_KEY` on the server host.
4. Add a webhook endpoint:

```text
https://YOUR-DOMAIN.com/api/stripe-webhook
```

5. Subscribe the webhook to at least:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
6. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.
7. Set `APP_URL` to the exact production HTTPS origin, for example `https://app.motionsupplyco.com`.
8. Configure Stripe Billing Portal for the customer actions you intend to support.

### Billing lifecycle behavior

- `active` / `trialing` subscriptions unlock Pro.
- Existing non-terminal Stripe subscriptions that need payment/account attention are routed to **Manage billing**, not a second checkout.
- `invoice.payment_failed` is persisted explicitly so the account UI can warn the customer.
- Webhook event IDs are claimed atomically; completed events remain idempotent, failed events can retry, and stale processing claims can be reclaimed after the configured safety window.
- Account deletion cancels any non-terminal Stripe subscription before deleting the Supabase Auth user.

## Public/legal configuration

The app includes local fallbacks:

- `/privacy.html`
- `/terms.html`
- `/support.html`

Production may override those destinations with:

- `PRIVACY_URL`
- `TERMS_URL`
- `SUPPORT_URL`

Before public launch, make sure the support destination gives users a real way to contact the business.

## Shopify CSV workflow

### Orders export

In Shopify Admin: Orders → Export. Shopify order exports include order-level fields such as `Name`, `Email`, `Financial Status`, `Subtotal`, `Shipping`, `Taxes`, `Total`, `Discount Amount`, `Created at`, plus line-item fields such as `Lineitem quantity`, `Lineitem name`, `Lineitem price`, and `Lineitem SKU`.

Shopify places extra line items from one order on additional rows and leaves many order-level fields blank. The importer intentionally groups those continuation rows by the last nonblank order `Name` while counting each order-level total only once.

### Transaction history export

Use Transaction history when you want captured-payment/refund cash totals. The app recognizes `Order`, `Name`, `Kind`, `Gateway`, `Status`, `Amount`, and related transaction columns and uses successful `sale`/`capture` versus `refund` rows.

**Important:** an Orders CSV by itself is not treated as a perfect refund ledger.

## Financial model notes

The Foundry Eight demo uses the locked case inputs from the book, including:

- $78 retail
- $27.40 landed cost
- $1.20 packaging
- $4.50 shipping subsidy
- $2.50 return/refund planning reserve
- 2.9% + $0.30 processor illustration
- $39.84 rounded pre-CAC contribution
- $15 expected CAC
- $24.84 rounded contribution after expected CAC / max CAC under the case rule
- $45 wholesale price / about $13 per unit wholesale contribution
- $5.72 in-house fulfillment baseline before postage
- about 1,563 orders/month in the stated 3PL crossover case

Calculations keep full precision internally and round only for display.

## Run the checks

```bash
npm ci
npm test
node --check server.js
node --check public/app.js
node --check public/account-ui.js
node --check public/business-memory-ui.js
node --check lib/stripe-webhook-state.js
```

GitHub CI also regenerates package-lock metadata and fails if the checked-in lockfile drifts from `package.json`.

## Privacy / security

- Never deploy Supabase secret/service-role credentials or Stripe secret keys to frontend JavaScript.
- Raw Shopify CSV rows can include customer personal information; this build processes those rows locally and saves only aggregate summaries by default.
- API responses are no-store, production uses HSTS, and the app sends CSP / frame / content-type / referrer / permissions headers.
- Application request limits exist in-process as defense in depth. Before larger-scale traffic, use a shared edge/store rate-limit layer so limits cannot be bypassed across multiple serverless instances.
- Account deletion removes user-owned application rows through database cascades; signed-in analytics are deleted too. A restricted operational deletion audit may be retained after the Auth user is removed.

See `docs/PRIVACY.md`, `docs/TERMS.md`, and the built-in public policy pages for user-facing wording.

## Before charging real customers

Do not treat green unit/contract tests as a substitute for production E2E. Complete these gates:

- exact production Supabase URL/keys + Auth Site URL/redirect allowlist
- exact production Stripe keys, product/price, signed webhook, and Billing Portal configuration
- custom HTTPS production domain and correct `APP_URL`
- working support destination plus final Privacy/Terms/refund-cancellation wording
- signup → email verification → signin on the real deployment
- real password-recovery email → new password → signin
- free-plan brand/SKU limit behavior
- Stripe test-mode checkout → webhook → Pro entitlement
- duplicate checkout protection and billing-recovery path
- Billing Portal, cancellation-at-period-end, paid invoice, and failed-payment UI
- Business Memory Pro gating, owner isolation, global/brand scope, save/edit/delete
- account deletion → Stripe cancellation → Auth deletion → user-data cascade → retained server-only deletion audit
- malformed/oversized requests and 401 / 402 / 404 / 429 / 500 user-facing behavior
- mobile/responsive and accessibility testing
- Shopify CSVs exported from at least two representative stores/date ranges
- monitoring/backups before relying on Brand OS for critical business records

## Repository hygiene before launch

`node_modules/` is legacy-tracked in the repository even though `.gitignore` excludes it. Builds already use the pinned lockfile and `npm ci`; remove the tracked dependency directory in a dedicated cleanup PR before launch instead of mixing thousands of generated-file deletions into P0.

## V5 product rules

- New users see a blank operating model. Zeroes are not shown as if they were real business data.
- A result is labeled only when its required inputs exist.
- Missing variable costs are disclosed before contribution is trusted.
- No universal CAC, conversion, discount, inventory, or cash benchmark is silently imposed.
- Dashboard metrics are decision-led: profitability, acquisition, inventory, cash, and store data.
- Imported Shopify metrics are labeled as source data and remain separate from manual planning assumptions.
- Demo data is visually labeled `DEMO CASE` and never auto-loads.

## Mobile release

See `docs/MOBILE_STORE_RELEASE.md` after the web P0 release is proven. Do not submit a thin web-view wrapper as the final iOS/Android product, and do not assume Stripe web checkout satisfies Apple/Google rules for native digital subscription unlocks.

## Later product UX pass

After P0 correctness is proven live, the next UX pass will move Brand OS beyond a calculator collection into a guided operating system: problem-first navigation, contextual “fix this” actions, smarter recommendation paths, clearer explanations, carried-forward inputs, and restrained modern visuals without fake business metrics.
