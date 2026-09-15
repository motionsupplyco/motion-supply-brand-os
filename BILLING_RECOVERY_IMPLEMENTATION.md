# Stripe stale-customer recovery

This branch adds regression coverage and a reusable helper for the sandbox/test -> live Stripe failure observed in production.

## Required server integration before merge

1. Import `verifyStripeCustomer` and `clearStaleStripeBilling` from `lib/stripe-customer-recovery.js`.
2. Checkout: before reusing `existing.stripe_customer_id`, call `verifyStripeCustomer`. If missing, clear stale billing state, create a new customer for the authenticated user, and persist it before creating Checkout.
3. Portal: verify `existing.stripe_customer_id` before creating the portal session. If it is missing in the configured Stripe environment, clear stale billing state and return HTTP 409 with `code: 'STALE_STRIPE_CUSTOMER'` and a safe message telling the client to refresh and upgrade again.
4. Never auto-replace a customer merely because Stripe has a transient/API/network failure. Only recover from Stripe `resource_missing` (or a deleted customer).
5. Keep the existing duplicate-subscription guard before checkout creation.

Do not merge until `tests/stripe-customer-environment-recovery.test.js` passes and the full test suite/CI is green.
