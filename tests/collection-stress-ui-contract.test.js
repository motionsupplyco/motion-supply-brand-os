import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/collection-stress-ui.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/collection-stress-ui.css',import.meta.url),'utf8');

const occurrences=(text,needle)=>text.split(needle).length-1;

test('Collection Stress workspace assets and navigation load exactly once',()=>{
  assert.equal(occurrences(index,'collection-stress-ui.css'),1);
  assert.equal(occurrences(index,'collection-stress-ui.js'),1);
  assert.equal(occurrences(index,'data-collection-view="collectionstress"'),1);
  assert.equal(occurrences(index,'data-view="collectionstress"'),0,'legacy app.js must not own Collection Stress');
});

test('blank collection model keeps business assumptions unknown instead of inventing defaults',()=>{
  const blankStart=ui.indexOf('function emptyState()');
  const blankEnd=ui.indexOf('function demoState()',blankStart);
  const blank=ui.slice(blankStart,blankEnd);
  for(const field of ['retailPrice:null','landedCost:null','factoryUnitCost:null','markdownPct:null','unitsPerOrder:null','cacPerOrder:null','fixedLaunchCost:null','depositPct:null','balanceDueWeek:null'])assert.match(blank,new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(blank,/sellThroughPct:null/);
  assert.match(blank,/returnRatePct:null/);
});

test('example collection assumptions are explicit and separated from the blank model',()=>{
  const demoStart=ui.indexOf('function demoState()');
  const demoEnd=ui.indexOf('function loadModel()',demoStart);
  const demo=ui.slice(demoStart,demoEnd);
  for(const value of ['retailPrice:84','landedCost:24.70','factoryUnitCost:19','depositPct:50','sellThroughPct:78'])assert.match(demo,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(ui,/FOUNDRY EIGHT · DEMO/);
});

test('Collection Stress does not create a second hardcoded Pro price source',()=>{
  assert.doesNotMatch(ui,/\$19|19\/month|19\/mo/);
  assert.match(ui,/id="upgradeNow"/);
  assert.match(ui,/>Upgrade to Pro</);
});

test('founder stress inputs cover collection, order economics, scenarios, size risk and cash timing',()=>{
  for(const phrase of ['Collection / drop name','Retail price','Landed cost / unit','Factory unit cost','CAC / order','Fixed launch spend','Sell-through %','Full-price share %','Return rate %','Restockable returns %','Factory deposit %','Balance due week','Freight / duty week','Launch spend week'])assert.match(ui,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});

test('results distinguish founder cash recovery from accounting profit',()=>{
  assert.match(ui,/Collection cash recovery/i);
  assert.match(ui,/Cash recovery is not accounting profit/i);
  assert.match(ui,/not for tax reporting/i);
});

test('Collection Stress layout includes desktop, tablet and narrow-phone responsive rules',()=>{
  assert.match(css,/@media\(max-width:1080px\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/prefers-reduced-motion/);
});
