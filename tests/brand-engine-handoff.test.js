import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const handoff=await readFile(new URL('../public/brand-engine-handoff.js',import.meta.url),'utf8');
const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const engine=await readFile(new URL('../public/brand-engine-ui.js',import.meta.url),'utf8');

test('Brand OS loads the isolated Brand Engine handoff surface',()=>{
  assert.match(index,/brand-engine-handoff\.css/);
  assert.match(index,/brand-engine-handoff\.js/);
});

test('generated-name handoff persists a bounded pending name across auth redirects',()=>{
  assert.match(engine,/msbo_pending_brand_name/);
  assert.match(engine,/brandEngineName=/);
  assert.match(handoff,/const PENDING_KEY='msbo_pending_brand_name'/);
  assert.match(handoff,/slice\(0,120\)/);
});

test('pending names never auto-create on load or login; creation is tied to explicit initialize click',()=>{
  const postIndex=handoff.indexOf("authedRequest('/api/brands','POST',{name})");
  const initializeIndex=handoff.indexOf('async function initialize()');
  const clickIndex=handoff.indexOf("event.target.closest('#brandEngineInitialize')");
  assert.ok(initializeIndex>=0&&postIndex>initializeIndex,'brand POST must live inside initialize()');
  assert.ok(clickIndex>=0,'explicit initialize click handler is required');
  const beforeInitialize=handoff.slice(0,initializeIndex);
  assert.doesNotMatch(beforeInitialize,/\/api\/brands/,'page initialization must never create a brand');
  assert.match(handoff,/Creating the brand is still your decision/);
  assert.match(handoff,/will not create anything automatically/);
});

test('free-plan brand limit remains visible instead of being bypassed',()=>{
  assert.match(handoff,/PRO_LIMIT_REACHED/);
  assert.match(handoff,/free saved-brand slot is already used/i);
});

test('dismissal clears pending name and returning to Brand Engine is always available',()=>{
  assert.match(handoff,/brandEngineDismiss/);
  assert.match(handoff,/localStorage\.removeItem\(PENDING_KEY\)/);
  assert.match(handoff,/location\.href='\/brand-engine'/);
});
