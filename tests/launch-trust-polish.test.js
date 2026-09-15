import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FOUNDRY_EIGHT} from '../public/math.js';
import {discountOutcome,maxSafeDiscountPct} from '../public/discount-ceiling.js';

const close=(a,b,t=.01)=>assert.ok(Math.abs(a-b)<t,`${a} not close to ${b}`);

test('Foundry Eight exact maximum safe discount stays locked',()=>{
  const max=maxSafeDiscountPct(FOUNDRY_EIGHT,0);
  close(max,12.9895164911,.0001);
  assert.equal(discountOutcome(FOUNDRY_EIGHT,max,0).pass,true);
  assert.equal(discountOutcome(FOUNDRY_EIGHT,max+.01,0).pass,false);
});

test('exact discount ceiling returns no safe discount when full price misses the floor',()=>{
  const s={...FOUNDRY_EIGHT,requiredPostCac:100};
  assert.equal(maxSafeDiscountPct(s,0),null);
});

test('affiliate commission tightens the safe discount ceiling',()=>{
  const noAffiliate=maxSafeDiscountPct(FOUNDRY_EIGHT,0);
  const withAffiliate=maxSafeDiscountPct(FOUNDRY_EIGHT,10);
  assert.ok(withAffiliate<noAffiliate);
});

test('Pro price display is centralized and covers every upgrade surface',async()=>{
  const polish=await readFile(new URL('../public/launch-polish.js',import.meta.url),'utf8');
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const account=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');
  const memory=await readFile(new URL('../public/business-memory-ui.js',import.meta.url),'utf8');
  assert.match(polish,/PRO_PRICE_MONTHLY=19/);
  for(const selector of ['#billingBtn','#upgradeNow','#acctBillingOpen','#memoryUpgrade'])assert.match(polish,new RegExp(selector.replace('#','\\#')));
  for(const source of [app,account,memory])assert.doesNotMatch(source,/\$19(?:\/month|\/mo)?/);
});
