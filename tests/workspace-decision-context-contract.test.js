import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/workspace-decision-context.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/workspace-decision-context.css',import.meta.url),'utf8');

function occurrences(value,needle){return value.split(needle).length-1}

test('core workspaces load one consistent decision context layer',()=>{
  assert.equal(occurrences(index,'workspace-decision-context.css'),1);
  assert.equal(occurrences(index,'workspace-decision-context.js'),1);
  assert.match(ui,/id="workspaceDecisionContext"/);
  assert.match(ui,/DECISION/);
  assert.match(ui,/EVIDENCE NEEDED/);
  assert.match(ui,/NEXT HANDOFF/);
  assert.match(ui,/app\.querySelector\('#workspaceDecisionContext'\)/);
  assert.match(ui,/app\.querySelector\('\.toolhead'\)/);
});

test('decision context covers the core calculator workspaces without calculating business results',()=>{
  const titles=[
    'Profit & Pricing','Customer Acquisition Cost','Store Funnel','Discount Ceiling',
    'Inventory & Reorder','Launch & Break-Even','Cash Checkpoint','PO Cash Gate',
    '3PL Decision','Wholesale Economics','Shopify CSV Dashboard','Next Move Advisor'
  ];
  for(const title of titles)assert.ok(ui.includes(`'${title}'`),`missing ${title}`);
  assert.doesNotMatch(ui,/localStorage\.(?:setItem|removeItem)/);
  assert.doesNotMatch(ui,/fetch\(/);
  assert.doesNotMatch(ui,/from ['"].*math/);
  assert.doesNotMatch(ui,/type="number"/);
  assert.doesNotMatch(ui,/https?:\/\//);
});

test('workspace help reuses the first-party guide and restores focus to a persistent visible control',()=>{
  assert.match(ui,/msboOpenHelp/);
  assert.match(ui,/workspaceHelpView/);
  assert.match(ui,/workspaceHelpTerm/);
  assert.match(ui,/returnFocusSelectors:\['#workspaceDecisionHelp','#learnBtn','#menuBtn'\]/);
  assert.match(ui,/data-workspace-help-view/);
  assert.match(ui,/data-workspace-help-term/);
});

test('decision context is compact responsive and image-free',()=>{
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/:focus-visible/);
  assert.doesNotMatch(css,/url\(/);
  assert.doesNotMatch(ui,/<img\b/);
});
