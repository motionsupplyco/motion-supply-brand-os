# Motion Supply Brand OS — Production Observability Runbook

Last audited: 2026-09-16

## Current monitoring posture

Brand OS runs on Vercel Pro. Vercel runtime logs provide structured platform dimensions including status code, path/route, deployment, environment and request identifiers. The application also sends an `X-Request-Id` response header, using an incoming request ID when supplied or generating a UUID otherwise.

This branch additionally emits one bounded JSON `http_request` record when an API response finishes. The application record contains only:

- UTC timestamp
- log level derived from HTTP status
- event name (`http_request`)
- request ID
- HTTP method
- normalized route template
- status code
- duration in milliseconds

The application request logger does not read or serialize request bodies, query strings, IP addresses, cookies, authorization headers, email addresses, access tokens, reset tokens or provider payloads. Dynamic route values are represented by route templates, and unmatched API paths are normalized to `/api/:unmatched` rather than logging the raw path.

At the time of this audit:

- Vercel reported no grouped runtime errors in the previous 12 hours.
- The 7-day error history still contained earlier Stripe configuration/stale-customer and Supabase Auth email/session failures from the production-hardening period. Historical errors must not be interpreted as current incidents without checking their timestamps and deployment IDs.
- Production traffic included expected non-2xx responses such as `401` for signed-out protected routes and `402` for Pro-gated routes. Alerting must not treat every 4xx as an outage.

This document is an operational procedure, not a claim that every alert channel has been tested end-to-end.

## External uptime check

`.github/workflows/production-health-monitor.yml` runs from GitHub-hosted infrastructure every 15 minutes and can also be started manually after the workflow is merged to the default branch.

It verifies two independent production surfaces:

1. `https://www.motionsupplyos.com/` must return a successful HTTP response after redirects.
2. `https://www.motionsupplyos.com/api/health` must return valid JSON with all of these exactly `true`:
   - `ok`
   - `authConfigured`
   - `cloudConfigured`
   - `billingConfigured`

The workflow uses bounded connection/request timeouts and two retries so a single short network interruption is less likely to become a false outage signal. It does not require production credentials and must never print secrets.

A failed scheduled run is a durable monitoring signal in GitHub Actions. Before treating this P0 gate as fully operational, confirm that the account/operator who owns production receives GitHub Actions failure notifications (or connect an approved external alert destination). A monitor that nobody receives is not a tested pager.

## Health endpoint boundary

`/api/health` is intentionally a configuration/readiness endpoint. It may report only non-secret booleans needed to determine whether core services are wired. Do not add API keys, database URLs, customer data, stack traces, provider IDs or raw provider error messages to the health response.

The uptime workflow should fail closed when one of the required service booleans is false. This catches cases where the web app itself returns HTTP 200 while Auth, cloud persistence or billing is not configured.

## Runtime error review

For an incident or release review, start with Vercel's grouped runtime errors for production and a narrow recent window. Then expand only the relevant error group into runtime logs.

Review in this order:

1. Is the error still occurring on the current production deployment?
2. What was the first/last seen timestamp?
3. Which route and deployment produced it?
4. Is the status expected product behavior (`401`, `402`, a deliberate validation `400`) or a real failure?
5. Can the request be correlated by the app `request_id`, the `X-Request-Id` response header and Vercel request metadata?
6. Did the same class continue after the supposed fix was deployed?

Do not declare an incident resolved solely because a code change merged. Verify that recent production error/log windows are clean after the deployment is serving traffic.

## Structured logging boundary

Application API completion logs are intentionally allowlisted rather than produced by serializing request objects. Use the JSON `http_request` line for request-level correlation and Vercel platform fields for deployment/environment context.

Never log:

- passwords, password hashes or reset tokens
- bearer/access/refresh tokens
- cookies or authorization headers
- IP addresses when they are not specifically required for a security investigation
- Stripe secret keys, webhook secrets or full payment objects
- Supabase service-role/secret keys
- Shopify access/refresh tokens or OAuth secrets
- raw database connection strings
- raw query strings
- full request bodies from authenticated/customer routes

When logging a provider failure, prefer a small safe set such as event name, provider error type/code, HTTP status and request/correlation ID. Existing legacy console errors should still be normalized when their code paths are next touched; the new request-completion record does not make arbitrary legacy error objects safe to log.

## What counts as an outage

Treat these as outage/high-priority signals:

- root URL cannot be reached after the monitor's bounded retries
- `/api/health` cannot be reached or returns non-JSON
- any required health boolean is false
- repeated production `5xx` responses
- a new fatal/error cluster on the current production deployment
- sustained upstream failures that block signup/sign-in, billing, persistence or the primary dashboard journey

Do not classify these alone as an outage:

- ordinary `401` from unauthenticated protected requests
- ordinary `402` from a free user opening a Pro-only route
- expected validation `400` responses
- old errors tied only to superseded deployments

## Incident evidence

For each real incident, record non-secret evidence:

- UTC detection time
- affected production deployment SHA/ID
- affected route(s)
- status/error class and count
- one or more safe request IDs
- whether `/api/health` passed or failed
- mitigation/rollback/fix SHA
- the first clean verification window after mitigation

Do not paste secret-bearing raw provider payloads into GitHub issues.

## Launch-gate status

This tranche provides application-emitted structured API completion logs, a repeatable external uptime check and a production observability procedure on top of Vercel's runtime error/log system and Brand OS request IDs.

The P0 **Error + uptime monitoring and structured logs** checkbox should remain unchecked until:

- this branch is intentionally merged to the default branch so the request logger and scheduled monitor are serving production,
- at least one scheduled or manual production-health run succeeds from the merged workflow,
- alert delivery for a deliberately failed or otherwise controlled test is confirmed to reach the responsible operator,
- a current production log review confirms `http_request` JSON lines are arriving with only the documented allowlisted fields, and
- a current production log review shows no unresolved critical runtime-error cluster.

Do not mark the gate complete from preview/code review alone.
