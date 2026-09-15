import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');

test('checkout does not blindly reuse a stale Stripe customer id',()=>{
  const start=server.indexOf("app.post('/api/create-checkout-session'");
  const end=server.indexOf("app.post('/api/create-portal-session'",start);
  const route=start>=0&&end>start?server.slice(start,end):'';
  assert.ok(route,'checkout route must exist');
  assert.match(route,/stripe\.customers\.retrieve\(customerId\)/,'checkout must verify a stored customer against the configured Stripe environment');
  assert.match(route,/resource_missing|STALE_STRIPE_CUSTOMER/,'checkout must recognize a missing/stale Stripe customer');
  assert.match(route,/stripe_customer_id:null/,'stale customer recovery must clear the invalid stored customer before replacement');
});

test('portal returns a recoverable stale-customer response instead of a generic 500',()=>{
  const start=server.indexOf("app.post('/api/create-portal-session'");
  const end=server.indexOf("app.use('/api'",start);
  const route=start>=0&&end>start?server.slice(start,end):'';
  assert.ok(route,'portal route must exist');
  assert.match(route,/stripe\.customers\.retrieve\(existing\.stripe_customer_id\)/,'portal must verify the stored Stripe customer');
  assert.match(route,/STALE_STRIPE_CUSTOMER/,'portal must expose a specific stale-customer recovery code');
  assert.doesNotMatch(route,/catch\(e\)\{console\.error\('portal',e\);res\.status\(500\)\.json\(\{error:'Could not open billing portal\.'\}\)\}/,'portal must not collapse a stale customer into the old generic failure path');
});
