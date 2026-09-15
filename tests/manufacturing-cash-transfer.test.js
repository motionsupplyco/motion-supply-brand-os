import test from 'node:test';
import assert from 'node:assert/strict';
import {buildManufacturingCashTransfer,applyManufacturingCashTransfer} from '../public/manufacturing-cash-transfer.js';

const blankForecast=()=>({starting_cash:10000,protected_floor:2500,weeks:Array.from({length:13},(_,index)=>({label:`Week ${index+1}`,dtcPayouts:index===0?1200:0,factoryDeposits:0,factoryBalances:0,freightDuty:0,marketing:100,otherOutflows:0}))});

test('manufacturing transfer maps deposit, balance and known downstream cash to explicit weeks',()=>{
  const transfer=buildManufacturingCashTransfer({deposit:3000,balance:7000,freightEstimate:900,dutyEstimate:300,inspectionCost:150,otherProductionCost:50,depositWeek:1,balanceWeek:5,freightDutyWeek:6,inspectionOtherWeek:5,freightKnown:true,dutyKnown:true,inspectionKnown:true,styleName:'Heavy Hoodie'});
  assert.equal(transfer.valid,true);
  assert.equal(transfer.total,11400);
  assert.deepEqual(transfer.lines.map(line=>[line.week,line.category,line.amount]),[[1,'factoryDeposits',3000],[5,'factoryBalances',7000],[6,'freightDuty',1200],[5,'otherOutflows',200]]);
});

test('unknown landed estimates remain unknown and are never converted into zero-dollar certainty',()=>{
  const transfer=buildManufacturingCashTransfer({deposit:1000,balance:1000,depositWeek:1,balanceWeek:4,freightEstimate:999,dutyEstimate:888,inspectionCost:777,freightKnown:false,dutyKnown:false,inspectionKnown:false});
  assert.equal(transfer.valid,true);
  assert.deepEqual(transfer.unknownEstimates,['freight','duty / import taxes','inspection / QC']);
  assert.equal(transfer.lines.some(line=>line.category==='freightDuty'),false);
  assert.equal(transfer.lines.some(line=>line.label.includes('Inspection')),false);
});

test('positive commitments require explicit forecast timing instead of inventing a week',()=>{
  const transfer=buildManufacturingCashTransfer({deposit:1500,balance:1500,depositWeek:null,balanceWeek:5});
  assert.equal(transfer.valid,false);
  assert.deepEqual(transfer.missingTiming,['Factory deposit']);
});

test('applying a manufacturing transfer only adds allowed cash outflows and preserves revenue and other forecast fields',()=>{
  const forecast=blankForecast();
  const transfer=buildManufacturingCashTransfer({deposit:2000,balance:3000,freightEstimate:500,dutyEstimate:100,inspectionCost:125,depositWeek:2,balanceWeek:5,freightDutyWeek:6,inspectionOtherWeek:5});
  const result=applyManufacturingCashTransfer(forecast,transfer);
  assert.equal(result.appliedTotal,5725);
  assert.equal(result.forecast.weeks[1].factoryDeposits,2000);
  assert.equal(result.forecast.weeks[4].factoryBalances,3000);
  assert.equal(result.forecast.weeks[5].freightDuty,600);
  assert.equal(result.forecast.weeks[4].otherOutflows,125);
  assert.equal(result.forecast.weeks[0].dtcPayouts,1200);
  assert.equal(result.forecast.weeks[0].marketing,100);
  assert.equal(result.forecast.starting_cash,10000);
  assert.equal(forecast.weeks[1].factoryDeposits,0);
});

test('invalid transfer cannot mutate a forecast',()=>{
  assert.throws(()=>applyManufacturingCashTransfer(blankForecast(),{valid:false,lines:[]}),/not ready to apply/i);
});
