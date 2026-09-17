# Motion Supply Brand OS — Two-User Account Isolation QA

This runbook defines the P0 acceptance test for tenant isolation. Static owner-scope tests and service-role queries are useful evidence, but the launch gate requires a real cross-account exercise using **two distinct QA user sessions**.

## Security model

Brand OS intentionally uses a server-proxy model for application data:

- browser requests authenticate with the user's Supabase access token
- the server revalidates that token with Supabase Auth
- server-side database access uses the privileged Supabase server client
- every customer-facing query must therefore scope reads/writes to the authenticated user ID and, where applicable, an owned brand/SKU
- browser roles must not have direct table privileges that bypass the server contract

A two-user isolation test **must not use the service role** as either user. Service-role access bypasses normal RLS behavior and cannot prove customer isolation.

## Live production security audit — 2026-09-16

Read-only checks against Supabase project `ezgsrckpxlxhmmybogct` found:

- all 20 public application tables have RLS enabled
- `anon` has no SELECT privilege on the application tables
- `authenticated` has no SELECT, INSERT, UPDATE, or DELETE table privileges on the application tables
- tenant-facing data therefore cannot be read directly through the browser Data API under the current grants

The current composite ownership constraints were also inspected read-only. Brand-scoped tables including Business Memory, snapshots, import summaries, recommendation history, cash forecasts, commerce snapshots, integrations, sync runs, inventory, operating alerts, SKU planning settings, and SKUs bind `(brand_id, owner_id)` to `brands(id, owner_id)`. Inventory/planning SKU references additionally bind SKU, brand, and owner together.

Supabase's security advisor currently reports informational `RLS Enabled No Policy` findings on server-only tables. Under the current architecture this is expected because browser roles have their table privileges revoked and the server uses privileged access with explicit owner predicates. Do not add broad `authenticated` policies merely to silence the advisor; that would widen the attack surface.

The advisor also reports that leaked-password protection is disabled. That is a separate Auth hardening follow-up and is not evidence for or against tenant-row isolation.

## Repository boundaries already required

The isolation contract must continue to prove that:

- brand list/update/delete queries include `owner_id = authenticated user`
- brand creation forces `owner_id` from the authenticated session
- SKU creation verifies the brand belongs to the authenticated user and forces `owner_id`
- SKU list/update/delete queries include the authenticated owner
- Pro history/memory writes force the authenticated owner rather than accepting `owner_id` from request payloads
- Business Memory brand writes verify brand ownership
- account and billing lookups derive the user from the bearer session, not body/query IDs
- V2 integration helpers scope brand/connection access to the authenticated owner
- V2 cash forecast updates include both row ID and authenticated owner
- V2 SKU planning checks owner + brand + SKU relationships and forces owner on writes
- direct browser table privileges remain revoked

## Required live two-user acceptance exercise

Use two disposable QA accounts created specifically for this test. Do not reuse an unrelated customer's account and do not exchange passwords or session tokens between people.

Call the accounts **User A** and **User B** in the QA record.

### 1. Establish independent sessions

1. Create/sign in User A in one isolated browser context.
2. Create/sign in User B in a second isolated browser context.
3. Confirm each `/api/account` response shows the expected distinct user ID/email for its own bearer session.
4. Confirm neither browser context contains the other account's access or refresh token.

### 2. Brand isolation

1. User A creates a uniquely named QA brand and record its brand ID privately.
2. User B creates its own uniquely named QA brand.
3. User A `GET /api/brands` must show only User A's brands.
4. User B `GET /api/brands` must show only User B's brands.
5. While authenticated as User B, attempt to rename User A's brand by A's exact ID.
6. While authenticated as User B, attempt to delete User A's brand by A's exact ID.
7. Cross-account mutation must return 404/403 or another safe non-success outcome and must not alter User A's brand.
8. Re-read User A's brand under User A to prove it remains intact.

### 3. SKU isolation

1. User A creates a QA SKU under User A's brand.
2. User B must not see that SKU in `GET /api/skus`.
3. User B attempts update and delete using User A's exact SKU ID.
4. Cross-account requests must return 404/403 or another safe non-success outcome and must not alter/delete User A's SKU.
5. User B attempts to create a SKU with User A's brand ID; it must be rejected.
6. User A re-reads its SKU and confirms unchanged ownership/content.

### 4. Pro data surfaces

If the disposable QA accounts can safely be granted/used with Pro test entitlement, repeat cross-account checks for representative Pro data:

- Shopify import summary
- Business snapshot/history
- recommendation history
- Business Memory
- cash forecast
- SKU planning row
- integration connection metadata (never expose token ciphertext)
- operating alerts / operating data

At minimum:

1. User A creates a record.
2. User B's list endpoint must not show it.
3. For any endpoint that accepts a record ID, User B attempts the exact User A ID.
4. User B must not read, update, or delete User A's record.
5. User A re-reads the record to prove it was not changed.

Where a create endpoint accepts `brand_id`, User B should attempt to submit User A's brand ID. The operation must fail because the route or the `(brand_id, owner_id)` constraint rejects the cross-owner association.

### 5. Account and billing identity

1. With User A's session, `/api/account` must return only User A identity/usage/subscription state.
2. With User B's session, it must return only User B state.
3. Supplying User A IDs in User B request bodies/query parameters must not change which account/subscription the server loads.
4. Do not intentionally cancel, charge, or modify an unrelated live Stripe customer as part of this isolation test.

### 6. Direct Data API boundary

Using normal browser `anon`/`authenticated` credentials—not the service role—confirm application tables are not directly readable/writable under the current server-only architecture. A privileged SQL query showing data is not a substitute for this check.

### 7. Cleanup

After evidence is captured:

- delete only the disposable QA brands/SKUs/data created for the test
- delete the disposable QA accounts if they are no longer needed
- verify cleanup did not alter any pre-existing user rows
- never commit access tokens, refresh tokens, passwords, private emails, Stripe IDs, Shopify credentials, or customer data to the repository

## Expected results

Pass requires all of the following:

- User A and User B list endpoints return only their own tenant data
- cross-account ID reads are unavailable
- cross-account update/delete attempts do not mutate another user's rows
- a foreign brand/SKU ID cannot be attached to the caller's new record
- server-authenticated identity wins over any caller-supplied owner/user ID
- direct browser table access remains unavailable
- User A data remains intact after User B's negative attempts

Any successful cross-account disclosure or mutation is a P0 security failure. Stop launch work and fix the route/constraint before continuing.

## Evidence record

Record privately:

- test date/environment
- two QA account identifiers
- created brand/SKU/record IDs
- endpoint + expected result for each negative attempt
- actual HTTP status/result
- post-attempt User A verification
- cleanup result

Do not store credentials or tokens in GitHub.

## Gate rule

**Do not check** `Two-user account isolation test` solely from regex/unit contracts, service-role queries, or schema inspection.

The checkbox can be checked only after the repository contract is green and a deployed exercise with two distinct authenticated QA users proves the cross-account protections above.