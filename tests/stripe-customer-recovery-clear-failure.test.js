import test from 'node:test';
import assert from 'node:assert/strict';
import {clearStaleStripeBilling} from '../lib/stripe-customer-recovery.js';

test('cleanup surfaces database failures instead of silently continuing',async()=>{
  const admin={from(){return{update(){return{eq(){return Promise.resolve({error:new Error('cleanup failed')})}}}}}};
  await assert.rejects(()=>clearStaleStripeBilling(admin,'u'),/cleanup failed/);
});
