import test from 'node:test';
import assert from 'node:assert/strict';
import {FOUNDRY_EIGHT,inventoryMath} from '../public/math.js';
import {FORECAST_WEEKS,cashForecast,cashForecastScenario,reorderIntelligence,reorderCashGate,buildOperatingAlerts} from '../public/operating-intelligence.js';

const close=(actual,expected,tolerance=.001)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} not within ${tolerance} of ${expected}`);

test('13-week cash forecast carries closing cash into the next opening balance',()=>{
  const forecast=cashForecast({
    startingCash:7500,
    protectedFloor:2500,
    weeks:[
      {dtcPayouts:1000,marketing:400,factoryDeposits:600},
      {wholesaleReceipts:500,payrollContractors:300}
    ]
  });
  assert.equal(forecast.weeks.length,FORECAST_WEEKS);
  assert.equal(forecast.weeks[0].openingCash,7500);
  assert.equal(forecast.weeks[0].closingCash,7500);
  assert.equal(forecast.weeks[1].openingCash,7500);
  assert.equal(forecast.weeks[1].closingCash,7700);
  assert.equal(forecast.endingCash,7700);
  assert.equal(forecast.passes,true);
});

test('cash forecast identifies the first protected-floor breach and minimum headroom',()=>{
  const forecast=cashForecast({
    startingCash:5000,
    protectedFloor:2500,
    weeks:[
      {factoryDeposits:1000},
      {marketing:800},
      {factoryBalances:1200},
      {dtcPayouts:400}
    ]
  });
  assert.equal(forecast.firstBreachWeek,3);
  assert.equal(forecast.firstBreachAmount,500);
  assert.equal(forecast.minimumWeek,3);
  assert.equal(forecast.minimumHeadroom,-500);
  assert.equal(forecast.passes,false);
});

test('scenario forecast changes operating inflows and marketing without mutating the source',()=>{
  const input={startingCash:1000,protectedFloor:0,weeks:[{dtcPayouts:1000,wholesaleReceipts:500,marketing:200,otherInflows:50}]};
  const scenario=cashForecastScenario(input,{inflowMultiplier:.8,marketingMultiplier:1.25});
  assert.equal(input.weeks[0].dtcPayouts,1000);
  assert.equal(scenario.weeks[0].dtcPayouts,800);
  assert.equal(scenario.weeks[0].wholesaleReceipts,400);
  assert.equal(scenario.weeks[0].otherInflows,50);
  assert.equal(scenario.weeks[0].marketing,250);
  assert.equal(scenario.weeks[0].closingCash,2000);
});

test('Foundry Eight reorder intelligence stays aligned with the existing inventory model',()=>{
  const legacy=inventoryMath(FOUNDRY_EIGHT);
  const intelligence=reorderIntelligence(FOUNDRY_EIGHT);
  assert.equal(intelligence.reorderPoint,legacy.reorderPoint);
  assert.equal(intelligence.inventoryPosition,legacy.inventoryPosition);
  assert.equal(intelligence.reorderGap,legacy.reorderGap);
  assert.equal(intelligence.reorderPoint,84);
  assert.equal(intelligence.inventoryPosition,35);
  assert.equal(intelligence.reorderGap,49);
  assert.equal(intelligence.reviewQuantity,49);
  assert.equal(intelligence.reviewTriggered,true);
  assert.equal(intelligence.severity,'critical');
  close(intelligence.onHandWeeksCover,3.5);
  close(intelligence.reviewCashRequired,1342.6);
});

test('inbound inventory can clear a reorder review without changing on-hand cover',()=>{
  const intelligence=reorderIntelligence({...FOUNDRY_EIGHT,inbound:60});
  assert.equal(intelligence.inventoryPosition,95);
  assert.equal(intelligence.reviewTriggered,false);
  assert.equal(intelligence.reviewQuantity,0);
  close(intelligence.onHandWeeksCover,3.5);
  close(intelligence.positionWeeksCover,9.5);
});

test('MOQ raises the quantity to investigate but never auto-approves a PO',()=>{
  const intelligence=reorderIntelligence({...FOUNDRY_EIGHT,moq:100});
  assert.equal(intelligence.reorderGap,49);
  assert.equal(intelligence.reviewQuantity,100);
  assert.match(intelligence.note,/Review demand quality/);
});

test('reorder cash gate checks deposit pressure against forecast headroom',()=>{
  const reorder=reorderIntelligence({...FOUNDRY_EIGHT,moq:100});
  const pass=reorderCashGate(reorder,{forecastHeadroom:2000,depositPct:50});
  close(pass.cashDueNow,1370);
  close(pass.remainingHeadroom,630);
  assert.equal(pass.passes,true);
  const hold=reorderCashGate(reorder,{forecastHeadroom:1000,depositPct:50});
  assert.equal(hold.passes,false);
  close(hold.remainingHeadroom,-370);
});

test('operating alerts prioritize cash breaches and urgent reorder reviews',()=>{
  const forecast=cashForecast({startingCash:3000,protectedFloor:2500,weeks:[{marketing:800}]});
  const reorder=reorderIntelligence(FOUNDRY_EIGHT);
  const alerts=buildOperatingAlerts({forecast,reorders:[{sku:'HD-BLK-M',label:'Black Hoodie · M',result:reorder}],adSignal:{spendChangePct:22,contributionChangePct:6}});
  assert.equal(alerts.length,3);
  assert.equal(alerts[0].severity,'critical');
  assert.ok(alerts.some(x=>x.type==='cash_floor'));
  assert.ok(alerts.some(x=>x.type==='reorder_review'));
  assert.ok(alerts.some(x=>x.type==='acquisition_efficiency'));
  assert.match(alerts.find(x=>x.type==='acquisition_efficiency').detail,/observation, not proof of causation/i);
});
