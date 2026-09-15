import test from 'node:test';
import assert from 'node:assert/strict';
import {customerForCheckout} from '../lib/stripe-customer-recovery.integration.js';

test('replacement customer creation failure does not produce a fake customer id',async()=>{
  const stripe={customers:{retrieve:async()=>{const e=new Error('missing');e.code='resource_missing';throw e},create:async()=>{throw new Error('create failed')}}};
  const chain={update(){return this},eq(){return Promise.resolve({error:null})}};
  const admin={from(){return chain}};
  await assert.rejects(()=>customerForCheckout({stripe,admin,user:{id:'u',email:'x@example.com'},existing:{stripe_customer_id:'cus_old'}}),/create failed/);
});
