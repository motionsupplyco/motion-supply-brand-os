import test from 'node:test';
import assert from 'node:assert/strict';
import {clearStaleStripeBilling} from '../lib/stripe-customer-recovery.js';

test('stale cleanup can safely write the same reset state repeatedly',async()=>{
  const payloads=[];
  const admin={from(){return{update(p){payloads.push({...p,updated_at:'ignored'});return{eq(){return Promise.resolve({error:null})}}}}}};
  await clearStaleStripeBilling(admin,'u');
  await clearStaleStripeBilling(admin,'u');
  assert.equal(payloads.length,2);
  assert.deepEqual(payloads[0],payloads[1]);
});
