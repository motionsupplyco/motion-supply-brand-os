import test from 'node:test';
import assert from 'node:assert/strict';
import {customerForCheckout} from '../lib/stripe-customer-recovery.integration.js';

test('checkout fails closed if replacement customer cannot be persisted',async()=>{
  const stripe={customers:{retrieve:async()=>{const e=new Error('missing');e.code='resource_missing';throw e},create:async()=>({id:'cus_new'})}};
  const chain={update(){return this},eq(){return Promise.resolve({error:null})},upsert(){return Promise.resolve({error:new Error('db failed')})}};
  const admin={from(){return chain}};
  await assert.rejects(()=>customerForCheckout({stripe,admin,user:{id:'u',email:'x@example.com'},existing:{stripe_customer_id:'cus_old'}}),/db failed/);
});
