import test from 'node:test';
import assert from 'node:assert/strict';
import {clearStaleStripeBilling} from '../lib/stripe-customer-recovery.js';

test('stale cleanup removes entitlement-bearing subscription fields',async()=>{
  let payload;
  const admin={from(){return{update(p){payload=p;return{eq(){return Promise.resolve({error:null})}}}}}};
  await clearStaleStripeBilling(admin,'u');
  assert.equal(payload.status,'inactive');
  assert.equal(payload.current_period_end,null);
  assert.equal(payload.cancel_at_period_end,false);
  assert.equal(payload.trial_end,null);
  assert.equal(payload.latest_invoice_status,null);
});
