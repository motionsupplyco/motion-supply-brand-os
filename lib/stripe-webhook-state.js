export async function claimStripeWebhook(admin,event){
  const {data,error}=await admin.rpc('claim_stripe_webhook_event',{p_event_id:event.id,p_event_type:event.type});
  if(error)throw error;
  return data===true;
}

export async function completeStripeWebhook(admin,eventId){
  const {error}=await admin.from('stripe_webhook_events').update({status:'completed',processed_at:new Date().toISOString(),failure_reason:null}).eq('event_id',eventId);
  if(error)throw error;
}

export async function failStripeWebhook(admin,eventId,errorValue){
  const reason=String(errorValue?.message||errorValue||'Webhook processing failed').slice(0,500);
  const {error}=await admin.from('stripe_webhook_events').update({status:'failed',processed_at:null,failure_reason:reason}).eq('event_id',eventId);
  if(error)console.error('stripe-webhook-ledger',error);
}
