import test from 'node:test';
import assert from 'node:assert/strict';
import {customerForPortal} from '../lib/stripe-customer-recovery.integration.js';

test('portal reports missing billing profile without touching Stripe',async()=>{
  const stripe={customers:{retrieve:async()=>{throw new Error('must not call Stripe')}}};
  const result=await customerForPortal({stripe,admin:null,user:{id:'u'},existing:null});
  assert.equal(result.ok,false);
  assert.equal(result.status,400);
  assert.equal(result.code,'NO_BILLING_PROFILE');
});
