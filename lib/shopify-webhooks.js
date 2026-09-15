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
