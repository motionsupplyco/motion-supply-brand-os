import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/guided-dashboard.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/guided-dashboard.css',import.meta.url),'utf8');

function occurrences(value,needle){return value.split(needle).length-1}

test('Business Health loads the guided operating loop exactly once',()=>{
  assert.equal(occurrences(index,'guided-dashboard.css'),1);
  assert.equal(occurrences(index,'guided-dashboard.js'),1);
  assert.match(ui,/id="guidedOperatingLoop"/);
  assert.match(ui,/aria-labelledby="guidedLoopTitle"/);
  assert.match(ui,/app\.querySelector\('#guidedOperatingLoop'\)/);
  assert.match(ui,/\.dashboardIntro'\)\|\|app\.querySelector\('\.onboard'/);
});

test('operating loop expresses four decision stages without inventing business results',()=>{
  for(const id of ['economics','demand','cash','decision'])assert.match(ui,new RegExp(`id:'${id}'`));
  for(const label of ['MAKE MONEY','READ DEMAND','PROTECT CASH','DECIDE NEXT','INPUT','DECISION'])assert.ok(ui.includes(label),`missing ${label}`);
  assert.match(ui,/creates no score and no new business numbers/);
  assert.doesNotMatch(ui,/localStorage\.(?:setItem|removeItem)/);
  assert.doesNotMatch(ui,/fetch\(/);
  assert.doesNotMatch(ui,/from ['"].*math/);
  assert.doesNotMatch(ui,/type="number"/);
  assert.doesNotMatch(ui,/https?:\/\//);
});

test('operating loop routes only into existing Brand OS navigation surfaces',()=>{
  const selectors=[
    '#problemNav',
    '#nav button[data-view="profit"]',
    '[data-profit-view="profitguardrails"]',
    '#nav button[data-view="funnel"]',
    '#nav button[data-view="shopify"]',
    '[data-v2-view="reorderintel"]',
    '[data-v2-view="cashforecast"]',
    '[data-v2-view="operatingalerts"]',
    '#nav button[data-view="advisor"]'
  ];
  for(const selector of selectors)assert.ok(ui.includes(selector),`missing route ${selector}`);
  assert.match(ui,/target\.click\(\)/);
});

test('operating loop stays restrained and responsive',()=>{
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:1060px\)/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/:focus-visible/);
  assert.doesNotMatch(css,/url\(/);
  assert.doesNotMatch(ui,/<img\b/);
});
