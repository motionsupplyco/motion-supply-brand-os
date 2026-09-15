import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const routes=await readFile(new URL('../lib/v2-routes.js',import.meta.url),'utf8');

const indexOfOrFail=(source,needle,start=0)=>{
  const index=source.indexOf(needle,start);
  assert.ok(index>=0,`missing expected source marker: ${needle}`);
  return index;
};

test('Shopify raw webhook mounts before JSON body parsing',()=>{
  const mount=indexOfOrFail(server,'registerV2PreJsonRoutes(app');
  const json=indexOfOrFail(server,"app.use(express.json({limit:'256kb'}))");
  assert.ok(mount<json,'raw webhook routes must mount before express.json');
  assert.match(routes,/express\.raw\(\{type:'application\/json',limit:'512kb'\}\)/);
  assert.match(routes,/verifyShopifyWebhookHmac\(raw,req\.headers\['x-shopify-hmac-sha256'\]/);
});

test('V2 JSON routes mount after JSON parsing but before the API 404 fallback',()=>{
  const json=indexOfOrFail(server,"app.use(express.json({limit:'256kb'}))");
  const mount=indexOfOrFail(server,'registerV2Routes(app');
  const fallback=indexOfOrFail(server,"app.use('/api',(req,res)=>res.status(404)");
  assert.ok(json<mount,'V2 JSON routes must mount after express.json');
  assert.ok(mount<fallback,'V2 routes must mount before the API 404 fallback');
});

test('existing Stripe webhook remains raw and ahead of JSON parsing',()=>{
  const stripe=indexOfOrFail(server,"app.post('/api/stripe-webhook',express.raw");
  const json=indexOfOrFail(server,"app.use(express.json({limit:'256kb'}))");
  assert.ok(stripe<json);
});

test('launch and V2 early-warning events are accepted by product analytics',()=>{
  for(const event of [
    'discount_ceiling_error','cash_forecast_opened','cash_forecast_saved','reorder_review_opened',
    'integration_connect_started','integration_connected','integration_sync_started','integration_sync_completed','integration_sync_failed'
  ])assert.match(server,new RegExp(`['\"]${event}['\"]`),`missing allowed event ${event}`);
});

test('browser-facing integration list projection never selects credentials or generic metadata',()=>{
  const start=indexOfOrFail(routes,"app.get('/api/v2/integrations'");
  const end=indexOfOrFail(routes,"app.post('/api/v2/integrations/shopify/connect'",start);
  const block=routes.slice(start,end);
  assert.doesNotMatch(block,/access_token_ciphertext|refresh_token_ciphertext/);
  assert.doesNotMatch(block,/\bmetadata\b/);
  assert.match(block,/access_token_expires_at/);
  assert.match(block,/refresh_token_expires_at/);
});

test('public connection serializer exposes only allowlisted non-secret fields',()=>{
  const start=indexOfOrFail(routes,'function publicConnection(row)');
  const end=indexOfOrFail(routes,'async function loadShopifyConnection',start);
  const block=routes.slice(start,end);
  assert.doesNotMatch(block,/ciphertext|accessToken\s*:|refreshToken\s*:|\bmetadata\s*:/);
  assert.match(block,/accessTokenExpiresAt/);
  assert.match(block,/refreshTokenExpiresAt/);
  assert.match(block,/lastSyncedAt/);
});

test('Shopify webhook handler uses retry-aware claim helper instead of treating every unique conflict as completed',()=>{
  const start=indexOfOrFail(routes,"app.post('/api/integrations/shopify/webhook'");
  const end=indexOfOrFail(routes,'export function registerV2Routes',start);
  const block=routes.slice(start,end);
  assert.match(block,/claimShopifyWebhookEvent\(\{admin,eventId,eventType:topic,payloadHash\}\)/);
  assert.match(block,/claim\.rejected/);
  assert.match(block,/claim\.reclaimed/);
  assert.doesNotMatch(block,/claimError\.code\)===?'23505'|String\(claimError\.code\)==='23505'/);
});

test('Shopify uninstall clears stored token ciphertext instead of leaving dormant credentials',()=>{
  assert.match(routes,/topic==='APP_UNINSTALLED'/);
  assert.match(routes,/access_token_ciphertext:null/);
  assert.match(routes,/refresh_token_ciphertext:null/);
  assert.match(routes,/status:'disconnected'/);
});

test('operating analysis keeps missing cash forecast unknown instead of inventing zero headroom',()=>{
  const start=indexOfOrFail(routes,"app.post('/api/v2/operating-analysis'");
  const end=indexOfOrFail(routes,"app.get('/api/v2/operating-alerts'",start);
  const block=routes.slice(start,end);
  assert.match(block,/forecastHeadroom:forecast\?\.minimumHeadroom\?\?null/);
  assert.doesNotMatch(block,/forecastHeadroom:forecast\?\.minimumHeadroom\?\?0/);
});

test('V2 integration and operating routes remain Pro-gated where account data is exposed or mutated',()=>{
  const protectedRoutes=[
    "app.get('/api/v2/integrations'",
    "app.post('/api/v2/integrations/shopify/connect'",
    "app.post('/api/v2/integrations/shopify/sync'",
    "app.delete('/api/v2/integrations/:provider/:brandId'",
    "app.get('/api/v2/operating-data'",
    "app.get('/api/v2/cash-forecasts'",
    "app.post('/api/v2/cash-forecasts'",
    "app.put('/api/v2/cash-forecasts/:id'",
    "app.post('/api/v2/operating-analysis'",
    "app.get('/api/v2/operating-alerts'"
  ];
  for(let i=0;i<protectedRoutes.length;i++){
    const start=indexOfOrFail(routes,protectedRoutes[i]);
    const end=i+1<protectedRoutes.length?indexOfOrFail(routes,protectedRoutes[i+1],start+1):routes.length;
    const block=routes.slice(start,end);
    assert.match(block,/requireProUser\(req,res\)/,`${protectedRoutes[i]} must remain Pro-gated`);
  }
});
