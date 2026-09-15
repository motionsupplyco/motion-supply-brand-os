import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const ui=await readFile(new URL('../public/net-profit-ui.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/net-profit-ui.css',import.meta.url),'utf8');
const count=(source,needle)=>source.split(needle).length-1;

test('Profit Guardrails assets and isolated route load exactly once',()=>{
  assert.equal(count(index,'net-profit-ui.js'),1);
  assert.equal(count(index,'net-profit-ui.css'),1);
  assert.equal(count(index,'data-profit-view="profitguardrails"'),1);
  assert.doesNotMatch(index,/data-view="profitguardrails"/);
});

test('Shopify source only supplies commerce observations, never invented business costs',()=>{
  const loadStart=ui.indexOf('async function loadShopify');
  assert.ok(loadStart>=0);
  const loadBlock=ui.slice(loadStart,loadStart+2300);
  for(const field of ['grossSales','discounts','refunds','netSales','shippingCollected'])assert.match(loadBlock,new RegExp(`model\\.${field}=`));
  for(const field of ['cogs','packagingPeriod','outboundShipping','fulfillment','paymentFees','affiliateSpend','adSpend','software','rent','payroll','contractors'])assert.doesNotMatch(loadBlock,new RegExp(`model\\.${field}=`));
  assert.match(ui,/It does not invent COGS, payroll, ad spend or fees/);
  assert.match(ui,/Brand OS operational definition/i);
  assert.match(ui,/not Shopify Analytics official net sales/i);
});

test('Profit Guardrails exposes true profit and both period and first-order acquisition controls',()=>{
  for(const phrase of ['TRUE OPERATING PROFIT','ACQUISITION HEADROOM','MAX CAC @ TARGET','FIRST-ORDER GUARDRAIL','MAX FIRST-ORDER CAC','CAC HEADROOM'])assert.match(ui,new RegExp(phrase));
  assert.match(ui,/targetOperatingMarginPct/);
  assert.match(ui,/targetPostCacContribution/);
});

test('paid-media language does not claim attribution causality',()=>{
  assert.match(ui,/not proof that paid media caused the revenue/i);
  assert.match(ui,/attribution are treated as observations, not guaranteed causality/i);
});

test('Profit Guardrails browser bundle contains no integration credentials',()=>{
  assert.doesNotMatch(ui,/access_token_ciphertext|refresh_token_ciphertext|SHOPIFY_CLIENT_SECRET|INTEGRATION_TOKEN_ENCRYPTION_KEY/);
});

test('Profit Guardrails has desktop, tablet and phone layout contracts',()=>{
  assert.match(css,/@media\(max-width:1180px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-width:520px\)/);
});
