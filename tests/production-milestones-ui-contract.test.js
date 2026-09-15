import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/production-milestones-ui.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/production-milestones-ui.css',import.meta.url),'utf8');
const count=(source,needle)=>source.split(needle).length-1;

test('Production Tracker assets load exactly once after manufacturing workflow assets',()=>{
  assert.equal(count(index,'production-milestones-ui.js'),1);
  assert.equal(count(index,'production-milestones-ui.css'),1);
  assert.ok(index.indexOf('production-milestones-ui.js')>index.indexOf('manufacturing-cash-handoff-ui.js'));
});

test('Production Tracker compares modeled dates with founder-recorded actual facts without assigning blame',()=>{
  assert.match(ui,/planned dates come from Production Timeline/i);
  assert.match(ui,/does not assign blame/i);
  assert.match(ui,/buildProductionMilestones/);
  assert.doesNotMatch(ui,/factory caused|supplier caused|factory fault|supplier fault/i);
});

test('recorded actuals are isolated by factory and style context',()=>{
  assert.match(ui,/contextKey/);
  assert.match(ui,/factoryName/);
  assert.match(ui,/styleName/);
  assert.match(ui,/quoteReference/);
  assert.match(ui,/stored\.contextKey!==contextKey\(\)/);
});

test('actual completion inputs cannot select future dates',()=>{
  assert.match(ui,/max=\"\$\{today\}\"/);
  assert.match(ui,/CHECK ACTUAL DATE/);
});

test('Production Tracker exposes mobile layout',()=>{
  assert.match(css,/@media\(max-width:560px\)/);
});
