import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');

test('password recovery uses the implicit flow expected by the browser reset handler',()=>{
  assert.match(server,/flowType:'implicit'/);
  assert.match(server,/resetPasswordForEmail\(email,\{redirectTo:`\$\{redirectOrigin\}\/\?reset=1`\}\)/);
  assert.match(server,/RECOVERY_RATE_LIMITED/);
  assert.match(server,/RECOVERY_DELIVERY_FAILED/);
});

test('checkout hides Stripe Link so SMS Link verification is not required',()=>{
  const start=server.indexOf("app.post('/api/create-checkout-session'");
  const end=server.indexOf("app.post('/api/create-portal-session'",start);
  const route=start>=0&&end>start?server.slice(start,end):'';
  assert.ok(route,'checkout route must exist');
  assert.match(route,/wallet_options:\{link:\{display:'never'\}\}/);
  assert.match(route,/line_items:\[\{price:process\.env\.STRIPE_PRO_PRICE_ID,quantity:1\}\]/);
});
