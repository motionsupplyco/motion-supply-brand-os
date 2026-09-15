import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/v2-planning-ui.js',import.meta.url),'utf8');

const count=(source,needle)=>source.split(needle).length-1;

test('persistent SKU planning assets load exactly once',()=>{
  assert.equal(count(index,'v2-planning-ui.js'),1);
  assert.equal(count(index,'v2-planning-ui.css'),1);
  assert.ok(index.indexOf('v2-operating-ui.js')<index.indexOf('v2-planning-ui.js'));
});

test('planning UI reads and writes the owner-scoped planning API',()=>{
  assert.match(ui,/\/api\/v2\/sku-planning\?brand_id=/);
  assert.match(ui,/api\('\/api\/v2\/sku-planning',\{method:'POST'/);
  assert.match(ui,/brand_id:state\.brandId/);
  assert.match(ui,/item_key:next\.itemKey/);
});

test('Shopify observations never become founder-entered velocity',()=>{
  assert.match(ui,/source:'shopify'/);
  assert.match(ui,/weeklyDemand:num\(row\.weekly_velocity\)/);
  assert.match(ui,/manual_weekly_demand:next\.source==='manual'\?num\(next\.weeklyDemand\):null/);
  assert.match(ui,/Supplier terms below stay founder-controlled and are never written back to Shopify/);
});

test('manual saved SKUs keep a persistent founder velocity path',()=>{
  assert.match(ui,/itemKey=`manual:\$\{row\.id\}`/);
  assert.match(ui,/Weekly demand · manual/);
  assert.match(ui,/sku_id:next\.skuId\|\|null/);
  assert.match(ui,/manual_weekly_demand/);
});

test('planning layer fails honestly when V2 storage is not migrated',()=>{
  assert.match(ui,/V2_STORAGE_NOT_READY/);
  assert.match(ui,/Cloud save pending migration/);
  assert.match(ui,/cloud saving stays disabled until the additive V2 planning migration is applied/);
});
