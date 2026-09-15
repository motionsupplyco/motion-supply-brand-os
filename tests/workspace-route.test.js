import test from 'node:test';
import assert from 'node:assert/strict';
import {claimWorkspaceRoute,workspaceRouteToken,isWorkspaceRouteCurrent,workspaceRouteSnapshot,routeNameFromNavElement,workspaceRouteFromHeading} from '../public/workspace-route.js';

test('claiming a new workspace invalidates the previous workspace token',()=>{
  const first=claimWorkspaceRoute('v2:cashforecast');
  assert.equal(isWorkspaceRouteCurrent('v2:cashforecast',first),true);
  const second=claimWorkspaceRoute('production:preflight');
  assert.equal(isWorkspaceRouteCurrent('v2:cashforecast',first),false);
  assert.equal(isWorkspaceRouteCurrent('production:preflight',second),true);
  assert.ok(second>first);
});

test('workspace token is only returned for the current route',()=>{
  const token=claimWorkspaceRoute('factory:quotecompare');
  assert.equal(workspaceRouteToken('factory:quotecompare'),token);
  assert.equal(workspaceRouteToken('profit:profitguardrails'),null);
});

test('route naming covers every Brand OS navigation family',()=>{
  assert.equal(routeNameFromNavElement({dataset:{profitView:'profitguardrails'}}),'profit:profitguardrails');
  assert.equal(routeNameFromNavElement({dataset:{collectionView:'collectionstress'}}),'collection:collectionstress');
  assert.equal(routeNameFromNavElement({dataset:{productionView:'preflight'}}),'production:preflight');
  assert.equal(routeNameFromNavElement({dataset:{factoryView:'quotecompare'}}),'factory:quotecompare');
  assert.equal(routeNameFromNavElement({dataset:{v2View:'cashforecast'}}),'v2:cashforecast');
  assert.equal(routeNameFromNavElement({dataset:{view:'dashboard'}}),'core:dashboard');
  assert.equal(routeNameFromNavElement({id:'memoryNav',dataset:{}}),'core:memory');
});

test('V2 rendered headings map back to exact workspace routes for stale-render recovery',()=>{
  assert.equal(workspaceRouteFromHeading('13-Week Cash Forecast'),'v2:cashforecast');
  assert.equal(workspaceRouteFromHeading('Reorder Intelligence'),'v2:reorderintel');
  assert.equal(workspaceRouteFromHeading('Operating Alerts'),'v2:operatingalerts');
  assert.equal(workspaceRouteFromHeading('Integrations Center'),'v2:integrations');
  assert.equal(workspaceRouteFromHeading('Business Health'),null);
});

test('snapshot reports current route and generation',()=>{
  const token=claimWorkspaceRoute('v2:reorderintel');
  assert.deepEqual(workspaceRouteSnapshot(),{route:'v2:reorderintel',generation:token});
});
