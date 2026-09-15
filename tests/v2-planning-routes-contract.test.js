import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const routes=await readFile(new URL('../lib/v2-planning-routes.js',import.meta.url),'utf8');
const migration=await readFile(new URL('../sql/v2_planning_velocity_extension.sql',import.meta.url),'utf8');

const marker=(source,text)=>{const index=source.indexOf(text);assert.ok(index>=0,`missing ${text}`);return index};

test('V2 SKU planning routes are mounted after JSON parsing and before API fallback',()=>{
  const json=marker(server,"app.use(express.json({limit:'256kb'}))");
  const mount=marker(server,'registerV2PlanningRoutes(app,{admin,requireProUser})');
  const fallback=marker(server,"app.use('/api',(req,res)=>res.status(404)");
  assert.ok(json<mount);
  assert.ok(mount<fallback);
});

test('SKU planning API is Pro-gated and owner/brand scoped',()=>{
  for(const route of ["app.get('/api/v2/sku-planning'","app.post('/api/v2/sku-planning'","app.delete('/api/v2/sku-planning/:id'"]){
    const start=marker(routes,route);
    const block=routes.slice(start,start+2800);
    assert.match(block,/requireProUser\(req,res\)/);
    assert.match(block,/owner_id/);
  }
  assert.match(routes,/eq\('owner_id',gate\.user\.id\)/);
  assert.match(routes,/ownedBrand\(admin,gate\.user\.id,brandId\)/);
});

test('planning rows keep founder demand and supplier assumptions separate from synced inventory',()=>{
  for(const field of ['manual_weekly_demand','lead_weeks','high_weekly_demand','moq','deposit_pct','landed_cost','supplier_notes'])assert.match(routes,new RegExp(field));
  assert.match(migration,/add column if not exists manual_weekly_demand/i);
  assert.match(migration,/does not overwrite this field/i);
  assert.doesNotMatch(routes,/from\('inventory_snapshots'\)\.update/);
  assert.doesNotMatch(routes,/from\('skus'\)\.update/);
});
