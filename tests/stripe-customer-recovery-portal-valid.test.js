import test from 'node:test';
import assert from 'node:assert/strict';
import {customerForPortal} from '../lib/stripe-customer-recovery.integration.js';

test('valid portal customer returns the stored customer id',async()=>{
  const stripe={customers:{retrieve:async id=>({id})}};
  const result=await customerForPortal({stripe,admin:null,user:{id:'u'},existing:{stripe_customer_id:'cus_live'}});
  assert.deepEqual(result,{ok:true,customerId:'cus_live'});
});
