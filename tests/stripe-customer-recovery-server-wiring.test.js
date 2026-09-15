import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');

test('server wires stale Stripe recovery into checkout and portal',()=>{
  assert.match(server,/stripe-customer-recovery\.integration\.js/,'server must import the recovery integration');
  assert.match(server,/customerForCheckout/,'checkout must use the recovery integration');
  assert.match(server,/customerForPortal/,'portal must use the recovery integration');
  assert.match(server,/STALE_STRIPE_CUSTOMER/,'portal must return a specific recoverable stale-customer code');
});
