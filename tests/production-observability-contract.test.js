import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const structuredLog = fs.readFileSync(path.join(root, 'lib', 'structured-log.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'production-health-monitor.yml'), 'utf8');
const runbook = fs.readFileSync(path.join(root, 'docs', 'PRODUCTION_OBSERVABILITY.md'), 'utf8');

test('production API exposes a correlatable non-secret health contract', () => {
  assert.match(server, /X-Request-Id/);
  assert.match(server, /crypto\.randomUUID\(\)/);
  const healthRoute = server.match(/app\.get\('\/api\/health',[^\n]+/i)?.[0] || '';
  assert.match(healthRoute, /res\.json\(\{ok:true/);
  assert.match(healthRoute, /authConfigured:/);
  assert.match(healthRoute, /cloudConfigured:/);
  assert.match(healthRoute, /billingConfigured:/);
  assert.doesNotMatch(healthRoute, /\b(?:secret|token|password|databaseUrl|supabaseUrl)\s*:/i);
});

test('structured API logging is wired immediately after request ID middleware', () => {
  assert.match(server, /import \{ structuredRequestLogger \} from '\.\/lib\/structured-log\.js';/);
  assert.equal((server.match(/app\.use\(structuredRequestLogger\(\)\);/g) || []).length, 1);
  const requestIdIndex = server.indexOf("app.use((req,res,next)=>{res.setHeader('X-Request-Id'");
  const structuredIndex = server.indexOf('app.use(structuredRequestLogger());');
  const rawStripeIndex = server.indexOf("app.post('/api/stripe-webhook'");
  assert.ok(requestIdIndex >= 0 && structuredIndex > requestIdIndex);
  assert.ok(rawStripeIndex < 0 || structuredIndex < rawStripeIndex);
});

test('structured logger allowlists operational fields and never inspects sensitive request payloads', () => {
  for (const field of ['timestamp','level','event','request_id','method','route','status','duration_ms']) {
    assert.match(structuredLog, new RegExp(`${field}:`));
  }
  assert.match(structuredLog, /event:'http_request'/);
  assert.match(structuredLog, /startsWith\('\/api'\)/);
  assert.doesNotMatch(structuredLog, /req\?\.body|req\.body|req\?\.query|req\.query|authorization|cookie|x-forwarded-for|req\?\.ip|req\.ip/i);
});

test('external uptime workflow checks production root and full health readiness every 15 minutes', () => {
  assert.match(workflow, /cron:\s*'\*\/15 \* \* \* \*'/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /https:\/\/www\.motionsupplyos\.com\//);
  assert.match(workflow, /https:\/\/www\.motionsupplyos\.com\/api\/health/);
  assert.match(workflow, /--retry 2/);
  assert.match(workflow, /--max-time 30/);
  for (const key of ['ok', 'authConfigured', 'cloudConfigured', 'billingConfigured']) {
    assert.match(workflow, new RegExp(`['\"]${key}['\"]`));
  }
});

test('health monitor fails closed and emits only bounded structured status', () => {
  assert.match(workflow, /health_contract_failed/);
  assert.match(workflow, /invalid_json/);
  assert.match(workflow, /process\.exit\(1\)/);
  assert.match(workflow, /production_health_check/);
  assert.doesNotMatch(workflow, /SUPABASE_SECRET|SERVICE_ROLE|STRIPE_SECRET|SHOPIFY.*TOKEN/i);
});

test('observability runbook distinguishes incidents from expected auth and plan-gate responses', () => {
  assert.match(runbook, /401/);
  assert.match(runbook, /402/);
  assert.match(runbook, /5xx/);
  assert.match(runbook, /X-Request-Id/);
  assert.match(runbook, /request ID/i);
  assert.match(runbook, /Never log:/i);
  assert.match(runbook, /http_request/);
  assert.match(runbook, /alert delivery/i);
  assert.match(runbook, /remain unchecked/i);
});
