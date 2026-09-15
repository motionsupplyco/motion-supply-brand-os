import test from 'node:test';
import assert from 'node:assert/strict';
import {customerForCheckout,customerForPortal} from '../lib/stripe-customer-recovery.integration.js';

const admin={from(){throw new Error('database must not be mutated for transient Stripe failures')}};
const transientStripe={customers:{retrieve:async()=>{const e=new Error('Stripe temporarily unavailable');e.code='api_error';throw e}}};

test('checkout does not erase billing state on transient Stripe errors',async()=>{
  await assert.rejects(()=>customerForCheckout({stripe:transientStripe,admin,user:{id:'u',email:'x@example.com'},existing:{stripe_customer_id:'cus_live'}}),/temporarily unavailable/);
});

test('portal does not erase billing state on transient Stripe errors',async()=>{
  await assert.rejects(()=>customerForPortal({stripe:transientStripe,admin,user:{id:'u'},existing:{stripe_customer_id:'cus_live'}}),/temporarily unavailable/);
});
