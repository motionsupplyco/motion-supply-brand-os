const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const runbook = fs.readFileSync(path.join(root, 'docs', 'SUPABASE_BACKUP_RECOVERY.md'), 'utf8');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

test('Supabase recovery runbook reflects the current Free-plan posture', () => {
  assert.match(runbook, /Free plan/i);
  assert.match(runbook, /supabase db dump/i);
  assert.match(runbook, /off-site/i);
  assert.match(runbook, /encrypted/i);
  assert.match(runbook, /restore/i);
});

test('backup procedure protects sensitive Auth and customer data', () => {
  assert.match(runbook, /auth\.users/i);
  assert.match(runbook, /password hash/i);
  assert.match(runbook, /do not commit/i);
  assert.match(runbook, /checksum/i);
  assert.match(gitignore, /^backups\/$/m);
  assert.match(gitignore, /^roles\.sql$/m);
  assert.match(gitignore, /^schema\.sql$/m);
  assert.match(gitignore, /^data\.sql$/m);
});

test('restore procedure is a drill against a disposable target, not production', () => {
  assert.match(runbook, /disposable/i);
  assert.match(runbook, /new project/i);
  assert.match(runbook, /single-transaction/i);
  assert.match(runbook, /ON_ERROR_STOP=1/i);
  assert.match(runbook, /row counts/i);
  assert.match(runbook, /RLS/i);
});

test('recovery explicitly separates restore verification from schema migrations', () => {
  assert.match(runbook, /v2_operating_intelligence_verify\.sql/i);
  assert.match(runbook, /never blindly/i);
  assert.match(runbook, /do not re-run/i);
  assert.match(runbook, /migration/i);
});
