import crypto from 'node:crypto';

export const SHOPIFY_API_VERSION='2026-07';
export const DEFAULT_SHOPIFY_SCOPES=Object.freeze(['read_orders','read_products','read_inventory']);
export const PROVIDER_NAMES=Object.freeze(['shopify','meta','tiktok','klaviyo']);

const clean=s=>String(s||'').trim();
const splitScopes=s=>[...new Set(clean(s).split(',').map(x=>x.trim()).filter(Boolean))];

export function shopifyScopes(env=process.env){
  return splitScopes(env.SHOPIFY_SCOPES||DEFAULT_SHOPIFY_SCOPES.join(','));
}

export function providerConfiguration(env=process.env){
  const commonEncryption=Boolean(clean(env.INTEGRATION_TOKEN_ENCRYPTION_KEY));
  const oauthState=Boolean(clean(env.INTEGRATION_OAUTH_STATE_SECRET));
  return {
    shopify:{configured:commonEncryption&&oauthState&&Boolean(clean(env.SHOPIFY_CLIENT_ID))&&Boolean(clean(env.SHOPIFY_CLIENT_SECRET)),scopes:shopifyScopes(env),apiVersion:clean(env.SHOPIFY_API_VERSION)||SHOPIFY_API_VERSION},
    meta:{configured:commonEncryption&&oauthState&&Boolean(clean(env.META_APP_ID))&&Boolean(clean(env.META_APP_SECRET)),mode:'framework-ready'},
    tiktok:{configured:commonEncryption&&oauthState&&Boolean(clean(env.TIKTOK_APP_ID))&&Boolean(clean(env.TIKTOK_APP_SECRET)),mode:'framework-ready'},
    klaviyo:{configured:commonEncryption&&oauthState&&Boolean(clean(env.KLAVIYO_CLIENT_ID))&&Boolean(clean(env.KLAVIYO_CLIENT_SECRET)),mode:'framework-ready'}
  };
}

export function normalizeShopifyDomain(input){
  let raw=clean(input).toLowerCase();
  if(!raw)throw new Error('Shopify store is required.');
  if(/^https?:\/\//.test(raw)){
    let url;try{url=new URL(raw)}catch{throw new Error('Use a valid Shopify store domain.');}
    raw=url.hostname.toLowerCase();
  }
  raw=raw.split('/')[0].replace(/\.$/,'');
  if(!raw.includes('.'))raw=`${raw}.myshopify.com`;
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(raw))throw new Error('Use the permanent *.myshopify.com store domain.');
  return raw;
}

function stateSecret(secret){
  const value=clean(secret);
  if(value.length<32)throw new Error('Integration OAuth state secret must be at least 32 characters.');
  return value;
}

function safeEqualText(a,b){
  const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));
  return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}

export function signIntegrationState(payload,secret=process.env.INTEGRATION_OAUTH_STATE_SECRET){
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature=crypto.createHmac('sha256',stateSecret(secret)).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyIntegrationState(token,secret=process.env.INTEGRATION_OAUTH_STATE_SECRET,{now=Date.now()}={}){
  const [body,signature,...extra]=clean(token).split('.');
  if(!body||!signature||extra.length)throw new Error('Invalid OAuth state.');
  const expected=crypto.createHmac('sha256',stateSecret(secret)).update(body).digest('base64url');
  if(!safeEqualText(signature,expected))throw new Error('Invalid OAuth state.');
  let payload;try{payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'))}catch{throw new Error('Invalid OAuth state.');}
  if(!payload||typeof payload!=='object'||!payload.exp||Number(payload.exp)<now)throw new Error('OAuth state expired.');
  if(Number(payload.iat)>now+60_000)throw new Error('Invalid OAuth state timestamp.');
  return payload;
}

export function buildShopifyAuthorization({shop,ownerId,brandId,appUrl,env=process.env,now=Date.now(),nonce=crypto.randomBytes(16).toString('base64url')}){
  const config=providerConfiguration(env).shopify;
  if(!config.configured)throw new Error('Shopify integration is not configured.');
  const domain=normalizeShopifyDomain(shop);
  const origin=new URL(appUrl).origin;
  const redirectUri=`${origin}/api/integrations/shopify/callback`;
  const state=signIntegrationState({provider:'shopify',ownerId:String(ownerId),brandId:String(brandId),shop:domain,nonce,iat:now,exp:now+10*60_000},env.INTEGRATION_OAUTH_STATE_SECRET);
  const url=new URL(`https://${domain}/admin/oauth/authorize`);
  url.searchParams.set('client_id',env.SHOPIFY_CLIENT_ID);
  url.searchParams.set('scope',config.scopes.join(','));
  url.searchParams.set('redirect_uri',redirectUri);
  url.searchParams.set('state',state);
  return {url:url.toString(),state,shop:domain,redirectUri,scopes:config.scopes};
}

export function canonicalShopifyOAuthQuery(rawQueryString){
  const params=new URLSearchParams(String(rawQueryString||'').replace(/^\?/,''));
  params.delete('hmac');
  return [...params.entries()].sort(([ak,av],[bk,bv])=>ak===bk?av.localeCompare(bv):ak.localeCompare(bk)).map(([key,value])=>`${key}=${value}`).join('&');
}

export function verifyShopifyOAuthHmac(rawQueryString,secret){
  const params=new URLSearchParams(String(rawQueryString||'').replace(/^\?/,''));
  const supplied=clean(params.get('hmac'));
  if(!/^[0-9a-f]{64}$/i.test(supplied))return false;
  const message=canonicalShopifyOAuthQuery(rawQueryString);
  const expected=crypto.createHmac('sha256',clean(secret)).update(message).digest('hex');
  return safeEqualText(supplied,expected);
}

async function tokenRequest(shop,body,{fetchImpl=fetch}={}){
  const domain=normalizeShopifyDomain(shop);
  const response=await fetchImpl(`https://${domain}/admin/oauth/access_token`,{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},
    body:new URLSearchParams(body)
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(json?.error_description||json?.error||`Shopify token request failed (${response.status}).`);
    error.status=response.status;
    error.providerBody=json;
    throw error;
  }
  return json;
}

function tokenMetadata(json,now=Date.now()){
  const expiresIn=Math.max(0,Number(json?.expires_in)||0);
  const refreshExpiresIn=Math.max(0,Number(json?.refresh_token_expires_in)||0);
  return {
    accessToken:clean(json?.access_token),
    refreshToken:clean(json?.refresh_token)||null,
    scope:splitScopes(json?.scope),
    expiresIn,
    refreshExpiresIn,
    accessTokenExpiresAt:expiresIn?new Date(now+expiresIn*1000).toISOString():null,
    refreshTokenExpiresAt:refreshExpiresIn?new Date(now+refreshExpiresIn*1000).toISOString():null
  };
}

export async function exchangeShopifyAuthorizationCode({shop,code,env=process.env,fetchImpl=fetch,now=Date.now()}){
  const json=await tokenRequest(shop,{client_id:env.SHOPIFY_CLIENT_ID,client_secret:env.SHOPIFY_CLIENT_SECRET,code:clean(code),expiring:'1'},{fetchImpl});
  const tokens=tokenMetadata(json,now);
  if(!tokens.accessToken||!tokens.refreshToken)throw new Error('Shopify did not return the required expiring offline token pair.');
  const required=shopifyScopes(env),granted=new Set(tokens.scope);
  const missing=required.filter(scope=>!granted.has(scope));
  if(missing.length){const error=new Error(`Shopify authorization is missing required scopes: ${missing.join(', ')}`);error.code='SHOPIFY_SCOPES_MISSING';throw error;}
  return tokens;
}

export async function refreshShopifyOfflineToken({shop,refreshToken,env=process.env,fetchImpl=fetch,now=Date.now()}){
  const json=await tokenRequest(shop,{client_id:env.SHOPIFY_CLIENT_ID,client_secret:env.SHOPIFY_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:clean(refreshToken)},{fetchImpl});
  const tokens=tokenMetadata(json,now);
  if(!tokens.accessToken||!tokens.refreshToken)throw new Error('Shopify token refresh did not return a complete rotated token pair.');
  return tokens;
}

export async function shopifyGraphql({shop,accessToken,query,variables={},env=process.env,fetchImpl=fetch}){
  const domain=normalizeShopifyDomain(shop);
  const version=clean(env.SHOPIFY_API_VERSION)||SHOPIFY_API_VERSION;
  const response=await fetchImpl(`https://${domain}/admin/api/${version}/graphql.json`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json','X-Shopify-Access-Token':clean(accessToken)},
    body:JSON.stringify({query,variables})
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok||json?.errors?.length){
    const error=new Error(json?.errors?.[0]?.message||`Shopify GraphQL request failed (${response.status}).`);
    error.status=response.status;
    error.providerBody=json;
    throw error;
  }
  return json.data;
}
