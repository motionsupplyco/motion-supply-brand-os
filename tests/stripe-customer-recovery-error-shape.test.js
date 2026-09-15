import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyStripeCustomer} from '../lib/stripe-customer-recovery.js';

test('raw Stripe resource_missing error shape is recoverable',async()=>{
  const stripe={customers:{retrieve:async()=>{const e=new Error('missing');e.raw={code:'resource_missing'};throw e}}};
  const result=await verifyStripeCustomer(stripe,'cus_old');
  assert.equal(result.valid,false);
  assert.equal(result.missing,true);
});
