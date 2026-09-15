import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/production-preflight-ui.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/production-preflight-ui.css',import.meta.url),'utf8');
const count=(source,needle)=>source.split(needle).length-1;

test('Production Preflight assets and isolated nav route load once',()=>{
  assert.equal(count(index,'production-preflight-ui.js'),1);
  assert.equal(count(index,'production-preflight-ui.css'),1);
  assert.equal(count(index,'data-production-view="preflight"'),1);
  assert.doesNotMatch(index,/data-view="preflight"/);
});

test('preflight UI exposes tech-pack, sample, written-term and cash commitment sections',()=>{
  for(const phrase of ['TECH PACK','SAMPLE APPROVAL','WRITTEN TERMS','CASH COMMITMENT','DECISION GATE'])assert.match(ui,new RegExp(phrase));
  for(const field of ['orderQty','factoryUnitCost','depositPct','inspectionCost','freightEstimate','dutyEstimate'])assert.match(ui,new RegExp(field));
});

test('preflight never claims to verify or approve the factory',()=>{
  assert.match(ui,/This is an internal decision gate—not factory verification/i);
  assert.match(ui,/It does not validate the supplier/i);
  assert.doesNotMatch(ui,/factory verified|verified factory|trusted factory|safe supplier/i);
});

test('missing estimates and blockers are visible rather than silently zeroed as complete',()=>{
  assert.match(ui,/Not all landed estimates entered/);
  assert.match(ui,/Do not treat the deposit as internally cleared yet/);
  assert.match(ui,/Enter 0 only if truly none/);
});

test('Production Preflight does not introduce another hardcoded Pro price',()=>{
  assert.doesNotMatch(ui,/\$19|19\/month|19\/mo/);
});

test('Production Preflight is responsive down to narrow phone widths',()=>{
  assert.match(css,/@media\(max-width:1050px\)/);
  assert.match(css,/@media\(max-width:800px\)/);
  assert.match(css,/@media\(max-width:560px\)/);
});
