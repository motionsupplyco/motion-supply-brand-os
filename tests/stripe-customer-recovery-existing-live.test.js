import test from 'node:test';
import assert from 'node:assert/strict';
import {customerForCheckout,customerForPortal} from '../lib/stripe-customer-recovery.integration.js';

test('valid Stripe customer is reused and not recreated',async()=>{
  let creates=0;
  const stripe={customers:{retrieve:async id=>({id}),create:async()=>{creates++;return{id:'unexpected'}}}};
  const admin={from(){throw new Error('database should not change')}};
  const user={id:'u',email:'owner@example.com'},existing={stripe_customer_id:'cus_live'};
  assert.equal(await customerForCheckout({stripe,admin,user,existing}),'cus_live');
  const portal=await customerForPortal({stripe,admin,user,existing});
  assert.equal(portal.ok,true);
  assert.equal(portal.customerId,'cus_live');
  assert.equal(creates,0);
});
