import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeStripeBilling} from '../lib/stripe-customer-recovery.integration.js';

test('stale active Stripe row is reset before checkout guards evaluate it',async()=>{
  const updates=[];
  const admin={from(){return{update(payload){updates.push(payload);return{eq(){return Promise.resolve({error:null})}}}}}};
  const stripe={customers:{retrieve:async()=>{const error=new Error('No such customer');error.code='resource_missing';throw error}}};
  const existing={stripe_customer_id:'cus_stale',stripe_subscription_id:'sub_stale',price_id:'price_old',status:'active',current_period_end:'2099-01-01',cancel_at_period_end:true,canceled_at:'2098-01-01',trial_end:'2098-01-01',latest_invoice_status:'paid'};
  const sanitized=await sanitizeStripeBilling({stripe,admin,user:{id:'user_1'},existing});
  assert.equal(sanitized.status,'inactive');
  assert.equal(sanitized.stripe_customer_id,null);
  assert.equal(sanitized.stripe_subscription_id,null);
  assert.equal(sanitized.price_id,null);
  assert.equal(sanitized.current_period_end,null);
  assert.equal(sanitized.cancel_at_period_end,false);
  assert.equal(sanitized.canceled_at,null);
  assert.equal(sanitized.trial_end,null);
  assert.equal(sanitized.latest_invoice_status,null);
  assert.equal(updates.length,1);
});

test('valid active Stripe row is preserved',async()=>{
  const admin={from(){throw new Error('database should not be changed')}};
  const stripe={customers:{retrieve:async id=>({id})}};
  const existing={stripe_customer_id:'cus_live',stripe_subscription_id:'sub_live',status:'active'};
  const sanitized=await sanitizeStripeBilling({stripe,admin,user:{id:'user_1'},existing});
  assert.equal(sanitized,existing);
});
