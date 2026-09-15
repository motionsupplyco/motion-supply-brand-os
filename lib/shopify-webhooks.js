import crypto from 'node:crypto';

export const SHOPIFY_WEBHOOK_TOPICS=Object.freeze([
  'APP_UNINSTALLED',
  'ORDERS_CREATE',
  'ORDERS_UPDATED',
  'ORDERS_CANCELLED',
  'REFUNDS_CREATE',
  'INVENTORY_LEVELS_UPDATE',
  'PRODUCTS_UPDATE'
]);

export const SHOPIFY_WEBHOOK_CLAIM_STALE_MS=10*60_000;

const LIST_QUERY=`#graphql
query BrandOSWebhookSubscriptions {
  webhookSubscriptions(first:100) { nodes { id topic uri } }
}`;

const CREATE_MUTATION=`#graphql
mutation BrandOSWebhookSubscriptionCreate($topic:WebhookSubscriptionTopic!,$webhookSubscription:WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic:$topic,webhookSubscription:$webhookSubscription) {
    webhookSubscription { id topic uri }
    userErrors { field message }
  }
}`;

export function verifyShopifyWebhookHmac(rawBody,header,secret){
  const supplied=String(header||'').trim();
  if(!supplied||!secret)return false;
  let provided;try{provided=Buffer.from(supplied,'base64')}catch{return false}
  const expected=crypto.createHmac('sha256',String(secret)).update(Buffer.isBuffer(rawBody)?rawBody:Buffer.from(rawBody||'')).digest();
  return provided.length===expected.length&&crypto.timingSafeEqual(provided,expected);
}

export function classifyShopifyWebhookDuplicate(existing,{payloadHash='',nowMs=Date.now(),staleAfterMs=SHOPIFY_WEBHOOK_CLAIM_STALE_MS}={}){
  if(!existing)return {action:'error',reason:'missing_existing_claim'};
  const existingHash=String(existing.payload_sha256||'');
  if(existingHash&&payloadHash&&existingHash!==String(payloadHash))return {action:'reject',reason:'payload_mismatch'};
  if(existing.status==='completed')return {action:'duplicate',reason:'completed'};
  if(existing.status==='failed')return {action:'reclaim',reason:'failed'};
  if(existing.status==='processing'){
    const claimedAt=Date.parse(existing.claimed_at||'');
    const stale=Number.isFinite(claimedAt)&&claimedAt<=Number(nowMs)-Math.max(0,Number(staleAfterMs)||0);
    return stale?{action:'reclaim',reason:'stale_processing'}:{action:'duplicate',reason:'processing'};
  }
  return {action:'error',reason:'unknown_status'};
}

export async function claimShopifyWebhookEvent({admin,eventId,eventType,payloadHash,now=new Date(),staleAfterMs=SHOPIFY_WEBHOOK_CLAIM_STALE_MS}={}){
  if(!admin||!eventId)throw new Error('Webhook claim requires storage and an event id.');
  const at=now instanceof Date?now:new Date(now);
  if(Number.isNaN(at.getTime()))throw new Error('Webhook claim time is invalid.');
  const claimedAt=at.toISOString();
  const row={provider:'shopify',event_id:String(eventId),event_type:String(eventType||''),payload_sha256:String(payloadHash||''),status:'processing',attempts:1,claimed_at:claimedAt};
  const {error:insertError}=await admin.from('integration_webhook_events').insert(row);
  if(!insertError)return {claimed:true,reclaimed:false,attempts:1};
  if(String(insertError.code)!=='23505')return {claimed:false,error:insertError};

  const {data:existing,error:readError}=await admin.from('integration_webhook_events')
    .select('status,attempts,claimed_at,payload_sha256')
    .eq('provider','shopify').eq('event_id',String(eventId)).maybeSingle();
  if(readError)return {claimed:false,error:readError};
  const decision=classifyShopifyWebhookDuplicate(existing,{payloadHash,nowMs:at.getTime(),staleAfterMs});
  if(decision.action==='reject')return {claimed:false,rejected:true,reason:decision.reason};
  if(decision.action==='duplicate')return {claimed:false,duplicate:true,status:existing?.status||null,reason:decision.reason};
  if(decision.action!=='reclaim')return {claimed:false,error:Object.assign(new Error('Existing webhook claim could not be classified.'),{code:'WEBHOOK_CLAIM_STATE_INVALID'})};

  const attempts=Math.max(1,Number(existing.attempts)||1)+1;
  const patch={status:'processing',attempts,claimed_at:claimedAt,processed_at:null,failure_reason:null,event_type:String(eventType||''),payload_sha256:String(payloadHash||'')};
  const {data:reclaimed,error:reclaimError}=await admin.from('integration_webhook_events').update(patch)
    .eq('provider','shopify').eq('event_id',String(eventId)).eq('status',existing.status).eq('attempts',existing.attempts).eq('claimed_at',existing.claimed_at)
    .select('attempts').maybeSingle();
  if(reclaimError)return {claimed:false,error:reclaimError};
  if(!reclaimed)return {claimed:false,duplicate:true,status:'processing',reason:'claim_lost'};
  return {claimed:true,reclaimed:true,attempts:reclaimed.attempts||attempts,reason:decision.reason};
}

export async function ensureShopifyWebhooks({graphql,appUrl,topics=SHOPIFY_WEBHOOK_TOPICS}={}){
  if(typeof graphql!=='function')throw new Error('Shopify GraphQL client is required.');
  const uri=`${new URL(appUrl).origin}/api/integrations/shopify/webhook`;
  const existingData=await graphql(LIST_QUERY,{});
  const existing=existingData?.webhookSubscriptions?.nodes||[];
  const existingKeys=new Set(existing.map(item=>`${item.topic}|${item.uri}`));
  const created=[],errors=[];
  for(const topic of topics){
    if(existingKeys.has(`${topic}|${uri}`))continue;
    const data=await graphql(CREATE_MUTATION,{topic,webhookSubscription:{uri}});
    const result=data?.webhookSubscriptionCreate;
    if(result?.userErrors?.length){errors.push({topic,errors:result.userErrors});continue}
    if(result?.webhookSubscription)created.push(result.webhookSubscription);
  }
  return {uri,created,errors,existing:existing.filter(item=>item.uri===uri)};
}

export const SHOPIFY_WEBHOOK_LIST_QUERY=LIST_QUERY;
export const SHOPIFY_WEBHOOK_CREATE_MUTATION=CREATE_MUTATION;
