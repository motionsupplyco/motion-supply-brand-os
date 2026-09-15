import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');

test('checkout sanitizes Stripe state before duplicate subscription guards',()=>{
  const routeStart=server.indexOf("app.post('/api/create-checkout-session'");
  const routeEnd=server.indexOf("app.post('/api/create-portal-session'",routeStart);
  assert.ok(routeStart>=0&&routeEnd>routeStart,'checkout route must exist');
  const route=server.slice(routeStart,routeEnd);
  const sanitize=route.indexOf('sanitizeStripeBilling');
  const activeGuard=route.indexOf('isActiveSub(');
  const openGuard=route.indexOf('hasOpenStripeSub(');
  assert.ok(sanitize>=0,'checkout must sanitize persisted Stripe state');
  assert.ok(activeGuard>sanitize,'active-subscription guard must run after sanitization');
  assert.ok(openGuard>sanitize,'open-subscription guard must run after sanitization');
});
