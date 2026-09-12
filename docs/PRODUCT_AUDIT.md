# Motion Supply Brand OS — Product Audit (V5)

Last reviewed: 2026-09-12

## Product principle

Brand OS is a decision-support tool for clothing-brand operators. It should not act like a vanity dashboard and it should never invent business results from default numbers.

Fresh accounts therefore start blank. The only prebuilt dataset is Foundry Eight, and it appears only after the user explicitly chooses the demo.

## Flow

1. Product economics: retail price, landed cost, order-level variable costs.
2. Acquisition guardrail: required post-CAC contribution plus observed CAC, or CAC calculated from spend / new customers.
3. Store funnel: sessions -> add-to-cart -> checkout -> completed orders, all from the same period/source.
4. Inventory: weekly demand, supplier lead time, on-hand, inbound and allocated units.
5. Cash: current cash, expected inflows, committed outflows and protected floor.
6. PO gate: proposed inventory commitment checked against the same cash model.
7. Shopify imports: source-labeled operational snapshot, kept separate from manual planning assumptions.
8. Advisor: risks and unresolved decisions are prioritized ahead of "healthy" messages.

## Dashboard rules

- Do not label an area healthy until required inputs exist.
- Blank inputs remain blank; a missing number is not silently treated as user-confirmed $0.
- If optional order costs are missing, contribution is visibly marked incomplete.
- Imported store metrics are labeled SHOPIFY IMPORT.
- Demo metrics are labeled DEMO CASE or EDITED DEMO.
- No universal CAC, conversion, discount, inventory or cash benchmark is imposed.
- Metrics are selected because they support a decision, not because they are popular.

## Research basis

Current Shopify guidance emphasizes dashboards tied to decisions, a small set of goal-relevant KPIs, inventory signals, CAC, conversion, returns and margin rather than revenue alone. Shopify also distinguishes operational order exports from analytics metrics such as net sales.

Current Supabase guidance recommends publishable keys for shipped/public clients, secret keys only on controlled servers, RLS plus appropriate grants, indexed owner columns, and `(select auth.uid())` patterns for RLS performance.

Current multi-source ecommerce dashboard products emphasize profitability, CAC, AOV, conversion, inventory and actionable summaries rather than walls of metrics. Brand OS intentionally stays narrower: it focuses on expensive founder decisions and uses explicit user inputs when integrations are unavailable.

## Sources reviewed

- Shopify — Store Performance Dashboard Guide for Retail (2026)
- Shopify — Essential Ecommerce KPIs to Track (2026)
- Shopify — Ecommerce Reporting (2026)
- Shopify Help Center — Exporting orders
- Shopify Help Center — Analytics data points reference
- Supabase Docs — Row Level Security
- Supabase Docs — API keys / publishable and secret keys
- Supabase Docs — RLS performance and best practices
- Triple Whale — Ecommerce Dashboards: Benefits, Setup, and What to Track (2026)
- Triple Whale Help Center — Summary Dashboard / ecommerce metric references

## Not yet claimed as complete

Brand OS does not yet replace bookkeeping, accounting, tax software, a full 13-week cash forecast, Shopify Analytics, ad-platform attribution, or inventory forecasting software. It is an operating decision layer. Those integrations/features should be added only when their source data can be handled accurately.
