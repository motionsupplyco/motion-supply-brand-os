# V2 production release checklist

This checklist is the production gate for PR #20 (`v2-operating-intelligence`). Do not skip or reorder the migration and deployment steps.

## 1. Freeze and verify the release head

Before any production write:

- Confirm the PR is still based on `main`, has no merge conflicts, and is `0` commits behind `main`.
- Record the exact PR head SHA being released.
- Require Brand OS CI to pass on that exact head.
- Require the matching Vercel preview deployment to be `READY` with no unresolved preview feedback.
- Check preview build logs and recent error/fatal runtime logs.
- Do not merge if the head changes after these checks; repeat them on the new head.

## 2. Confirm the current production database state

Before applying SQL, verify the V2 tables are either all absent (fresh install) or already match the migration contract. Do not treat a partial install as success.

Expected V2 tables:

- `integration_connections`
- `integration_sync_runs`
- `commerce_daily_snapshots`
- `inventory_snapshots`
- `sku_planning_settings`
- `cash_forecasts`
- `operating_alerts`
- `integration_webhook_events`

Also confirm the existing ownership keys the migration depends on are present:

- `brands(id, owner_id)` is unique.
- `skus.id` is a primary key.
- Existing SKU ownership remains tied to `(brand_id, owner_id)`.

## 3. Apply the additive V2 database migration before merging application code

Use the normal Supabase migration/DDL workflow, not ad-hoc application requests.

Apply in this order:

1. `sql/v2_operating_intelligence_migration.sql`
2. `sql/v2_planning_velocity_extension.sql`

The extension is intentionally repeat-safe and remains valid even though `manual_weekly_demand` is now present in the base migration.

Why migration comes first: current production code does not depend on these new tables, so creating them is additive. Merging V2 code first would leave the new workspaces in an intentional `V2_STORAGE_NOT_READY` fallback until the migration is applied.

## 4. Verify the migration before merge

After the migration, verify all of the following:

- All eight V2 tables exist.
- Row Level Security is enabled on every V2 table.
- `anon` and `authenticated` do not have direct table privileges on the V2 server-proxied tables.
- Brand-scoped foreign keys bind `(brand_id, owner_id)` to `brands(id, owner_id)`.
- Optional SKU references bind `(sku_id, brand_id, owner_id)` to `skus(id, brand_id, owner_id)`.
- The unique supporting index `skus_id_brand_owner_key` exists.
- `sku_planning_settings.manual_weekly_demand` exists.
- Existing production auth, billing, Brands/SKUs, Business Memory, and `/api/health` remain healthy.

If any verification fails, stop. Do not merge PR #20 until the schema is corrected and re-verified.

## 5. Integration configuration gate

Do not paste secret values into GitHub comments, chat, logs, or browser code.

Shopify should report `configured: true` only when all required server-side configuration exists:

- `INTEGRATION_TOKEN_ENCRYPTION_KEY`
- `INTEGRATION_OAUTH_STATE_SECRET`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`

`SHOPIFY_SCOPES` and `SHOPIFY_API_VERSION` are optional overrides.

It is safe to ship with Shopify still reporting `configured: false`; the integration UI is designed to fail closed and must not fake a connection. Do not enable the connection surface until the real Shopify app/callback configuration is ready.

## 6. Merge only the verified head

When the release owner explicitly approves shipping:

- Mark PR #20 ready for review if it is still Draft.
- Reconfirm the exact head SHA has not changed.
- Merge using that exact expected head SHA.
- Do not merge a newer unverified head by accident.

## 7. Verify the production deployment

After merge, verify the production deployment built from the merge commit and then check:

- `https://www.motionsupplyos.com/api/health` returns HTTP 200 and all expected health flags remain true.
- Production build logs contain no build errors.
- Recent production runtime logs contain no new error/fatal cluster caused by V2.
- Existing sign-in/account and billing surfaces still load.
- Brands/SKUs and Business Memory still load for an authenticated account.
- V2 signed-in workspaces can read/write their server-proxied storage without `V2_STORAGE_NOT_READY`.
- Public integration configuration does not expose credentials or generic provider metadata.

## 8. Shopify live verification only when the real provider app is configured

Do not create fake production integration state merely to satisfy this checklist.

When a real Shopify development/test store and production app credentials are available, verify:

- OAuth redirects only to the configured Brand OS callback.
- Required scopes are present.
- Access and refresh tokens are stored only as encrypted ciphertext.
- Initial sync writes aggregate, PII-minimized operating data.
- Webhook registration succeeds for the required topics.
- A completed webhook deduplicates.
- A failed webhook retry can reclaim the event.
- A stale worker cannot overwrite the state of a newer webhook attempt.
- App uninstall marks the connection disconnected and clears stored token ciphertext.

## Rollback rule

If the V2 application deployment causes a production regression, roll back the Vercel application deployment first. The V2 migration is additive and should remain in place unless a separate reviewed data/schema rollback is explicitly required. Never drop the V2 tables as an emergency first response.
