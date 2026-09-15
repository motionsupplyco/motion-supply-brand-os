import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyStripeCustomer} from '../lib/stripe-customer-recovery.js';

test('deleted Stripe customers are stale billing identities',async()=>{
  const stripe={customers:{retrieve:async id=>({id,deleted:true})}};
  const result=await verifyStripeCustomer(stripe,'cus_deleted');
  assert.equal(result.valid,false);
  assert.equal(result.missing,true);
});
