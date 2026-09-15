export function isStripeResourceMissing(error){
  return Boolean(error&&(error.code==='resource_missing'||error.raw?.code==='resource_missing'));
}

export async function verifyStripeCustomer(stripe,customerId){
  if(!customerId)return{valid:false,missing:true};
  try{
    const customer=await stripe.customers.retrieve(customerId);
    if(customer?.deleted)return{valid:false,missing:true};
    return{valid:true,customer};
  }catch(error){
    if(isStripeResourceMissing(error))return{valid:false,missing:true,error};
    throw error;
  }
}

export async function clearStaleStripeBilling(admin,userId){
  const{error}=await admin.from('subscriptions').update({
    stripe_customer_id:null,
    stripe_subscription_id:null,
    price_id:null,
    status:'inactive',
    current_period_end:null,
    cancel_at_period_end:false,
    canceled_at:null,
    trial_end:null,
    latest_invoice_status:null,
    updated_at:new Date().toISOString()
  }).eq('user_id',userId);
  if(error)throw error;
}
