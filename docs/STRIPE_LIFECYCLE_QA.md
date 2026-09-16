# Motion Supply Brand OS — Stripe Lifecycle QA

This runbook defines the remaining P0 acceptance work for portal access, cancellation/downgrade-to-Free, renewal, and failed-payment behavior.

The repository has deterministic contract coverage for the Brand OS side of these states. That is not the same thing as live provider evidence from the connected Stripe account.

## Intended product model

Brand OS currently has two access states:

- Free
- Pro subscription

There is no separate lower paid tier in the application. For this launch gate, “downgrade” means canceling Pro so the account returns to Free when Stripe says the subscription has actually ended.

Customer-facing subscription and payment-method management belongs in the Stripe Customer Portal. Brand OS does not implement a second custom cancellation endpoint for normal customers.

## Current application contract

Brand OS consumes these Stripe lifecycle events:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `checkout.session.completed`

Subscription snapshots persist the Stripe status, price ID, current-period end, `cancel_at_period_end`, cancellation timestamp, trial end, and latest invoice state when supplied.

Application entitlement is intentionally stricter than “a Stripe row exists”:

- `active` and `trialing` grant Pro access
- an existing non-terminal Stripe subscription can remain billing-manageable even when Pro access is not active
- `canceled` and `incomplete_expired` are terminal for the existing-subscription guard

This separation allows a founder with a payment problem to reach billing recovery without Brand OS creating a duplicate checkout subscription.

## Provider configuration that must be verified live

Before checking the P0 Stripe lifecycle gate, inspect the active production Stripe Customer Portal configuration and record evidence that:

1. Customer Portal access is enabled for the production account.
2. Subscription cancellation is enabled.
3. The intended launch behavior is **cancel at the end of the billing period**, not an accidental immediate cancellation.
4. Arbitrary subscription **price switching** is disabled unless Motion Supply intentionally introduces another supported paid tier and Brand OS entitlement logic is updated for it.
5. Customers can update their payment method when payment recovery is needed.
6. The production webhook endpoint is subscribed to the lifecycle events Brand OS depends on.

Stripe documents that an end-of-period cancellation is surfaced before the actual end through `customer.subscription.updated` with `cancel_at_period_end=true`, and the actual end produces `customer.subscription.deleted`. Stripe also documents `invoice.paid` for successful recurring payment and `invoice.payment_failed` for failed invoice collection.

Official references:

- https://docs.stripe.com/customer-management/integrate-customer-portal
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/api/customer_portal/configurations/object

## Acceptance scenario A — open billing portal

Use a dedicated QA customer/subscription, not a real unrelated customer.

1. Sign in to Brand OS as the QA Pro user.
2. Open Account.
3. Confirm the UI shows Pro and exposes Manage billing.
4. Open Manage billing.
5. Confirm a Stripe-hosted portal session opens for the same QA customer.
6. Return to Brand OS using the portal return path.
7. Confirm the same Brand OS session/account remains usable.
8. Confirm no second Stripe customer or subscription was created.

Record the Stripe customer ID, subscription ID, Brand OS user ID, and timestamps in a private QA record. Do not commit customer identifiers, payment details, tokens, or portal URLs to GitHub.

## Acceptance scenario B — cancel at period end / downgrade to Free

1. From the Customer Portal, schedule cancellation at period end.
2. Confirm Stripe emits `customer.subscription.updated`.
3. Confirm the Brand OS subscription row records `cancel_at_period_end=true` and the current period end.
4. Before the period end, confirm the subscription status remains an active Stripe status and Brand OS Pro access remains available.
5. Confirm Account visibly says cancellation is scheduled and displays the end date.
6. If reactivation is supported by the configured portal, reactivate before period end and confirm another `customer.subscription.updated` sets `cancel_at_period_end=false` without creating a new subscription.
7. For the actual end-of-period path, use a safe Stripe test-mode/test-clock equivalent or a dedicated controlled QA subscription. Do not wait on or manipulate an unrelated production customer.
8. Confirm Stripe emits `customer.subscription.deleted` when the subscription actually ends.
9. Confirm Brand OS then reports Free access while retaining the user’s account/data subject to normal Free-plan limits.

The P0 gate is not satisfied merely because the cancellation button exists in Stripe.

## Acceptance scenario C — successful renewal

1. Use a dedicated controlled subscription whose renewal can be safely exercised.
2. Confirm Stripe records the renewal invoice as paid and emits `invoice.paid`.
3. Confirm Brand OS refreshes the current subscription snapshot from Stripe.
4. Confirm `latest_invoice_status` becomes `paid`.
5. Confirm the current-period end advances to Stripe’s new value.
6. Confirm Pro entitlement remains active.
7. Confirm no duplicate Stripe subscription or customer appears.

A unit test or manually editing a database row is not live provider evidence for renewal.

## Acceptance scenario D — failed renewal/payment recovery

1. Use Stripe-supported test payment behavior on a dedicated QA subscription; never intentionally fail an unrelated customer’s live card.
2. Trigger a renewal/payment failure and confirm Stripe emits `invoice.payment_failed`.
3. Confirm Brand OS refreshes the subscription snapshot and records `latest_invoice_status=payment_failed`.
4. Confirm Account displays “Payment needs attention” and directs the user to billing.
5. Confirm Manage billing remains reachable for a non-terminal existing Stripe subscription even if Pro entitlement is no longer active under the Stripe status returned.
6. Update the payment method through the Customer Portal and complete provider-supported recovery.
7. Confirm the eventual successful invoice event changes the saved invoice state back to `paid` and the appropriate Stripe subscription status restores/retains Pro access.
8. Confirm recovery does not create a duplicate subscription.

## Acceptance scenario E — webhook reliability

For each tested lifecycle transition:

- confirm the production/test webhook delivery receives a 2xx after successful processing
- confirm duplicate delivery of the same Stripe event is idempotent through the webhook ledger
- confirm a processing failure is recorded as failed rather than falsely marked completed
- confirm a retry can recover the failed event according to the existing webhook-claim contract
- correlate any server error using the request/deployment logs without logging secret values

## Evidence to record

A lifecycle acceptance record should include:

- environment used (production or Stripe test mode)
- QA Brand OS user identifier
- Stripe customer/subscription identifiers stored privately
- portal configuration reviewed and date
- scenario performed
- Stripe event types observed
- expected Brand OS account/entitlement result
- actual result
- any Vercel request/error evidence needed to diagnose failure
- cleanup performed

Do not place card details, access tokens, webhook secrets, portal session URLs, raw webhook payloads containing private data, or customer PII in the repository.

## Gate rule

**Do not check** `Stripe portal/cancel/downgrade/renewal/failed-payment QA` from repository tests alone.

The checkbox can be checked only after the deterministic repository contract is green **and live provider evidence** (or an equivalent controlled Stripe test-mode lifecycle exercise against the deployed integration) proves portal access, cancellation scheduling, actual cancellation/end state, successful renewal, failed payment/recovery, and webhook processing as described above.
