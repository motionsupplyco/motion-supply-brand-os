import test from 'node:test';
import assert from 'node:assert/strict';
import {customerForCheckout} from '../lib/stripe-customer-recovery.integration.js';

test('one stale checkout recovery creates exactly one replacement customer',async()=>{
  let creates=0;
  const stripe={customers:{retrieve:async()=>{const e=new Error('missing');e.code='resource_missing';throw e},create:async()=>{creates++;return{id:'cus_new'}}}};
  const chain={update(){return this},eq(){return Promise.resolve({error:null})},upsert(){return Promise.resolve({error:null})}};
  const admin={from(){return chain}};
  await customerForCheckout({stripe,admin,user:{id:'u',email:'x@example.com'},existing:{stripe_customer_id:'cus_old'}});
  assert.equal(creates,1);
});
