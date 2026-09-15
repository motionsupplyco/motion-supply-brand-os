import test from 'node:test';
import assert from 'node:assert/strict';
import {customerForCheckout} from '../lib/stripe-customer-recovery.integration.js';

test('replacement Stripe customer is bound to authenticated user metadata',async()=>{
  let createArgs=null;
  const stripe={customers:{retrieve:async()=>{const e=new Error('missing');e.code='resource_missing';throw e},create:async args=>{createArgs=args;return{id:'cus_new'}}}};
  const chain={update(){return this},eq(){return Promise.resolve({error:null})},upsert(){return Promise.resolve({error:null})}};
  const admin={from(){return chain}};
  const user={id:'auth-user',email:'owner@example.com'};
  await customerForCheckout({stripe,admin,user,existing:{stripe_customer_id:'cus_stale'}});
  assert.deepEqual(createArgs,{email:'owner@example.com',metadata:{user_id:'auth-user'}});
});
