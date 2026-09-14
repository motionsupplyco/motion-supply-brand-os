# Motion Supply Brand OS database changes

This directory contains the baseline schema plus P0 hardening SQL. The production project was hardened iteratively, so its Supabase migration history contains several small follow-up migrations. Do **not** infer fresh-environment order from the timestamps in the live project.

## Canonical fresh-environment order

1. `schema.sql` — baseline application schema. Signed-in product events cascade with the Auth user so account deletion removes associated analytics.
2. `p0_production_migration.sql` — P0 account/billing lifecycle, Business Memory, server-only event/deletion tables, RLS and grants.
3. `p0_covering_indexes.sql` — composite-FK and owner/time indexes needed by the P0 schema.
4. `p0_account_deletion_audit_fix.sql` — preserves the deletion lifecycle audit row after the Auth user is removed.
5. `p0_subscription_status_constraint.sql` — constrains local subscription state to supported lifecycle values.
6. `p0_webhook_idempotency.sql` — canonical Stripe webhook ledger + retry-safe atomic claim function. This file includes `claimed_at`, failed-event retry, and stale-processing reclaim behavior.
7. `p0_server_only_data_api.sql` — removes direct `anon`/`authenticated` table privileges because Brand OS cloud data is accessed through the Express API/service role. RLS remains enabled as defense in depth.

After applying these files, run the Supabase security and performance advisors and verify the application contract tests before deploying.

## Upgrade-only / historical alignment files

The following files are retained so an older deployed database can be brought forward safely, but they are not additional requirements after the canonical fresh sequence above:

- `p0_business_memory_index_alignment.sql` — aligns the Business Memory global/brand uniqueness index for databases that previously used the `coalesce()` form. The canonical P0 schema already uses `NULLS NOT DISTINCT`.
- `p0_product_events_delete_cascade.sql` — changes older databases from `ON DELETE SET NULL` to `ON DELETE CASCADE` for signed-in product events. The current `schema.sql` already creates the cascade directly.
- `p0_subscription_least_privilege.sql` — narrowed subscription grants during the hardening sequence. `p0_server_only_data_api.sql` is stricter and supersedes browser table access entirely.
- `p0_webhook_retry_reclaim.sql` — upgrades an older `ON CONFLICT DO NOTHING` Stripe claim function so failed/stale events can retry. The canonical `p0_webhook_idempotency.sql` already contains this behavior for fresh environments.

## Production migration history note

The connected production project contains iterative migration entries from the P0 hardening session, including multiple webhook-claim refinements and a duplicated `p0_subscription_status_constraint` migration name. These entries document how production reached its current state; they are **not** the canonical fresh-install sequence.

## Access model

- Browser code calls the Brand OS `/api/*` routes for cloud data.
- Application tables have no direct `anon` or `authenticated` table grants after `p0_server_only_data_api.sql`.
- The server uses the Supabase secret/service-role credential; never expose it to browser or mobile clients.
- RLS stays enabled as defense in depth even though normal browser roles have no table privileges.
- Stripe webhook claim RPC execution is restricted to `service_role`.

## Account deletion behavior

- User-owned business rows cascade from `auth.users`.
- Signed-in `product_events` cascade from the deleted Auth user instead of being retained with a null user ID.
- Anonymous-only analytics rows with no user association are not part of an account and may remain as anonymous telemetry.
- `account_deletion_requests` intentionally does **not** foreign-key to `auth.users`; its server-only lifecycle row survives deletion as an operational audit record.

## Verification gates

A database change is not complete until all of the following pass:

- `npm test`
- CI lockfile drift check and syntax checks
- Supabase security advisor
- Supabase performance advisor
- Live billing/webhook probe for any changed Stripe lifecycle behavior
