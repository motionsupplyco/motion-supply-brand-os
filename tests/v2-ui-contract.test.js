import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/v2-operating-ui.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/v2-operating-ui.css',import.meta.url),'utf8');

const occurrences=(text,needle)=>text.split(needle).length-1;

test('V2 operating workspace assets load exactly once',()=>{
  assert.equal(occurrences(index,'v2-operating-ui.css'),1);
  assert.equal(occurrences(index,'v2-operating-ui.js'),1);
});

test('V2 adds four isolated operating-intelligence routes without reusing legacy data-view',()=>{
  for(const view of ['cashforecast','reorderintel','operatingalerts','integrations']){
    assert.equal(occurrences(index,`data-v2-view="${view}"`),1,`${view} must exist once`);
    assert.equal(occurrences(index,`data-view="${view}"`),0,`${view} must not be owned by legacy app.js`);
  }
  assert.match(ui,/legacy app\.js never tries to render an unknown route/i);
});

test('critical production navigation, auth, modal and account hooks remain intact',()=>{
  for(const id of ['side','menuCloseBtn','nav','memoryNav','learnBtn','demoBtn','freshBtn','menuBackdrop','menuBtn','title','planPill','authBtn','billingBtn','app','modal','closeModal','modalBody']){
    assert.match(index,new RegExp(`id=["']${id}["']`),`missing #${id}`);
  }
  for(const script of ['account-ui.js','business-memory-ui.js','app.js','advisor-resources.js','mobile-nav-a11y.js','modal-a11y.js','help.js','launch-polish.js']){
    assert.equal(occurrences(index,script),1,`${script} must remain loaded once`);
  }
});

test('V2 UI never contains integration access-token fields or client secrets',()=>{
  assert.doesNotMatch(ui,/access_token_ciphertext|refresh_token_ciphertext|SHOPIFY_CLIENT_SECRET|META_APP_SECRET|TIKTOK_APP_SECRET|KLAVIYO_CLIENT_SECRET/);
  assert.match(ui,/tokens stay encrypted server-side/i);
});

test('V2 cash forecast keeps all 13-week operating categories visible',()=>{
  for(const label of ['DTC payouts','Wholesale','Factory deposit','Factory balance','Freight / duty','Marketing','Payroll / contractors','Software / rent','Taxes / debt','Other outflows'])assert.match(ui,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});

test('Reorder Intelligence never turns a missing saved forecast into zero cash headroom',()=>{
  assert.match(ui,/const hasCashForecast=demo\|\|Boolean\(v2State\.forecastId\)/);
  assert.match(ui,/headroom=forecast\?\.minimumHeadroom\?\?null/);
  assert.doesNotMatch(ui,/headroom=forecast\?\.minimumHeadroom\?\?0/);
  assert.match(ui,/CASH GATE NEEDS FORECAST/);
  assert.match(ui,/Save a 13-week cash forecast before treating this reorder as cash-safe or cash-blocked/i);
});

test('Operating Alerts do not treat an unsaved blank forecast as cash evidence',()=>{
  const start=ui.indexOf('function alertsFromCurrent()');
  const end=ui.indexOf('function renderAlerts()',start);
  assert.ok(start>=0&&end>start,'alertsFromCurrent must exist');
  const block=ui.slice(start,end);
  assert.match(block,/hasCashForecast=demo\|\|Boolean\(v2State\.forecastId\)/);
  assert.match(block,/hasCashForecast&&v2State\.forecast\?analysisOfForecast/);
});

test('V2 responsive CSS includes desktop, tablet and narrow-phone adaptations',()=>{
  assert.match(css,/@media\(max-width:1050px\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/prefers-reduced-motion/);
});
