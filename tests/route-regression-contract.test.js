import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');

const requiredRoutes=[
  "app.get('/api/health'",
  "app.get('/api/public-config'",
  "app.post('/api/auth/signup'",
  "app.post('/api/auth/signin'",
  "app.post('/api/auth/refresh'",
  "app.post('/api/auth/recover'",
  "app.post('/api/auth/update-password'",
  "app.get('/api/account'",
  "app.delete('/api/account'",
  "app.get('/api/brands'",
  "app.post('/api/brands'",
  "app.get('/api/skus'",
  "app.post('/api/skus'",
  "app.post('/api/import-summaries'",
  "app.get('/api/entitlement'",
  "app.post('/api/events'",
  "app.get('/api/snapshots'",
  "app.post('/api/snapshots'",
  "app.get('/api/recommendations'",
  "app.post('/api/recommendations'",
  "app.get('/api/business-memory'",
  "app.put('/api/business-memory/:key'",
  "app.delete('/api/business-memory/:id'",
  "app.post('/api/create-checkout-session'",
  "app.post('/api/create-portal-session'",
  "app.post('/api/stripe-webhook'"
];

test('all production P0 API surfaces remain present',()=>{
  for(const route of requiredRoutes){
    assert.ok(server.includes(route),`missing required P0 route: ${route}`);
  }
});

test('SKU contract keeps the established product fields and ownership checks',()=>{
  const start=server.indexOf("app.post('/api/skus'");
  const end=server.indexOf("app.post('/api/import-summaries'",start);
  const route=start>=0&&end>start?server.slice(start,end):'';
  assert.ok(route,'SKU create route must exist');
  assert.match(route,/\.eq\('owner_id',user\.id\)/);
  assert.match(route,/req\.body\?\.sku/);
  assert.match(route,/req\.body\?\.retail_price/);
  assert.match(route,/req\.body\?\.landed_cost/);
  assert.match(route,/req\.body\?\.on_hand/);
  assert.match(route,/PRO_LIMIT_REACHED/);
});

test('Shopify import summary contract remains Pro-gated and aggregate-only',()=>{
  const start=server.indexOf("app.post('/api/import-summaries'");
  const end=server.indexOf("app.get('/api/entitlement'",start);
  const route=start>=0&&end>start?server.slice(start,end):'';
  assert.ok(route,'import summary route must exist');
  assert.match(route,/requireProUser\(req,res\)/);
  assert.match(route,/file_kind/);
  assert.match(route,/start_date/);
  assert.match(route,/end_date/);
  assert.match(route,/summary:safeObject/);
});

test('analytics contract keeps the server allowlist, event limiter, and established payload names',()=>{
  assert.match(server,/allowedEvents=new Set\(\['landing_page_viewed'/);
  const start=server.indexOf("app.post('/api/events'");
  const end=server.indexOf("app.get('/api/snapshots'",start);
  const route=start>=0&&end>start?server.slice(start,end):'';
  assert.ok(route,'analytics route must exist');
  assert.match(route,/limiter\('events',60_000,90\)/);
  assert.match(route,/event_name/);
  assert.match(route,/anonymous_id/);
  assert.match(route,/properties:props/);
});

test('guided operating history routes remain Pro-gated and owner-scoped',()=>{
  for(const marker of ["app.get('/api/snapshots'","app.post('/api/snapshots'","app.get('/api/recommendations'","app.post('/api/recommendations'"]){
    const start=server.indexOf(marker);
    assert.ok(start>=0,`missing guided operating route: ${marker}`);
    const next=server.indexOf('\napp.',start+5);
    const route=server.slice(start,next>start?next:undefined);
    assert.match(route,/requireProUser\(req,res\)/);
    assert.match(route,/owner_id/);
  }
});

test('billing routes keep duplicate-subscription prevention and customer portal behavior',()=>{
  const checkoutStart=server.indexOf("app.post('/api/create-checkout-session'");
  const portalStart=server.indexOf("app.post('/api/create-portal-session'",checkoutStart);
  const apiFallback=server.indexOf("app.use('/api'",portalStart);
  const checkout=checkoutStart>=0&&portalStart>checkoutStart?server.slice(checkoutStart,portalStart):'';
  const portal=portalStart>=0&&apiFallback>portalStart?server.slice(portalStart,apiFallback):'';
  assert.match(checkout,/ALREADY_PRO/);
  assert.match(checkout,/BILLING_RECOVERY_REQUIRED/);
  assert.match(checkout,/stripe\.checkout\.sessions\.create/);
  assert.match(checkout,/STRIPE_PRO_PRICE_ID/);
  assert.match(portal,/stripe\.billingPortal\.sessions\.create/);
  assert.match(portal,/stripe_customer_id/);
});

test('API fallback and generic error handling stay in front of the static SPA fallback',()=>{
  const api404=server.indexOf("app.use('/api'");
  const staticServe=server.indexOf('app.use(express.static',api404);
  const spaFallback=server.indexOf("app.use((req,res)=>res.sendFile",staticServe);
  assert.ok(api404>=0,'API 404 fallback must exist');
  assert.ok(staticServe>api404,'API fallback must execute before static hosting');
  assert.ok(spaFallback>staticServe,'SPA fallback must execute after static hosting');
  assert.match(server,/API_NOT_FOUND/);
  assert.match(server,/INTERNAL_ERROR/);
});
