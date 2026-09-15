# Motion Supply Brand OS — Soft Launch Watch

Use this during the first days of public traffic. The goal is to distinguish a healthy launch from silent friction early, without treating every abandoned session as a bug.

## 1. Production reliability

Watch Vercel runtime errors and status codes on the production deployment.

Escalate immediately if:
- any new repeated 5xx error affects auth, account, checkout, webhook, brand/SKU, Business Memory, or import routes;
- 5xx responses exceed 1% of production API requests in a meaningful sample;
- the same new error reaches more than one user/session;
- `/api/health` stops reporting auth, cloud, or billing as configured.

## 2. Signup and session health

Watch sign-in/signup/recovery requests and support messages.

Escalate if:
- multiple users cannot confirm email or sign in;
- recovery starts producing repeated 429/5xx responses;
- session refresh failures appear across more than one user;
- account creation succeeds but users cannot reach their workspace.

## 3. Checkout transparency and abandonment

Brand OS Pro is displayed as $19/month before Stripe checkout.

Compare `checkout_started` events with Stripe `checkout.session.completed` over the same period.

Early signal:
- do not overreact to the first few attempts;
- after at least 10 checkout starts, investigate if more than ~70% abandon before completion;
- separate price resistance from technical failure by checking Stripe/Vercel errors and user feedback before changing price.

## 4. Exact Discount Ceiling

The exact ceiling calculation is covered by automated tests. The browser UI also emits a `discount_ceiling_error` event if the new calculation/render path throws.

Escalate if:
- any `discount_ceiling_error` event appears in production;
- Foundry Eight no longer shows an exact ceiling of about 13.0%;
- a planned discount at or below the displayed ceiling is labeled FAIL, or one above it is labeled PASS beyond normal rounding tolerance.

## 5. Shopify import

Watch malformed-file support reports and import errors.

Escalate if:
- a standard Shopify Orders or Transaction History export fails;
- imports produce NaN/Infinity, duplicate order totals, or obviously incorrect refund totals;
- multiple users hit the same unsupported export shape.

## 6. First-user feedback

Ask early users three questions:
1. What confused you?
2. What did you expect the app to do that it did not?
3. What would make you come back every week?

Repeated confusion from 2–3 unrelated users is a stronger product signal than a one-off feature request.

## Launch claim

Use: **Production is healthy and the tested happy paths are passing.**

Do not claim: **The app is proven resilient under public load.**

Load, concurrency, webhook-failure, malformed-input, and broader adversarial testing remain an ongoing resilience phase after soft launch.
