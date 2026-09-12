import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOUNDRY_EIGHT, STARTER_STATE, processorFee, preCacContribution, postCacContribution,
  maxFirstOrderCac, breakEvenOrders, inventoryMath, wholesaleContribution,
  retailerGrossMarginPct, normalized3pl, crossoverOrders, purchaseOrderGate,
  cacFromSpend, funnelMetrics
} from '../public/math.js';

const close=(a,b,t=.011)=>assert.ok(Math.abs(a-b)<t,`${a} not close to ${b}`);

test('Foundry Eight canonical economics stay locked',()=>{
  close(preCacContribution(FOUNDRY_EIGHT,0,0),39.838);
  close(postCacContribution(FOUNDRY_EIGHT,0,0),24.838);
  close(maxFirstOrderCac(FOUNDRY_EIGHT),24.838);
  assert.equal(breakEvenOrders(FOUNDRY_EIGHT),45);
});

test('fresh state contains no invented payment or business costs',()=>{
  assert.equal(STARTER_STATE.price,0);
  assert.equal(STARTER_STATE.processorPercent,0);
  assert.equal(STARTER_STATE.processorFixed,0);
  assert.equal(STARTER_STATE.depositPct,0);
  assert.equal(preCacContribution(STARTER_STATE),0);
});

test('processor fixed fee is not charged when there is no sale',()=>assert.equal(processorFee(0,FOUNDRY_EIGHT),0));

test('CAC from spend uses new customers',()=>close(cacFromSpend(FOUNDRY_EIGHT),15));

test('funnel math matches locked Foundry Eight conversion case',()=>{
  const x=funnelMetrics(FOUNDRY_EIGHT);
  close(x.conversionRate,14/1500*100);
  close(x.addToCartRate,50/1500*100);
  close(x.checkoutCompletionRate,14/32*100);
});

test('inventory example stays locked and high case never drops below base',()=>{
  const x=inventoryMath(FOUNDRY_EIGHT);
  assert.equal(x.leadDemand,60);
  assert.equal(x.highLeadDemand,84);
  assert.equal(x.safetyStock,24);
  assert.equal(x.reorderPoint,84);
  assert.equal(x.inventoryPosition,35);
  close(x.weeksCover,3.5);
  const y=inventoryMath({...FOUNDRY_EIGHT,highWeeklyDemand:0});
  assert.equal(y.reorderPoint,60);
});

test('allocated stock reduces inventory position',()=>{
  const x=inventoryMath({...FOUNDRY_EIGHT,onHand:35,inbound:10,allocated:15});
  assert.equal(x.inventoryPosition,30);
});

test('wholesale example stays locked',()=>{
  close(wholesaleContribution(FOUNDRY_EIGHT),13);
  close(retailerGrossMarginPct(FOUNDRY_EIGHT),(78-45)/78*100);
});

test('3PL case stays locked',()=>{
  close(normalized3pl(FOUNDRY_EIGHT),5.9);
  assert.equal(crossoverOrders(FOUNDRY_EIGHT),1563);
});

test('PO cash gate calculates total, deposit and full-payment headroom',()=>{
  const x=purchaseOrderGate({...FOUNDRY_EIGHT,proposedUnits:80,depositPct:50,cashStart:7500,expectedInflows:0,committedOutflows:0,protectedFloor:2500});
  close(x.poTotal,2192);close(x.deposit,1096);close(x.afterDeposit,6404);close(x.afterFullPo,5308);close(x.fullPoHeadroom,2808);
});
