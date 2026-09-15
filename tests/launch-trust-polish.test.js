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
  const newGates=[
    ['net-profit-ui.js','data-profit-action="upgrade"','[data-profit-action="upgrade"]'],
    ['collection-stress-ui.js','data-stress-action="upgrade"','[data-stress-action="upgrade"]'],
    ['production-preflight-ui.js','data-preflight-action="upgrade"','[data-preflight-action="upgrade"]'],
    ['factory-quote-ui.js','data-quote-action="upgrade"','[data-quote-action="upgrade"]']
  ];

  assert.match(polish,/PRO_PRICE_MONTHLY=19/);
  assert.match(polish,/Brand OS Pro — \$\{PRO_PRICE_LABEL\} · Cancel anytime\./);
  assert.match(polish,/querySelectorAll/,'pricing enhancer must patch every rendered matching upgrade surface');
  assert.ok(polish.includes("next?.matches('[data-pro-price-note]')"),'overlapping legacy/action hooks must not create duplicate price notes');

  for(const selector of ['#billingBtn','#upgradeNow','#acctBillingOpen','#memoryUpgrade','[data-v2-action="upgrade"]',...newGates.map(([, ,selector])=>selector)]){
    assert.ok(polish.includes(selector),`launch pricing must cover ${selector}`);
  }

  for(const source of [app,account,memory])assert.doesNotMatch(source,/\$19(?:\/month|\/mo)?/);
  for(const [file,hook] of newGates){
    const source=await readFile(new URL(`../public/${file}`,import.meta.url),'utf8');
    assert.ok(source.includes(hook),`${file} must expose its upgrade action hook`);
    assert.doesNotMatch(source,/\$19(?:\/month|\/mo)?/,`${file} must not duplicate the centralized Pro price`);
  }
});
