import test from 'node:test';
import assert from 'node:assert/strict';
import {customerForCheckout,customerForPortal} from '../lib/stripe-customer-recovery.integration.js';

function adminMock(row={}){
  const state={row:{...row}};
  const chain={
    update(payload){Object.assign(state.row,payload);return this},
    eq(){return Promise.resolve({error:null})},
    upsert(payload){Object.assign(state.row,payload);return Promise.resolve({error:null})}
  };
  return{state,from(){return chain}};
}

test('checkout replaces a customer missing from the configured Stripe environment',async()=>{
  const admin=adminMock({stripe_customer_id:'cus_test_old',stripe_subscription_id:null,status:'inactive'});
  const stripe={customers:{
    retrieve:async()=>{const e=new Error('No such customer');e.code='resource_missing';throw e},
    create:async()=>({id:'cus_live_new'})
  }};
  const id=await customerForCheckout({stripe,admin,user:{id:'user-1',email:'owner@example.com'},existing:{stripe_customer_id:'cus_test_old'}});
  assert.equal(id,'cus_live_new');
  assert.equal(admin.state.row.stripe_customer_id,'cus_live_new');
  assert.equal(admin.state.row.status,'inactive');
});

test('portal clears a stale customer and returns a recoverable conflict',async()=>{
  const admin=adminMock({stripe_customer_id:'cus_test_old',stripe_subscription_id:'sub_test_old',status:'active'});
  const stripe={customers:{retrieve:async()=>{const e=new Error('No such customer');e.code='resource_missing';throw e}}};
  const result=await customerForPortal({stripe,admin,user:{id:'user-1'},existing:{stripe_customer_id:'cus_test_old'}});
  assert.equal(result.ok,false);
  assert.equal(result.status,409);
  assert.equal(result.code,'STALE_STRIPE_CUSTOMER');
  assert.equal(admin.state.row.stripe_customer_id,null);
  assert.equal(admin.state.row.stripe_subscription_id,null);
  assert.equal(admin.state.row.status,'inactive');
});
