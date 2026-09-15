import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/production-alert-bridge-ui.js',import.meta.url),'utf8');
const count=(source,needle)=>source.split(needle).length-1;

test('production alert bridge loads exactly once after Production Tracker',()=>{
  assert.equal(count(index,'production-alert-bridge-ui.js'),1);
  assert.ok(index.indexOf('production-alert-bridge-ui.js')>index.indexOf('production-milestones-ui.js'));
});

test('bridge only reads timeline and actuals from the current production context',()=>{
  assert.match(ui,/storedTimeline\.contextKey!==key/);
  assert.match(ui,/storedActuals\?\.contextKey===key/);
  assert.match(ui,/factoryName/);
  assert.match(ui,/styleName/);
  assert.match(ui,/quoteReference/);
});

test('bridge uses the shared operating alert engine instead of inventing separate severity rules',()=>{
  assert.match(ui,/buildOperatingAlerts\(\{productionMilestones:milestones\}\)/);
  assert.match(ui,/alert\.type==='production_milestone'/);
  assert.match(ui,/buildProductionMilestones/);
});

test('production-only risk replaces the no-alert empty state and updates summary counts',()=>{
  assert.match(ui,/empty\.style\.display=alerts\.length\?'none':''/);
  assert.match(ui,/base\.open\+alerts\.length/);
  assert.match(ui,/base\.critical\+alerts\.filter/);
  assert.match(ui,/base\.warning\+alerts\.filter/);
});

test('production alert card returns founder to Production Preflight and never claims a cause',()=>{
  assert.match(ui,/data-production-view=\"preflight\"/);
  assert.doesNotMatch(ui,/factory caused|supplier caused|factory fault|supplier fault/i);
});
