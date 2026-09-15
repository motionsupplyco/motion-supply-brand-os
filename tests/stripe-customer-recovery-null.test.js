import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyStripeCustomer} from '../lib/stripe-customer-recovery.js';

test('empty customer id is treated as missing without calling Stripe',async()=>{
  const stripe={customers:{retrieve:async()=>{throw new Error('must not call Stripe')}}};
  assert.deepEqual(await verifyStripeCustomer(stripe,null),{valid:false,missing:true});
});
