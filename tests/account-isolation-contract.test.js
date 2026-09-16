import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const v2=await readFile(new URL('../lib/v2-routes.js',import.meta.url),'utf8');
const planning=await readFile(new URL('../lib/v2-planning-routes.js',import.meta.url),'utf8');
const dataApi=await readFile(new URL('../sql/p0_server_only_data_api.sql',import.meta.url),'utf8');
const runbook=await readFile(new URL('../docs/TWO_USER_ISOLATION_QA.md',import.meta.url),'utf8');

function block(source,startNeedle,endNeedle){
  const start=source.indexOf(startNeedle);
  assert.ok(start>=0,`missing route: ${startNeedle}`);
  const end=endNeedle?source.indexOf(endNeedle,start+startNeedle.length):source.length;
  assert.ok(!endNeedle||end>start,`missing route boundary after: ${startNeedle}`);
  return source.slice(start,end);
}

function mustOwnerScope(source,route,nextRoute,ownerExpr){
  const routeBlock=block(source,route,nextRoute);
  assert.match(routeBlock,new RegExp(ownerExpr),`${route} must scope database access to authenticated owner`);
  return routeBlock;
}

test('brand CRUD never trusts a caller supplied owner id',()=>{
  const list=mustOwnerScope(server,"app.get('/api/brands'","app.post('/api/brands'","eq\\('owner_id',user\\.id\\)");
  const create=block(server,"app.post('/api/brands'","app.patch('/api/brands/:id'");
  const update=mustOwnerScope(server,"app.patch('/api/brands/:id'","app.delete('/api/brands/:id'","eq\\('owner_id',user\\.id\\)");
  const remove=mustOwnerScope(server,"app.delete('/api/brands/:id'","app.get('/api/skus'","eq\\('owner_id',user\\.id\\)");
  assert.match(create,/insert\(\{owner_id:user\.id,/);
  for(const routeBlock of [list,create,update,remove])assert.doesNotMatch(routeBlock,/owner_id\s*:\s*req\.body/);
});

test('SKU CRUD binds brand and row access to the authenticated owner',()=>{
  const list=mustOwnerScope(server,"app.get('/api/skus'","app.post('/api/skus'","eq\\('owner_id',user\\.id\\)");
  const create=block(server,"app.post('/api/skus'","app.patch('/api/skus/:id'");
  const update=mustOwnerScope(server,"app.patch('/api/skus/:id'","app.delete('/api/skus/:id'","eq\\('owner_id',user\\.id\\)");
  const remove=mustOwnerScope(server,"app.delete('/api/skus/:id'","app.post('/api/import-summaries'","eq\\('owner_id',user\\.id\\)");
  assert.match(create,/from\('brands'\).*?eq\('id',brandId\).*?eq\('owner_id',user\.id\)/s);
  assert.match(create,/owner_id:user\.id,brand_id:brandId/);
  for(const routeBlock of [list,create,update,remove])assert.doesNotMatch(routeBlock,/owner_id\s*:\s*req\.body/);
});

test('Pro history and memory writes force server-authenticated ownership',()=>{
  const importRoute=block(server,"app.post('/api/import-summaries'","app.get('/api/entitlement'");
  const snapshotsGet=mustOwnerScope(server,"app.get('/api/snapshots'","app.post('/api/snapshots'","eq\\('owner_id',gate\\.user\\.id\\)");
  const snapshotsPost=block(server,"app.post('/api/snapshots'","app.get('/api/recommendations'");
  const recGet=mustOwnerScope(server,"app.get('/api/recommendations'","app.post('/api/recommendations'","eq\\('owner_id',gate\\.user\\.id\\)");
  const recPost=block(server,"app.post('/api/recommendations'","app.get('/api/business-memory'");
  const memoryGet=mustOwnerScope(server,"app.get('/api/business-memory'","app.put('/api/business-memory/:key'","eq\\('owner_id',gate\\.user\\.id\\)");
  const memoryPut=block(server,"app.put('/api/business-memory/:key'","app.delete('/api/business-memory/:id'");
  const memoryDelete=mustOwnerScope(server,"app.delete('/api/business-memory/:id'","app.post('/api/create-checkout-session'","eq\\('owner_id',gate\\.user\\.id\\)");

  for(const routeBlock of [importRoute,snapshotsPost,recPost,memoryPut]){
    assert.match(routeBlock,/owner_id:gate\.user\.id/);
    assert.doesNotMatch(routeBlock,/owner_id\s*:\s*req\.body/);
  }
  assert.match(memoryPut,/from\('brands'\).*?eq\('id',brandId\).*?eq\('owner_id',gate\.user\.id\)/s);
  for(const routeBlock of [snapshotsGet,recGet,memoryGet,memoryDelete])assert.doesNotMatch(routeBlock,/owner_id\s*:\s*req\.body/);
});

test('billing and account reads derive identity only from the bearer session',()=>{
  assert.match(server,/async function userFromRequest\(req\)[\s\S]*?admin\.auth\.getUser\(token\)/);
  assert.match(server,/async function subscriptionForUser\(id\)[\s\S]*?eq\('user_id',id\)/);
  const account=block(server,"app.get('/api/account'","app.delete('/api/account'");
  const portal=block(server,"app.post('/api/create-portal-session'","app.use('/api'");
  assert.match(account,/userFromRequest\(req\)/);
  assert.match(account,/accessForUser\(user\.id\)/);
  assert.match(portal,/userFromRequest\(req\)/);
  assert.match(portal,/subscriptionForUser\(user\.id\)/);
  assert.doesNotMatch(account,/req\.(?:body|query|params).*user_id/);
  assert.doesNotMatch(portal,/req\.(?:body|query|params).*user_id/);
});

test('V2 integration helpers and account-facing queries are owner scoped',()=>{
  assert.match(v2,/from\('brands'\).*?eq\('id',brandId\)\.eq\('owner_id',ownerId\)/s);
  assert.match(v2,/from\('integration_connections'\).*?eq\('owner_id',ownerId\)\.eq\('brand_id',brandId\)/s);
  const integrationList=mustOwnerScope(v2,"app.get('/api/v2/integrations'","app.post('/api/v2/integrations/shopify/connect'","eq\\('owner_id',gate\\.user\\.id\\)");
  const cashList=mustOwnerScope(v2,"app.get('/api/v2/cash-forecasts'","app.post('/api/v2/cash-forecasts'","eq\\('owner_id',gate\\.user\\.id\\)");
  const cashUpdate=mustOwnerScope(v2,"app.put('/api/v2/cash-forecasts/:id'","app.post('/api/v2/operating-analysis'","eq\\('owner_id',gate\\.user\\.id\\)");
  for(const routeBlock of [integrationList,cashList,cashUpdate])assert.doesNotMatch(routeBlock,/owner_id\s*:\s*req\.body/);
});

test('V2 planning enforces owner plus brand plus SKU ownership and server-forced writes',()=>{
  assert.match(planning,/from\('brands'\).*?eq\('id',brandId\)\.eq\('owner_id',ownerId\)/s);
  assert.match(planning,/from\('skus'\).*?eq\('id',skuId\)\.eq\('brand_id',brandId\)\.eq\('owner_id',ownerId\)/s);
  assert.match(planning,/from\('sku_planning_settings'\).*?eq\('owner_id',gate\.user\.id\)\.eq\('brand_id',brandId\)/s);
  assert.match(planning,/owner_id:gate\.user\.id,brand_id:brandId/);
  assert.match(planning,/delete\(\)\.eq\('id',id\)\.eq\('owner_id',gate\.user\.id\)/);
  assert.doesNotMatch(planning,/owner_id\s*:\s*req\.body/);
});

test('browser roles stay revoked from direct application-table access',()=>{
  assert.match(dataApi,/alter default privileges in schema public revoke all on tables from anon, authenticated/);
  for(const table of ['profiles','brands','skus','import_summaries','business_snapshots','recommendation_history','business_memory','subscriptions']){
    assert.match(dataApi,new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
  }
});

test('two-user runbook requires real distinct user sessions and cross-ID attempts',()=>{
  assert.match(runbook,/two distinct QA user sessions/i);
  assert.match(runbook,/must not use the service role/i);
  assert.match(runbook,/User A/i);
  assert.match(runbook,/User B/i);
  assert.match(runbook,/cross-account/i);
  assert.match(runbook,/brand/i);
  assert.match(runbook,/SKU/i);
  assert.match(runbook,/Business Memory/i);
  assert.match(runbook,/404|403/);
  assert.match(runbook,/do not check/i);
});
