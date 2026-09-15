import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/factory-quote-ui.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/factory-quote-ui.css',import.meta.url),'utf8');
const count=(source,needle)=>source.split(needle).length-1;

test('Factory Quote Compare assets and isolated route load once',()=>{
  assert.equal(count(index,'factory-quote-ui.js'),1);
  assert.equal(count(index,'factory-quote-ui.css'),1);
  assert.equal(count(index,'data-factory-view="quotecompare"'),1);
  assert.doesNotMatch(index,/data-view="quotecompare"/);
});

test('quote comparison normalizes the cash and timing facts founders actually need',()=>{
  for(const phrase of ['Factory unit quote','Production subtotal','Deposit terms','Remaining factory balance','Total known cash','Sample lead time','Production lead time'])assert.match(ui,new RegExp(phrase));
  for(const field of ['factoryUnitCost','depositPct','freightEstimate','dutyEstimate','inspectionCost','sampleLeadDays','productionLeadDays'])assert.match(ui,new RegExp(field));
});

test('blank landed estimates remain UNKNOWN rather than becoming complete zero-cost assumptions',()=>{
  assert.match(ui,/UNKNOWN/);
  assert.match(ui,/Blank freight, duty or QC stays UNKNOWN—not zero/);
  assert.match(ui,/Excludes \$\{esc\(row\.missingEstimateLabels\.join/);
});

test('quote comparison never ranks or endorses factory legitimacy',()=>{
  assert.match(ui,/FACTS · NOT A RECOMMENDATION/);
  assert.match(ui,/does not verify factories or recommend a supplier/i);
  assert.match(ui,/does not know from a quote whether a factory is legitimate/i);
  assert.doesNotMatch(ui,/best factory|recommended factory|trust score|factory score|safe supplier/i);
});

test('Factory Quote Compare does not hardcode the current Pro price',()=>{
  assert.doesNotMatch(ui,/\$19|19\/month|19\/mo/);
});

test('Factory Quote Compare adapts for desktop, tablet and phone',()=>{
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-width:520px\)/);
});
