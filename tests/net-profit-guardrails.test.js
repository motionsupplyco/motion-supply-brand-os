import test from 'node:test';
import assert from 'node:assert/strict';
import {trueNetProfit,acquisitionSpendScenarios,firstOrderAcquisitionGuardrail} from '../public/net-profit-guardrails.js';

test('true net profit counts revenue, direct costs, acquisition and operating overhead separately',()=>{
  const result=trueNetProfit({
    grossSales:10000,discounts:500,refunds:300,shippingCollected:400,
    cogs:3000,packaging:300,outboundShipping:700,fulfillment:500,paymentFees:300,affiliateSpend:200,
    adSpend:1500,software:200,rent:400,payroll:800,contractors:200,otherOperating:100,newCustomers:50,targetOperatingMarginPct:10
  });
  assert.equal(result.netMerchandiseRevenue,9200);
  assert.equal(result.operatingRevenue,9600);
  assert.equal(result.directCosts,5000);
  assert.equal(result.contributionBeforeAcquisition,4600);
  assert.equal(result.contributionAfterAcquisition,3100);
  assert.equal(result.operatingExpenses,1700);
  assert.equal(result.operatingProfit,1400);
  assert.equal(result.maxAcquisitionSpendForTarget,1940);
  assert.equal(result.acquisitionHeadroom,440);
  assert.equal(result.observedCac,30);
  assert.equal(result.maxCacForTarget,38.8);
  assert.equal(result.acquisitionWithinTarget,true);
});

test('provided net sales is treated as source truth instead of subtracting refunds twice',()=>{
  const result=trueNetProfit({grossSales:10000,discounts:600,refunds:900,netSales:8500,shippingCollected:100});
  assert.equal(result.netMerchandiseRevenue,8500);
  assert.equal(result.operatingRevenue,8600);
});

test('taxes are intentionally absent from operating revenue math',()=>{
  const baseline=trueNetProfit({grossSales:1000});
  const withTaxField=trueNetProfit({grossSales:1000,taxesCollected:500});
  assert.equal(withTaxField.operatingRevenue,baseline.operatingRevenue);
});

test('acquisition guardrail fails when spend exceeds the target-margin ceiling',()=>{
  const result=trueNetProfit({grossSales:5000,cogs:2000,adSpend:2000,software:500,targetOperatingMarginPct:10,newCustomers:20});
  assert.equal(result.maxAcquisitionSpendForTarget,2000);
  assert.equal(result.acquisitionWithinTarget,true);
  const failed=trueNetProfit({grossSales:5000,cogs:2000,adSpend:2200,software:500,targetOperatingMarginPct:10,newCustomers:20});
  assert.equal(failed.acquisitionWithinTarget,false);
  assert.equal(failed.acquisitionHeadroom,-200);
});

test('spend scenarios change only paid acquisition pressure',()=>{
  const input={grossSales:8000,cogs:2500,adSpend:1000,software:300,targetOperatingMarginPct:8};
  const scenarios=acquisitionSpendScenarios(input,[.5,1,1.5]);
  assert.deepEqual(scenarios.map(x=>x.adSpend),[500,1000,1500]);
  assert.ok(scenarios[0].operatingProfit>scenarios[1].operatingProfit);
  assert.ok(scenarios[1].operatingProfit>scenarios[2].operatingProfit);
});

test('first-order guardrail keeps processor affiliate and target contribution in the CAC ceiling',()=>{
  const result=firstOrderAcquisitionGuardrail({price:80,landedCost:25,packaging:2,shippingSubsidy:5,returnReserve:3,processorPercent:3,processorFixed:.30,affiliatePct:10,targetPostCacContribution:15,observedCac:20});
  assert.equal(Number(result.processorFee.toFixed(2)),2.7);
  assert.equal(Number(result.affiliateCost.toFixed(2)),8);
  assert.equal(Number(result.preCacContribution.toFixed(2)),34.3);
  assert.equal(Number(result.maxFirstOrderCac.toFixed(2)),19.3);
  assert.equal(result.passes,false);
  assert.equal(Number(result.cacHeadroom.toFixed(2)),-.7);
});

test('negative or nonsensical money inputs cannot create fake profit',()=>{
  const result=trueNetProfit({grossSales:-100,cogs:-50,adSpend:-10,targetOperatingMarginPct:200});
  assert.equal(result.operatingRevenue,0);
  assert.equal(result.cogs,0);
  assert.equal(result.adSpend,0);
  assert.equal(result.targetOperatingMarginPct,100);
  assert.equal(result.operatingProfit,0);
});
