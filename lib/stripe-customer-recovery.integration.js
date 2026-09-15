import {verifyStripeCustomer,clearStaleStripeBilling} from './stripe-customer-recovery.js';

export async function customerForCheckout({stripe,admin,user,existing}){
  let customerId=existing?.stripe_customer_id||null;
  if(customerId){
    const verification=await verifyStripeCustomer(stripe,customerId);
    if(!verification.valid){
      await clearStaleStripeBilling(admin,user.id);
      customerId=null;
    }
  }
  if(!customerId){
    const customer=await stripe.customers.create({email:user.email,metadata:{user_id:user.id}});
    customerId=customer.id;
    const{error}=await admin.from('subscriptions').upsert({user_id:user.id,stripe_customer_id:customerId,status:'inactive',updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error)throw error;
  }
  return customerId;
}

export async function customerForPortal({stripe,admin,user,existing}){
  if(!existing?.stripe_customer_id)return{ok:false,status:400,code:'NO_BILLING_PROFILE',error:'No billing profile found.'};
  const verification=await verifyStripeCustomer(stripe,existing.stripe_customer_id);
  if(verification.valid)return{ok:true,customerId:existing.stripe_customer_id};
  await clearStaleStripeBilling(admin,user.id);
  return{ok:false,status:409,code:'STALE_STRIPE_CUSTOMER',error:'Your old billing profile is no longer available. Refresh and choose Upgrade to reconnect billing.'};
}
