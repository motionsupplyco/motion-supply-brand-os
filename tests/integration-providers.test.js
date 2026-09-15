import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {SHOPIFY_API_VERSION,providerConfiguration,normalizeShopifyDomain,signIntegrationState,verifyIntegrationState,buildShopifyAuthorization,canonicalShopifyOAuthQuery,verifyShopifyOAuthHmac,exchangeShopifyAuthorizationCode,refreshShopifyOfflineToken,shopifyGraphql} from '../lib/integration-providers.js';

const env={
  INTEGRATION_TOKEN_ENCRYPTION_KEY:crypto.randomBytes(32).toString('base64url'),
  INTEGRATION_OAUTH_STATE_SECRET:'state-secret-that-is-longer-than-thirty-two-characters',
  SHOPIFY_CLIENT_ID:'client-id',SHOPIFY_CLIENT_SECRET:'client-secret',
  SHOPIFY_SCOPES:'read_orders,read_products,read_inventory'
};

test('provider configuration is fail-closed until required server secrets exist',()=>{
  assert.equal(providerConfiguration({}).shopify.configured,false);
  assert.equal(providerConfiguration(env).shopify.configured,true);
  assert.equal(providerConfiguration(env).shopify.apiVersion,SHOPIFY_API_VERSION);
});

test('Shopify store normalization only permits permanent myshopify domains',()=>{
  assert.equal(normalizeShopifyDomain('Foundry-Eight'),'foundry-eight.myshopify.com');
  assert.equal(normalizeShopifyDomain('https://foundry-eight.myshopify.com/admin'),'foundry-eight.myshopify.com');
  assert.throws(()=>normalizeShopifyDomain('foundry-eight.example.com'),/myshopify/i);
  assert.throws(()=>normalizeShopifyDomain('foundry-eight.myshopify.com.attacker.example'),/myshopify/i);
});

test('signed OAuth state binds provider owner brand shop and expiration',()=>{
  const now=Date.now();
  const token=signIntegrationState({provider:'shopify',ownerId:'u1',brandId:'b1',shop:'foundry-eight.myshopify.com',iat:now,exp:now+60_000},env.INTEGRATION_OAUTH_STATE_SECRET);
  const state=verifyIntegrationState(token,env.INTEGRATION_OAUTH_STATE_SECRET,{now});
  assert.equal(state.ownerId,'u1');
  assert.equal(state.brandId,'b1');
  assert.throws(()=>verifyIntegrationState(token,'different-secret-that-is-also-over-thirty-two-characters',{now}),/invalid oauth state/i);
  assert.throws(()=>verifyIntegrationState(token,env.INTEGRATION_OAUTH_STATE_SECRET,{now:now+120_000}),/expired/i);
});

test('Shopify authorization uses standalone OAuth, minimal scopes and exact Brand OS callback',()=>{
  const now=Date.now();
  const result=buildShopifyAuthorization({shop:'foundry-eight',ownerId:'u1',brandId:'b1',appUrl:'https://www.motionsupplyos.com',env,now,nonce:'fixed-nonce'});
  const url=new URL(result.url);
  assert.equal(url.hostname,'foundry-eight.myshopify.com');
  assert.equal(url.pathname,'/admin/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'),'client-id');
  assert.equal(url.searchParams.get('scope'),'read_orders,read_products,read_inventory');
  assert.equal(url.searchParams.get('redirect_uri'),'https://www.motionsupplyos.com/api/integrations/shopify/callback');
  const state=verifyIntegrationState(url.searchParams.get('state'),env.INTEGRATION_OAUTH_STATE_SECRET,{now});
  assert.equal(state.shop,'foundry-eight.myshopify.com');
});

test('Shopify callback HMAC uses sorted query parameters and constant-time verifier path',()=>{
  const base='shop=foundry-eight.myshopify.com&timestamp=1789450000&code=abc&state=xyz';
  const message=canonicalShopifyOAuthQuery(base);
  assert.equal(message,'code=abc&shop=foundry-eight.myshopify.com&state=xyz&timestamp=1789450000');
  const hmac=crypto.createHmac('sha256',env.SHOPIFY_CLIENT_SECRET).update(message).digest('hex');
  assert.equal(verifyShopifyOAuthHmac(`${base}&hmac=${hmac}`,env.SHOPIFY_CLIENT_SECRET),true);
  assert.equal(verifyShopifyOAuthHmac(`${base}&hmac=${'0'.repeat(64)}`,env.SHOPIFY_CLIENT_SECRET),false);
});

test('authorization-code exchange explicitly requests expiring offline tokens and verifies scopes',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options};return {ok:true,status:200,json:async()=>({access_token:'shpat_test',refresh_token:'shprt_test',expires_in:3600,refresh_token_expires_in:7776000,scope:'read_orders,read_products,read_inventory'})}};
  const tokens=await exchangeShopifyAuthorizationCode({shop:'foundry-eight.myshopify.com',code:'one-time-code',env,fetchImpl,now:0});
  assert.equal(request.url,'https://foundry-eight.myshopify.com/admin/oauth/access_token');
  const body=new URLSearchParams(request.options.body);
  assert.equal(body.get('expiring'),'1');
  assert.equal(body.get('code'),'one-time-code');
  assert.equal(tokens.accessToken,'shpat_test');
  assert.equal(tokens.refreshToken,'shprt_test');
  assert.equal(tokens.accessTokenExpiresAt,'1970-01-01T01:00:00.000Z');
});

test('authorization-code exchange rejects merchant-reduced required scopes',async()=>{
  const fetchImpl=async()=>({ok:true,status:200,json:async()=>({access_token:'shpat_test',refresh_token:'shprt_test',expires_in:3600,refresh_token_expires_in:7776000,scope:'read_orders'})});
  await assert.rejects(exchangeShopifyAuthorizationCode({shop:'foundry-eight.myshopify.com',code:'code',env,fetchImpl}),/missing required scopes/i);
});

test('Shopify offline refresh uses refresh_token grant and rotates the pair',async()=>{
  let body;
  const fetchImpl=async(_url,options)=>{body=new URLSearchParams(options.body);return {ok:true,status:200,json:async()=>({access_token:'new-access',refresh_token:'new-refresh',expires_in:3600,refresh_token_expires_in:7776000,scope:'read_orders,read_products,read_inventory'})}};
  const tokens=await refreshShopifyOfflineToken({shop:'foundry-eight.myshopify.com',refreshToken:'old-refresh',env,fetchImpl,now:0});
  assert.equal(body.get('grant_type'),'refresh_token');
  assert.equal(body.get('refresh_token'),'old-refresh');
  assert.equal(tokens.accessToken,'new-access');
  assert.equal(tokens.refreshToken,'new-refresh');
});

test('Shopify GraphQL helper uses the current API version and access-token header',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options};return {ok:true,status:200,json:async()=>({data:{shop:{name:'Foundry Eight'}}})}};
  const data=await shopifyGraphql({shop:'foundry-eight.myshopify.com',accessToken:'secret-access',query:'query { shop { name } }',env,fetchImpl});
  assert.equal(request.url,`https://foundry-eight.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`);
  assert.equal(request.options.headers['X-Shopify-Access-Token'],'secret-access');
  assert.equal(data.shop.name,'Foundry Eight');
});
