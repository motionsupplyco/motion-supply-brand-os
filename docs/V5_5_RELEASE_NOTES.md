# Brand OS V5.5 — Foundation / Monetization / Memory Sprint

## What changed

- Centralized customer-facing Free vs Pro gates in the app.
- Server-side Free limits: 1 saved brand and 5 saved SKUs.
- Server-side Pro enforcement for Shopify aggregate history, Business Memory snapshots, and recommendation history.
- Added Business Memory tables and recommendation-history tables with RLS.
- Added privacy-minimized product event storage with an explicit allowlist and scalar-only metadata.
- Added core activation events: landing, signup, first calculation, tool open, Pro view, checkout start.
- Expanded calculator tests from the original suite to edge cases around zeroes, negatives, invalid percentages, division-by-zero, and PO timing.
- PO Cash Gate V2 now models deposit, remaining balance, cash movement before the balance is due, and the lowest cash headroom across the modeled timeline.
- Dashboard and Advisor no longer expose the full operating layer to Free accounts. Demo mode can still demonstrate Pro.
- Dashboard metrics now explain what the number is, why it matters, how it is calculated, and what to do next.

## Deployment order

1. Back up the Supabase database.
2. Run `sql/v5_5_migration.sql` in Supabase SQL Editor.
3. Deploy the V5.5 application code.
4. Confirm `/api/health` reports expected configuration.
5. Test a Free account: one brand saves, second brand is rejected; up to five SKUs save; Pro cloud endpoints reject the account.
6. Test a Pro account after Stripe webhook entitlement is active.
7. Test checkout → webhook → `/api/account` shows `plan: pro`.
8. Test Shopify CSV import as Pro and confirm only the aggregate summary is stored.
9. Test PO Cash Gate with staged supplier terms.
10. Check `product_events` for the expected activation events.

## Not finished yet

V5.5 lays the infrastructure for Business Memory but does not yet automate daily/weekly snapshots or make Advisor V2 compare historical snapshots. Direct Shopify OAuth/webhook sync is also a later sprint.
