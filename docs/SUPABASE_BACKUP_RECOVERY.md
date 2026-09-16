# Motion Supply Brand OS — Supabase Backup & Recovery Runbook

Last verified: 2026-09-16

## 1. Current production recovery posture

Production Supabase project: `ezgsrckpxlxhmmybogct` (`Motion Supply Brand OS`, `us-east-1`).

Verified project facts at the time this runbook was written:

- Organization plan: **Free**.
- Project status: `ACTIVE_HEALTHY`.
- Postgres: **17.6.1.166**.
- Database size: approximately **12 MB**.
- Public application tables: 20.
- Supabase Storage buckets: **0**.
- The application repo does not currently call Supabase Storage APIs.

Supabase's current backup documentation says automatic daily platform backups are provided to Pro, Team, and Enterprise projects. Free projects should regularly create logical exports and keep them off-site. Therefore **this project must not assume a Supabase-managed daily restore point while it remains on Free**.

### Recovery objectives while on Free

- **Target export cadence:** once per day while the app has active customer data, plus immediately before a risky database operation or major release.
- **Maximum claimed RPO:** 24 hours **only when a successful off-site export less than 24 hours old exists**. If no such export exists, the RPO is unknown and must be reported honestly.
- **RTO:** unknown until a full restore drill has been completed and timed. Do not promise a recovery time before that drill.
- For a broad paid launch, upgrading to a paid Supabase plan materially improves the backup posture because managed daily backups become available; PITR is a separate paid add-on when a tighter RPO is required.

## 2. Safety rules

1. **Never restore over production as the first recovery attempt.** Restore to a new/disposable Supabase project first and validate it.
2. **Never blindly re-run `sql/v2_operating_intelligence_migration.sql` during recovery.** A database dump contains the database state at the backup point. Use the read-only verifier `sql/v2_operating_intelligence_verify.sql` to check the restored V2 contract before considering any migration.
3. **Never commit dump files, database passwords, access tokens, service-role keys, or connection strings to Git.**
4. Treat `roles.sql`, `schema.sql`, and especially `data.sql` as sensitive backup material. The export can contain user/account information and password hashes.
5. Keep at least one copy **outside Supabase and outside the application repository**. Encrypt backup archives at rest and restrict access to the smallest practical set of operators.
6. A backup is not considered usable merely because the dump command exited successfully. It becomes a recovery point only after integrity checks, secure off-site copy, and periodic restore drills.
7. A destructive production restore requires an incident declaration, a chosen recovery point, an explicit operator read-back of expected data loss/downtime, and confirmation from the account owner before proceeding.

## 3. Required tools

Before an export or restore:

```bash
supabase --version
supabase db dump --help
psql --version
```

The Supabase CLI uses Docker for its managed dump workflow, so Docker must also be available. Do not guess CLI flags: if the installed CLI differs from this runbook, stop and confirm the current `--help` and official Supabase docs first.

Use the **Session pooler** connection string from the Supabase Dashboard's Connect panel unless the current Supabase docs explicitly direct otherwise for the operation.

Store the connection string only in the current shell/session or a secure secret manager, for example:

```bash
export OLD_DB_URL='postgresql://postgres.PROJECT_REF:PASSWORD@SESSION_POOLER_HOST:5432/postgres'
```

Do not paste the real URL into scripts, issue comments, CI logs, or this repository.

## 4. Create a logical recovery export

Create a new local directory that is outside the repo or covered by `.gitignore`:

```bash
mkdir -p backups/brand-os-YYYY-MM-DD
cd backups/brand-os-YYYY-MM-DD
```

Run the current Supabase-documented three-part export:

```bash
supabase db dump --db-url "$OLD_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$OLD_DB_URL" -f schema.sql
supabase db dump --db-url "$OLD_DB_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

Then verify the files exist and are non-empty:

```bash
test -s roles.sql
test -s schema.sql
test -s data.sql
wc -c roles.sql schema.sql data.sql
```

Record a SHA-256 manifest without exposing file contents:

```bash
sha256sum roles.sql schema.sql data.sql > SHA256SUMS
sha256sum -c SHA256SUMS
```

### Export record

For each recovery point, record separately from the dump contents:

- UTC timestamp of the export.
- Production Git SHA deployed at that time.
- Supabase project ref.
- Supabase CLI version.
- Postgres version.
- Byte size and SHA-256 for each dump file.
- Result of `select count(*) from auth.users;`.
- Row counts for the application's critical owner-scoped tables.
- Result of the read-only V2 verifier, when applicable.
- Off-site destination identifier (not credentials).

## 5. Off-site retention

After verifying the manifest:

1. Encrypt the recovery directory using the organization's approved encrypted-storage method.
2. Copy the encrypted archive to storage that is **not inside the Supabase project and not inside GitHub**.
3. Confirm the copied archive can be read and its checksum matches.
4. Keep a simple rotation appropriate to the current scale. Until a managed backup plan replaces it, retain at minimum several recent daily recovery points and at least one older known-good restore-drilled copy.
5. Remove unencrypted temporary dump files from shared or transient machines after the encrypted/off-site copy is verified.

Do not call the backup complete if the only copy is on the same laptop that generated it.

## 6. Restore drill — always use a disposable target first

A restore drill is intentionally **not** a production restore.

### Prepare the target

1. Create a separate Supabase project for the drill.
2. Use the same or compatible Postgres major version when possible.
3. Record the new project's connection string in a shell secret such as `NEW_DB_URL`.
4. Confirm required extensions/configuration before importing.
5. Do not point the live Vercel production deployment at this target.

### Restore

Use the current Supabase-documented restore flow:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NEW_DB_URL"
```

If restore output contains permission, version, Auth-schema, Storage-schema, extension, or role errors, **do not ignore them and do not switch production**. Resolve the incompatibility using current Supabase documentation and repeat the drill from a clean target.

## 7. Post-restore validation gate

A restore is not accepted until all of the following are checked.

### Database and Auth

- `auth.users` count is consistent with the recorded export count.
- Critical application tables exist.
- Critical table row counts are plausible relative to the export record.
- Foreign keys and owner relationships remain intact.
- RLS / browser-access boundaries match the intended production contract.
- No secret integration credential is exposed to browser roles.

### Brand OS schema contract

Run the **read-only** V2 verifier against the restored database:

```text
sql/v2_operating_intelligence_verify.sql
```

Do not apply `sql/v2_operating_intelligence_migration.sql` unless verification identifies a real schema gap and a separate migration plan has been reviewed.

Also verify the current P0 schema/security contracts represented by the SQL files and automated tests in this repository.

### Application validation

Using a non-production deployment configured only for the disposable restored project, verify:

- `/api/health` returns 200 with the expected service configuration.
- Signup/sign-in/recovery works on test users.
- Existing restored users can authenticate as expected for the recovery scenario; if project JWT secrets changed, expect existing sessions/tokens to require re-authentication.
- Brand/SKU create, read, update, and delete remain owner-scoped.
- Business Memory remains owner-scoped.
- Billing state in Brand OS is reconciled against Stripe before any customer-facing cutover.
- Shopify/integration rows remain scoped to their owner/brand.
- V2 operating data remains owner/brand scoped.
- A second test user cannot read or mutate the first user's records.

### External configuration that a database dump does not prove

Record and verify separately:

- Vercel environment variables.
- Supabase API/JWT/Auth settings and redirect URLs.
- SMTP configuration.
- Stripe webhook endpoints and secrets.
- Shopify app/OAuth/webhook configuration.
- Any Edge Functions, custom domains, DNS, or external provider configuration.
- Storage objects if Brand OS begins using Supabase Storage in the future.

At the time this runbook was written the production project had **0 Storage buckets**, but that must be re-checked during every recovery review. Supabase database backups store Storage metadata, not deleted binary objects themselves; future Storage use requires a separate object backup procedure.

## 8. Production incident decision flow

### A. Database is healthy but bad application code shipped

Do **not** restore the database. Roll back/fix the application deployment. A database restore would create unnecessary data loss.

### B. A small set of rows was modified incorrectly

Prefer a targeted, reviewed data repair if the affected rows and correct values can be proven. Create a fresh logical export before the repair. Do not restore the entire project just to repair a known small set of rows.

### C. Broad destructive database change / unrecoverable corruption

1. Stop risky writes if practical.
2. Create a current forensic export if the database remains reachable.
3. Identify the latest known-good off-site recovery point.
4. Calculate and state the expected data-loss window from that recovery point.
5. Restore that backup to a disposable target first.
6. Complete the validation gate above.
7. Obtain explicit owner approval for any destructive production restore/cutover.
8. Reconcile Stripe, Shopify, and other external systems after recovery; their state may have advanced beyond the database recovery point.

### D. Supabase project is accidentally deleted

Supabase documents project deletion as irreversible, including loss of platform-held backups. Recovery therefore depends on an off-site export. Create a new project, restore the latest validated export, recreate external configuration, validate ownership/security, then intentionally cut over Vercel only after review.

## 9. Drill cadence

Until managed backups replace the Free-plan posture:

- Verify an off-site export is being produced at least daily when real customer data changes daily.
- Run a non-production restore drill before broad paid launch.
- Repeat a restore drill after material schema/Auth changes and periodically thereafter.
- Record actual drill duration; only then set a defensible RTO.
- Re-read the current Supabase backup/restore docs during every drill because platform behavior and CLI commands can change.

## 10. Paid-plan transition

When the project upgrades from Free:

1. Confirm the new organization/project plan in Supabase, not from memory.
2. Confirm managed backup availability in **Database → Backups**.
3. Record the actual retention window shown for the project.
4. Decide whether the business requires PITR based on the acceptable RPO and current Supabase pricing/compute requirements.
5. Keep a periodic independent logical export even after managed backups are available if the business requires provider-independent recovery.
6. Update this runbook and run another restore drill before claiming the new recovery posture.

## 11. Official references used for this runbook

Re-verify these current Supabase docs before a real recovery:

- Database Backups: `https://supabase.com/docs/guides/platform/backups`
- Backup and Restore using the CLI: `https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore`
- `supabase db dump` CLI reference: `https://supabase.com/docs/reference/cli/supabase-db-dump`
- Production Checklist: `https://supabase.com/docs/guides/deployment/going-into-prod`
- Project deletion / recovery implications: `https://supabase.com/docs/guides/platform/delete-project`

This runbook is a recovery procedure, not evidence that a fresh backup currently exists. The operator must verify the latest off-site recovery point before representing the system as recoverable to a particular RPO.
