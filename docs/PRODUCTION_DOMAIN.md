# Production domain

Motion Supply Brand OS production domain:

- Canonical app origin: `https://www.motionsupplyos.com`
- Apex domain: `https://motionsupplyos.com` (redirects to `www`)

## Vercel

Production `APP_URL` should be set to:

```text
https://www.motionsupplyos.com
```

After changing `APP_URL`, create a fresh production deployment so server-side auth and billing callbacks use the new origin.

## Supabase Auth

Use `https://www.motionsupplyos.com` as the production Site URL and allow the production callback URLs used by signup and password recovery, including:

```text
https://www.motionsupplyos.com/
https://www.motionsupplyos.com/?reset=1
```

Keep necessary Vercel preview redirect URLs only for preview/testing flows.

## Stripe

Checkout success/cancel and Billing Portal return URLs are generated from `APP_URL`. The existing signed webhook may remain on a working Vercel production alias during the domain cutover, or be moved to:

```text
https://www.motionsupplyos.com/api/stripe-webhook
```

If the webhook endpoint is changed in Stripe, update `STRIPE_WEBHOOK_SECRET` to the signing secret for that exact endpoint before disabling the old one.
