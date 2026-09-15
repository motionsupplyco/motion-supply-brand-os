import test from 'node:test';
import assert from 'node:assert/strict';
import {productionCommitment,productionPreflight,compareFactoryQuotes,PRODUCTION_PREFLIGHT_CHECKS} from '../public/production-preflight.js';

test('production commitment separates deposit, balance, prep costs and landed estimates',()=>{
  const result=productionCommitment({orderQty:500,factoryUnitCost:18,depositPct:30,sampleCost:120,toolingCost:250,inspectionCost:180,freightEstimate:900,dutyEstimate:450,otherProductionCost:100});
  assert.equal(result.productionSubtotal,9000);
  assert.equal(result.deposit,2700);
  assert.equal(result.balance,6300);
  assert.equal(result.preProductionCash,3070);
  assert.equal(result.postDepositKnownCash,7930);
  assert.equal(result.totalKnownCash,11000);
  assert.equal(result.coreCommercialInputsReady,true);
});

test('blank estimates stay visibly incomplete instead of becoming a fake all-in landed total',()=>{
  const result=productionCommitment({orderQty:100,factoryUnitCost:20,depositPct:50});
  assert.deepEqual(result.missingEstimateLabels,['freight','duty / import taxes','inspection / QC']);
  assert.equal(result.totalKnownCash,2000);
  assert.equal(result.coverage.freightEstimate,false);
});

test('deposit gate stays blocked when approval and core written terms are missing',()=>{
  const checks=Object.fromEntries(PRODUCTION_PREFLIGHT_CHECKS.map(check=>[check.id,'ready']));
  checks.approvedSample='missing';
  checks.paymentTerms='missing';
  const result=productionPreflight({checks,orderQty:300,factoryUnitCost:16,depositPct:40,freightEstimate:700,dutyEstimate:200,inspectionCost:100});
  assert.equal(result.status,'blocked');
  assert.ok(result.blockingMessages.some(message=>/Physical sample approved/.test(message)));
  assert.ok(result.blockingMessages.some(message=>/Payment terms/.test(message)));
});

test('waivable tech-pack items can be explicitly marked not applicable',()=>{
  const checks=Object.fromEntries(PRODUCTION_PREFLIGHT_CHECKS.map(check=>[check.id,'ready']));
  checks.artworkPlacement='na';
  checks.labelsPackaging='na';
  const result=productionPreflight({checks,orderQty:100,factoryUnitCost:22,depositPct:50,freightEstimate:400,dutyEstimate:100,inspectionCost:75});
  assert.equal(result.blockers.length,0);
  assert.equal(result.missing.find(check=>check.id==='artworkPlacement'),undefined);
});

test('non-waivable requirements cannot be bypassed with not applicable',()=>{
  const checks=Object.fromEntries(PRODUCTION_PREFLIGHT_CHECKS.map(check=>[check.id,'ready']));
  checks.measurementSpec='na';
  const result=productionPreflight({checks,orderQty:100,factoryUnitCost:22,depositPct:50,freightEstimate:400,dutyEstimate:100,inspectionCost:75});
  assert.equal(result.status,'blocked');
  assert.ok(result.blockers.some(check=>check.id==='measurementSpec'));
});

test('ready result is framed as internal review rather than factory verification',()=>{
  const checks=Object.fromEntries(PRODUCTION_PREFLIGHT_CHECKS.map(check=>[check.id,'ready']));
  const result=productionPreflight({checks,orderQty:250,factoryUnitCost:19,depositPct:30,freightEstimate:800,dutyEstimate:250,inspectionCost:150});
  assert.equal(result.status,'ready_for_internal_review');
  assert.match(result.disclaimer,/does not verify a factory/i);
  assert.doesNotMatch(result.status,/approved|verified|trusted/i);
});

test('100 percent deposit is surfaced as a cash caution without inventing an industry threshold',()=>{
  const checks=Object.fromEntries(PRODUCTION_PREFLIGHT_CHECKS.map(check=>[check.id,'ready']));
  const result=productionPreflight({checks,orderQty:50,factoryUnitCost:30,depositPct:100,freightEstimate:200,dutyEstimate:50,inspectionCost:50});
  assert.ok(result.cautions.some(message=>/full production subtotal/i.test(message)));
  assert.equal(result.commitment.deposit,1500);
  assert.equal(result.commitment.balance,0);
});

test('factory quote comparison preserves facts without ranking legitimacy',()=>{
  const result=compareFactoryQuotes([{name:'A',orderQty:100,factoryUnitCost:20,depositPct:30,sampleLeadDays:10,productionLeadDays:35},{name:'B',orderQty:100,factoryUnitCost:18,depositPct:50,sampleLeadDays:14,productionLeadDays:28}]);
  assert.equal(result.length,2);
  assert.equal(result[0].deposit,600);
  assert.equal(result[1].deposit,900);
  assert.equal(result[1].productionLeadDays,28);
  assert.equal('trustScore' in result[0],false);
  assert.equal('rank' in result[0],false);
});
