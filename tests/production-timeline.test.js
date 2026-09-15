import test from 'node:test';
import assert from 'node:assert/strict';
import {productionTimeline} from '../public/production-timeline.js';

test('forward production timeline uses founder-entered calendar-day assumptions',()=>{
  const result=productionTimeline({depositDate:'2026-09-15',productionLeadDays:35,inspectionDays:3,transitDays:12,customsBufferDays:4,receivingPrepDays:2,contentBufferDays:7});
  assert.equal(result.productionComplete,'2026-10-20');
  assert.equal(result.qcComplete,'2026-10-23');
  assert.equal(result.estimatedArrival,'2026-11-04');
  assert.equal(result.inventoryReady,'2026-11-10');
  assert.equal(result.earliestLaunch,'2026-11-17');
  assert.equal(result.totalCriticalPathDays,63);
});

test('backward plan calculates latest modeled deposit date from target launch',()=>{
  const result=productionTimeline({targetLaunchDate:'2026-12-01',productionLeadDays:30,inspectionDays:2,transitDays:10,customsBufferDays:3,receivingPrepDays:2,contentBufferDays:7});
  assert.equal(result.totalCriticalPathDays,54);
  assert.equal(result.latestDepositDate,'2026-10-08');
});

test('launch readiness shows positive modeled buffer when earliest launch is before target',()=>{
  const result=productionTimeline({depositDate:'2026-09-15',targetLaunchDate:'2026-11-30',productionLeadDays:35,inspectionDays:3,transitDays:12,customsBufferDays:4,receivingPrepDays:2,contentBufferDays:7});
  assert.equal(result.status,'on_track');
  assert.equal(result.launchBufferDays,13);
});

test('launch readiness shows lateness without claiming a guaranteed delay',()=>{
  const result=productionTimeline({depositDate:'2026-10-15',targetLaunchDate:'2026-11-20',productionLeadDays:35,inspectionDays:3,transitDays:12,customsBufferDays:4,receivingPrepDays:2,contentBufferDays:7});
  assert.equal(result.status,'late');
  assert.ok(result.launchBufferDays<0);
  assert.match(result.disclaimer,/modeled.*founder-entered/i);
  assert.match(result.disclaimer,/not.*guarantees/i);
});

test('missing anchor dates do not invent dates',()=>{
  const result=productionTimeline({productionLeadDays:30,transitDays:10});
  assert.equal(result.depositDate,null);
  assert.equal(result.inventoryReady,null);
  assert.equal(result.latestDepositDate,null);
  assert.equal(result.status,'unscoped');
});
