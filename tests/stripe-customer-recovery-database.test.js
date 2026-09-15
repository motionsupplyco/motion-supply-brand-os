import test from 'node:test';
import assert from 'node:assert/strict';
import {clearStaleStripeBilling} from '../lib/stripe-customer-recovery.js';

test('cleanup is scoped to the authenticated user id',async()=>{
  let updated=null,filter=null;
  const admin={from(table){assert.equal(table,'subscriptions');return{update(payload){updated=payload;return{eq(column,value){filter={column,value};return Promise.resolve({error:null})}}}}}};
  await clearStaleStripeBilling(admin,'user-123');
  assert.deepEqual(filter,{column:'user_id',value:'user-123'});
  assert.equal(updated.stripe_customer_id,null);
  assert.equal(updated.stripe_subscription_id,null);
  assert.equal(updated.status,'inactive');
});
