import test from 'node:test';
import assert from 'node:assert/strict';
import {productionMilestoneStatus,buildProductionMilestones} from '../public/production-milestones.js';

test('open milestones become upcoming, due soon or overdue from founder planned dates',()=>{
  assert.equal(productionMilestoneStatus({plannedDate:'2026-10-01',asOfDate:'2026-09-15'}).status,'upcoming');
  assert.equal(productionMilestoneStatus({plannedDate:'2026-09-20',asOfDate:'2026-09-15'}).status,'due_soon');
  const overdue=productionMilestoneStatus({plannedDate:'2026-09-10',asOfDate:'2026-09-15'});
  assert.equal(overdue.status,'overdue');
  assert.equal(overdue.daysUntil,-5);
});

test('completed milestones report schedule variance without inferring a cause',()=>{
  const onTime=productionMilestoneStatus({plannedDate:'2026-09-20',actualDate:'2026-09-19',asOfDate:'2026-09-25'});
  assert.equal(onTime.status,'completed_on_time');
  assert.equal(onTime.slippageDays,-1);
  const late=productionMilestoneStatus({plannedDate:'2026-09-20',actualDate:'2026-09-24',asOfDate:'2026-09-25'});
  assert.equal(late.status,'completed_late');
  assert.equal(late.slippageDays,4);
});

test('future dates cannot be recorded as completed actuals',()=>{
  const state=productionMilestoneStatus({plannedDate:'2026-09-20',actualDate:'2026-09-30',asOfDate:'2026-09-25'});
  assert.equal(state.status,'invalid_future_actual');
  const tracker=buildProductionMilestones({timeline:{productionComplete:'2026-09-20'},actuals:{productionCompleteDate:'2026-09-30'},asOfDate:'2026-09-25'});
  assert.equal(tracker.counts.invalidFutureActual,1);
  assert.equal(tracker.status,'needs_attention');
});

test('missing planned dates stay unscheduled instead of inventing deadlines',()=>{
  assert.equal(productionMilestoneStatus({asOfDate:'2026-09-15'}).status,'unscheduled');
  assert.equal(productionMilestoneStatus({actualDate:'2026-09-14',asOfDate:'2026-09-15'}).status,'completed_unscheduled');
});

test('production tracker summarizes modeled timeline and recorded actuals',()=>{
  const result=buildProductionMilestones({
    asOfDate:'2026-09-15',
    timeline:{depositDate:'2026-09-01',productionComplete:'2026-10-01',qcComplete:'2026-10-04',estimatedArrival:'2026-10-20',inventoryReady:'2026-10-23',targetLaunchDate:'2026-11-01'},
    actuals:{depositDate:'2026-09-01'}
  });
  assert.equal(result.counts.completed,1);
  assert.equal(result.counts.open,5);
  assert.equal(result.status,'active');
  assert.equal(result.nextMilestone.id,'production');
  assert.match(result.disclaimer,/does not infer why/i);
});

test('overdue modeled milestone moves tracker into needs-attention status',()=>{
  const result=buildProductionMilestones({
    asOfDate:'2026-10-10',
    timeline:{depositDate:'2026-09-01',productionComplete:'2026-10-01'},
    actuals:{depositDate:'2026-09-01'}
  });
  assert.equal(result.status,'needs_attention');
  assert.equal(result.counts.overdue,1);
});
