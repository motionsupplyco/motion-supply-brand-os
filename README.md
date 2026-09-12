# Motion Supply Brand OS — V5 Audited

This is the full-stack upgrade of the original static MVP.

## What works in this codebase

- Motion Supply operating tools: profit/pricing, CAC ceiling, store funnel, discount stack, inventory/reorder, wholesale, launch break-even, 3PL normalization, cash checkpoint, PO cash gate, Shopify import, and next-move rules.
- Blank-first onboarding: no business results are prefilled. Foundry Eight exists only behind an explicit demo button.
- Email/password accounts with Supabase Auth when configured.
- Owner-only cloud brands and saved SKUs with Supabase Row Level Security.
- Shopify **Orders CSV** import with order de-duplication across multi-line-item rows.
- Shopify **Transaction history CSV** import for captured payment and refund totals.
- Automatic KPI summary from imported CSV data.
- Raw Shopify customer rows stay in the browser by default; only an aggregate summary is saved to cloud.
- Stripe subscription Checkout, signed webhook processing, subscription entitlement checks, and Billing Portal.
- Demo/local mode remains usable before Supabase or Stripe are configured.
- Automated math and Shopify parser tests.

## Where to put the ZIP

Do **not** upload this ZIP into Shopify as a theme. It is its own web application.

For the full account + Stripe version, the easiest path is:

1. Unzip the project on a computer.
2. Create a private GitHub repository.
3. Upload the **contents** of `motion-supply-brand-os-pro` to that repository.
4. Deploy that repository to a Node-capable host such as Render, Railway, Fly.io, or another service that can run `npm install` and `npm start`.
5. Add the environment variables from `.env.example` in the host's Environment/Secrets settings.
6. Point a domain/subdomain such as `app.motionsupplyco.com` to the deployed app.

The earlier static MVP can go on Netlify Drop/Cloudflare Pages. **This Pro version needs a server** because Stripe secret keys and the Supabase service-role key must never be placed in browser code.

## Local setup

Requires Node 20+.

```bash
cp .env.example .env
npm install
npm test
npm start
```

Then open `http://localhost:3000`.

The app starts in demo/local mode if the cloud keys are absent.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `sql/schema.sql`.
4. Copy Project URL and the current publishable key into `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
5. Copy the current server secret key into `SUPABASE_SECRET_KEY` **only on the server/hosting platform**. Legacy `anon` / `service_role` variable names remain supported for migration.
6. In Authentication settings, configure your Site URL and allowed redirect URLs for the deployed domain.

The schema uses RLS. Users can read/write only their own brands, SKUs, scenarios and import summaries. They can read only their own subscription row. Client code has no policy allowing it to forge subscription status.

## Stripe setup

1. Create a Stripe product named something like `Motion Supply Brand OS Pro`.
2. Create a recurring price and copy its `price_...` ID to `STRIPE_PRO_PRICE_ID`.
3. Put the Stripe secret key in `STRIPE_SECRET_KEY` on your host.
4. Add a webhook endpoint:

```
https://YOUR-DOMAIN.com/api/stripe-webhook
```

5. Subscribe the webhook to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.
7. Set `APP_URL` to the exact production origin, for example `https://app.motionsupplyco.com`.

## Shopify CSV workflow

### Orders export

In Shopify Admin: Orders → Export. The current Shopify order export includes order-level fields such as `Name`, `Email`, `Financial Status`, `Subtotal`, `Shipping`, `Taxes`, `Total`, `Discount Amount`, `Created at`, plus line-item fields such as `Lineitem quantity`, `Lineitem name`, `Lineitem price`, and `Lineitem SKU`.

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
npm test
node --check server.js
node --check public/app.js
node --check public/math.js
node --check public/shopify.js
```

## Privacy / security

Read `docs/SECURITY.md`. Do not deploy server secrets to frontend JavaScript. Raw Shopify CSV rows can include customer personal information; this build processes those rows locally and saves only aggregate summaries by default.

## Before charging real customers

Complete these launch tasks:

- production Supabase keys + auth domain
- production Stripe keys, product/price, and signed webhook
- custom HTTPS domain
- privacy policy + terms + refund/cancellation policy for the software
- support email
- test checkout with Stripe test mode first
- test account isolation using two separate user accounts
- test Shopify CSVs exported from at least two real stores / date ranges
- confirm your pricing and which features remain free vs Pro
- add monitoring/backups before relying on the app for critical business records


## V5 product rules

- New users see a blank operating model. Zeroes are not shown as if they were real business data.
- A result is labeled only when its required inputs exist.
- Missing variable costs are disclosed before contribution is trusted.
- No universal CAC, conversion, discount, inventory, or cash benchmark is silently imposed.
- Dashboard metrics are decision-led: profitability, acquisition, inventory, cash, and store data.
- Imported Shopify metrics are labeled as source data and remain separate from manual planning assumptions.
- Demo data is visually labeled `DEMO CASE` and never auto-loads.
