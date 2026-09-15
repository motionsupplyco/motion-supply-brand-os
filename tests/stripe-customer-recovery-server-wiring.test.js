import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const integration=await readFile(new URL('../lib/stripe-customer-recovery.integration.js',import.meta.url),'utf8');

test('server wires stale Stripe recovery into checkout and portal',()=>{
  assert.match(server,/stripe-customer-recovery\.integration\.js/,'server must import the recovery integration');
  assert.match(server,/customerForCheckout\(\{stripe,admin,user,existing\}\)/,'checkout must use the recovery integration');
  assert.match(server,/customerForPortal\(\{stripe,admin,user,existing\}\)/,'portal must use the recovery integration');
  assert.match(server,/portalCustomer\.code/,'portal must return the integration recovery code');
  assert.match(integration,/STALE_STRIPE_CUSTOMER/,'recovery integration must define the specific stale-customer code');
});
