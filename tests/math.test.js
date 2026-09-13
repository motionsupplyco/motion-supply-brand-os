import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOUNDRY_EIGHT, STARTER_STATE, processorFee, realizedPrice, preCacContribution, postCacContribution,
  maxFirstOrderCac, grossMarginPct, contributionMarginPct, breakEvenOrders, inventoryMath,
  wholesaleContribution, retailerGrossMarginPct, normalized3pl, crossoverOrders, cashCheckpoint,
  purchaseOrderGate, cacFromSpend, funnelMetrics
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
test('negative processor inputs cannot create fake profit',()=>assert.equal(processorFee(100,{processorPercent:-5,processorFixed:-10}),0));
test('discount percentages are bounded between 0 and 100',()=>{assert.equal(realizedPrice({...FOUNDRY_EIGHT,price:100},150),0);assert.equal(realizedPrice({...FOUNDRY_EIGHT,price:100},-25),100)});
test('negative order costs are treated as zero rather than increasing contribution',()=>{const s={...STARTER_STATE,price:100,landedCost:-25,packaging:-2};assert.equal(preCacContribution(s,0,0),100)});

test('CAC from spend uses new customers',()=>close(cacFromSpend(FOUNDRY_EIGHT),15));
test('CAC with zero customers is intentionally undefined/infinite',()=>assert.equal(cacFromSpend({...FOUNDRY_EIGHT,newCustomers:0}),Infinity));
test('max CAC never goes below zero',()=>assert.equal(maxFirstOrderCac({...FOUNDRY_EIGHT,requiredPostCac:1000}),0));

test('margin calculations remain meaningful when cost exceeds price',()=>{const s={...FOUNDRY_EIGHT,price:50,landedCost:60};assert.ok(grossMarginPct(s)<0);assert.ok(contributionMarginPct(s)<0)});
test('break-even is infinite when contribution after CAC is not positive',()=>assert.equal(breakEvenOrders({...FOUNDRY_EIGHT,observedCac:1000}),Infinity));

test('funnel math matches locked Foundry Eight conversion case',()=>{
  const x=funnelMetrics(FOUNDRY_EIGHT);
  close(x.conversionRate,14/1500*100);
  close(x.addToCartRate,50/1500*100);
  close(x.checkoutCompletionRate,14/32*100);
});
test('funnel zeros do not generate NaN or Infinity',()=>assert.deepEqual(funnelMetrics(STARTER_STATE),{conversionRate:0,addToCartRate:0,checkoutStartRate:0,cartToCheckoutRate:0,checkoutCompletionRate:0}));

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
test('allocated stock reduces inventory position',()=>{const x=inventoryMath({...FOUNDRY_EIGHT,onHand:35,inbound:10,allocated:15});assert.equal(x.inventoryPosition,30)});
test('inventory cannot go negative and zero demand produces infinite weeks cover',()=>{const x=inventoryMath({...STARTER_STATE,onHand:-5,inbound:-3,allocated:50});assert.equal(x.inventoryPosition,0);assert.equal(x.weeksCover,Infinity)});

test('wholesale example stays locked',()=>{close(wholesaleContribution(FOUNDRY_EIGHT),13);close(retailerGrossMarginPct(FOUNDRY_EIGHT),(78-45)/78*100)});
test('wholesale commission above 100 percent is capped at 100 percent',()=>{const x=wholesaleContribution({...FOUNDRY_EIGHT,wholesalePrice:50,landedCost:0,wholesaleHandling:0,wholesaleRepPct:400});assert.equal(x,0)});

test('3PL case stays locked',()=>{close(normalized3pl(FOUNDRY_EIGHT),5.9);assert.equal(crossoverOrders(FOUNDRY_EIGHT),1563)});
test('3PL calculations avoid division by zero',()=>assert.equal(normalized3pl({...FOUNDRY_EIGHT,monthlyOrders:0}),Infinity));

test('cash checkpoint ignores negative fake inflows and outflows',()=>{const x=cashCheckpoint({...STARTER_STATE,cashStart:1000,expectedInflows:-100,committedOutflows:-500,protectedFloor:200});assert.equal(x.projectedCash,1000);assert.equal(x.headroom,800)});

test('PO cash gate keeps legacy total/deposit/full-payment comparison',()=>{
  const x=purchaseOrderGate({...FOUNDRY_EIGHT,proposedUnits:80,depositPct:50,cashStart:7500,expectedInflows:0,committedOutflows:0,protectedFloor:2500,poExpectedInflowsBeforeBalance:0,poExpectedOutflowsBeforeBalance:0});
  close(x.poTotal,2192);close(x.deposit,1096);close(x.afterDeposit,6404);close(x.afterFullPo,5308);close(x.fullPoHeadroom,2808);close(x.afterBalance,5308);
});

test('PO cash gate models cash movement between deposit and remaining balance',()=>{
  const x=purchaseOrderGate({...STARTER_STATE,cashStart:5000,protectedFloor:2000,landedCost:20,proposedUnits:100,depositPct:30,poBalanceDueWeeks:4,poExpectedInflowsBeforeBalance:1000,poExpectedOutflowsBeforeBalance:500});
  assert.equal(x.poTotal,2000);
  assert.equal(x.deposit,600);
  assert.equal(x.remainingBalance,1400);
  assert.equal(x.afterDeposit,4400);
  assert.equal(x.cashBeforeBalance,4900);
  assert.equal(x.afterBalance,3500);
  assert.equal(x.minimumHeadroom,1500);
  assert.equal(x.balanceDueWeeks,4);
});

test('PO deposit is bounded to 100 percent and cannot create a negative remaining balance',()=>{const x=purchaseOrderGate({...STARTER_STATE,cashStart:5000,landedCost:10,proposedUnits:100,depositPct:250});assert.equal(x.deposit,1000);assert.equal(x.remainingBalance,0)});

test('PO timeline flags the lowest cash point, not only the deposit',()=>{const x=purchaseOrderGate({...STARTER_STATE,cashStart:4000,protectedFloor:2000,landedCost:20,proposedUnits:100,depositPct:20,poExpectedInflowsBeforeBalance:0,poExpectedOutflowsBeforeBalance:700});assert.equal(x.afterDeposit,3600);assert.equal(x.afterBalance,1300);assert.equal(x.minimumHeadroom,-700)});
