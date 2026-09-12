# Security notes

- Never expose `SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)`, `STRIPE_SECRET_KEY`, or `STRIPE_WEBHOOK_SECRET` in frontend code, screenshots, GitHub, or browser environment variables.
- The browser receives only the Supabase project URL and public anon/publishable key. Supabase Row Level Security protects user-owned rows.
- Stripe subscription state is written server-side from signed webhook events. The client can read only its own subscription row.
- Shopify CSV parsing runs locally in the browser. By default, the app saves only aggregate import summaries to Supabase, not customer email/address rows.
- Do not use Shopify order export alone as a precise refund ledger. For captured/refunded payment totals, import Shopify Transaction history CSV too.
- Use HTTPS in production. Render/Railway/Fly/Vercel/Netlify provide TLS on managed domains.

- Current Supabase publishable/secret keys are preferred over the legacy anon/service_role keys. The server supports both during migration.
- Table grants and RLS are both configured; anon receives no access to user-data tables.
- Composite owner/brand foreign keys prevent a user-owned row from pointing at another user's brand.
