import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const model=await readFile(new URL('../public/problem-navigator.js',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/problem-navigator-ui.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/problem-navigator.css',import.meta.url),'utf8');

function occurrences(value,needle){return value.split(needle).length-1}

test('problem-first navigator loads once from Command Center and reuses the shared accessible modal',()=>{
  assert.equal(occurrences(index,'id="problemNav"'),1);
  assert.match(index,/id="problemNav"[^>]*>.*Solve a Problem/s);
  assert.equal(occurrences(index,'problem-navigator.css'),1);
  assert.equal(occurrences(index,'problem-navigator-ui.js'),1);
  assert.match(ui,/body\.innerHTML=problemNavigator\(\)/);
  assert.match(ui,/root\.classList\.remove\('hidden'\)/);
  assert.match(ui,/problemNavigatorModal/);
  assert.doesNotMatch(ui,/document\.createElement\(['"]dialog['"]\)/);
});

test('navigator covers the founder problems without inventing a diagnosis or business numbers',()=>{
  for(const id of ['margin','pricing','inventory','acquisition','cash','drop','shopify','unknown']){
    assert.match(model,new RegExp(`id:'${id}'`));
  }
  for(const label of ["WHAT'S HAPPENING",'WHY IT MATTERS','WHAT TO DO','No fake diagnosis.','Missing business data stays unknown']){
    assert.ok(model.includes(label),`missing ${label}`);
  }
  assert.doesNotMatch(model,/type="number"/);
  assert.doesNotMatch(model,/localStorage\.(?:setItem|removeItem)/);
  assert.doesNotMatch(model,/fetch\(/);
});

test('contextual actions reuse existing Brand OS destinations instead of duplicating calculators',()=>{
  const selectors=[
    '[data-profit-view="profitguardrails"]',
    '#nav button[data-view="profit"]',
    '#nav button[data-view="cac"]',
    '[data-v2-view="reorderintel"]',
    '[data-v2-view="cashforecast"]',
    '[data-collection-view="collectionstress"]',
    '[data-production-view="preflight"]',
    '#nav button[data-view="shopify"]',
    '[data-v2-view="integrations"]',
    '#nav button[data-view="advisor"]'
  ];
  for(const selector of selectors)assert.ok(model.includes(selector),`missing route ${selector}`);
  assert.match(ui,/problemNavigatorTarget\(action\)/);
  assert.match(ui,/target\.click\(\)/);
});

test('navigator preserves mobile and keyboard accessibility contracts',()=>{
  assert.match(css,/\.modalbox\.problemNavigatorModal/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/:focus-visible/);
  assert.match(model,/<details class="problemExplain"><summary>/);
  assert.match(ui,/msboCloseMenu/);
  assert.match(ui,/aria-label','Solve a business problem'/);
});
