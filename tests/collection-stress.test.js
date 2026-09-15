import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCollection,collectionScenario,collectionCashSchedule,applyCollectionCashSchedule,breakEvenSellThroughPct,stressCollection} from '../public/collection-stress.js';

const close=(actual,expected,tolerance=.01)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} not within ${tolerance} of ${expected}`);

const DROP={
  variants:[
    {key:'S',label:'Small',units:100},{key:'M',label:'Medium',units:150},
    {key:'L',label:'Large',units:150},{key:'XL',label:'XL',units:75}
  ],
  retailPrice:84,landedCost:24.70,factoryUnitCost:19,markdownPct:20,unitsPerOrder:1.25,
  processorPercent:2.9,processorFixed:.30,packagingPerOrder:1.20,shippingSubsidyPerOrder:4.50,
  returnHandlingPerReturn:4,cacPerOrder:18,fixedLaunchCost:2200,depositPct:50,balanceDueWeek:5,freightDutyWeek:5,launchWeek:2
};
const BASE={name:'Base',sellThroughPct:78,fullPriceShareOfSoldPct:85,returnRatePct:10,restockableReturnPct:80};

test('collection normalization never invents units, prices, costs or demand',()=>{
  const clean=normalizeCollection({variants:[{sku:'BLK-M',units:''}]});
  assert.equal(clean.variants.length,0);
  assert.equal(clean.retailPrice,0);
  assert.equal(clean.fixedLaunchCost,0);
  assert.equal(clean.cacPerOrder,0);
});

test('base apparel drop economics stay locked across sell-through, returns, CAC and leftover inventory',()=>{
  const result=collectionScenario(DROP,BASE);
  close(result.startingUnits,475);
  close(result.grossSoldUnits,370.5);
  close(result.overallSellThroughPct,78);
  close(result.fullPriceUnits,314.925);
  close(result.markdownUnits,55.575);
  close(result.expectedReturnUnits,37.05);
  close(result.restockableReturnUnits,29.64);
  close(result.grossMerchandiseRevenue,30188.34);
  close(result.netMerchandiseRevenue,27169.506);
  close(result.orders,296.4);
  close(result.processorFees,964.38186);
  close(result.variableSellingCash,2802.06186);
  close(result.adSpend,5335.2);
  close(result.cogsRemovedFromInventory,8419.242);
  close(result.contributionAfterAcquisition,10613.00214);
  close(result.contributionAfterFixed,8413.00214);
  close(result.productionCashCost,11732.5);
  close(result.factoryCashCost,9025);
  close(result.endingInventoryAtCost,3313.258);
  close(result.collectionCashRecovery,5099.74414);
  close(result.economicPositionAtInventoryCost,8413.00214);
});

test('size-specific sell-through exposes size-curve risk instead of forcing one collection average',()=>{
  const result=collectionScenario(DROP,{...BASE,variantSellThroughPct:{S:70,M:80,L:70,XL:50}});
  close(result.overallSellThroughPct,70);
  close(result.variants.find(x=>x.key==='M').grossSoldUnits,120);
  close(result.variants.find(x=>x.key==='XL').grossSoldUnits,37.5);
  assert.ok(result.variants.find(x=>x.key==='XL').endingSellableUnits>result.variants.find(x=>x.key==='XL').grossSoldUnits);
});

test('factory deposit, balance, freight/duty and launch spend land in explicit forecast weeks',()=>{
  const schedule=collectionCashSchedule(DROP,BASE);
  close(schedule.factoryDeposit,4512.5);
  close(schedule.factoryBalance,4512.5);
  close(schedule.freightDutyCash,2707.5);
  close(schedule.adSpend,5335.2);
  close(schedule.fixedLaunchCost,2200);
  close(schedule.weeks[0].factoryDeposits,4512.5);
  close(schedule.weeks[4].factoryBalances,4512.5);
  close(schedule.weeks[4].freightDuty,2707.5);
  close(schedule.weeks[1].marketing,5335.2);
  close(schedule.weeks[1].otherOutflows,2200);
});

test('collection cash schedule overlays an existing 13-week forecast without mutating base cash categories',()=>{
  const base=Array.from({length:13},(_,index)=>({label:`Week ${index+1}`,dtcPayouts:index===1?8000:0,marketing:index===1?500:0,factoryDeposits:0,factoryBalances:0,freightDuty:0,otherOutflows:0}));
  const schedule=collectionCashSchedule(DROP,BASE);
  const merged=applyCollectionCashSchedule(base,schedule);
  assert.equal(base[1].marketing,500);
  close(merged[1].dtcPayouts,8000);
  close(merged[1].marketing,5835.2);
  close(merged[0].factoryDeposits,4512.5);
});

test('break-even sell-through finds the minimum cash-recovery threshold for the modeled drop',()=>{
  const threshold=breakEvenSellThroughPct(DROP,BASE);
  close(threshold,57.10,.03);
  const justBelow=collectionScenario(DROP,{...BASE,sellThroughPct:threshold-.05,variantSellThroughPct:null});
  const atThreshold=collectionScenario(DROP,{...BASE,sellThroughPct:threshold,variantSellThroughPct:null});
  assert.ok(justBelow.collectionCashRecovery<0);
  assert.ok(atThreshold.collectionCashRecovery>=-5);
});

test('break-even sell-through returns null when even 100% sell-through cannot recover collection cash',()=>{
  const threshold=breakEvenSellThroughPct({...DROP,retailPrice:10},BASE);
  assert.equal(threshold,null);
});

test('stressCollection compares multiple explicit scenarios without inventing a hidden baseline',()=>{
  const result=stressCollection(DROP,[BASE,{...BASE,name:'Downside',sellThroughPct:55,fullPriceShareOfSoldPct:65,returnRatePct:14}]);
  assert.equal(result.scenarios.length,2);
  assert.equal(result.scenarios[0].name,'Base');
  assert.equal(result.scenarios[1].name,'Downside');
  assert.ok(result.worstCashRecovery<result.bestCashRecovery);
  assert.equal(stressCollection(DROP,[]).scenarios.length,0);
});
