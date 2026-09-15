import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/manufacturing-cash-handoff-ui.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/manufacturing-cash-handoff.css',import.meta.url),'utf8');
const count=(source,needle)=>source.split(needle).length-1;

test('manufacturing handoff assets load exactly once',()=>{
  assert.equal(count(index,'manufacturing-cash-handoff-ui.js'),1);
  assert.equal(count(index,'manufacturing-cash-handoff.css'),1);
});

test('factory quote handoff resets preflight readiness instead of carrying approval state',()=>{
  assert.match(ui,/checks:blankChecks\(\)/);
  assert.match(ui,/readiness checks were reset/i);
  assert.doesNotMatch(ui,/approvedFactory|trustedFactory|factoryVerified/);
});

test('preflight handoff requires explicit 13-week timing before a positive cash line can move',()=>{
  for(const key of ['depositWeek','balanceWeek','freightDutyWeek','inspectionOtherWeek'])assert.match(ui,new RegExp(key));
  assert.match(ui,/Choose a forecast week for:/);
  assert.match(ui,/will not change the forecast until you press Apply/i);
});

test('cash forecast handoff is reviewable, additive and discardable',()=>{
  assert.match(ui,/Apply to this forecast/);
  assert.match(ui,/Discard transfer/);
  assert.match(ui,/adds.*current forecast values/i);
  assert.match(ui,/applyManufacturingCashTransfer/);
});

test('unknown landed estimates stay disclosed in the pending cash card',()=>{
  assert.match(ui,/Still unknown:/);
  assert.match(ui,/Those estimates are not included/);
});

test('handoff has responsive phone layout',()=>{
  assert.match(css,/@media\(max-width:560px\)/);
});
