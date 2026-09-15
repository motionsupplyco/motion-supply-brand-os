let generation=0;
let currentRoute='core:dashboard';
let reconcileScheduled=false;

const NAV_TARGET_SELECTOR='[data-profit-view],[data-collection-view],[data-production-view],[data-factory-view],[data-v2-view],#nav button[data-view],#memoryNav';

export function claimWorkspaceRoute(route){
  currentRoute=String(route||'').trim()||'unknown';
  generation+=1;
  return generation;
}

export function workspaceRouteToken(route){
  return currentRoute===String(route||'')?generation:null;
}

export function isWorkspaceRouteCurrent(route,token){
  return currentRoute===String(route||'')&&generation===Number(token);
}

export function workspaceRouteSnapshot(){return {route:currentRoute,generation}}

export function routeNameFromNavElement(element){
  if(!element)return null;
  if(element.dataset?.profitView)return `profit:${element.dataset.profitView}`;
  if(element.dataset?.collectionView)return `collection:${element.dataset.collectionView}`;
  if(element.dataset?.productionView)return `production:${element.dataset.productionView}`;
  if(element.dataset?.factoryView)return `factory:${element.dataset.factoryView}`;
  if(element.dataset?.v2View)return `v2:${element.dataset.v2View}`;
  if(element.id==='memoryNav')return 'core:memory';
  if(element.dataset?.view)return `core:${element.dataset.view}`;
  return null;
}

export function workspaceRouteFromHeading(value){
  const heading=String(value||'').trim();
  return ({
    '13-Week Cash Forecast':'v2:cashforecast',
    'Reorder Intelligence':'v2:reorderintel',
    'Operating Alerts':'v2:operatingalerts',
    'Integrations Center':'v2:integrations'
  })[heading]||null;
}

function renderedWorkspaceRoute(root){
  if(!root)return null;
  if(root.querySelector('[data-profit-action],.profitHero,.profitPanel,.profitResults'))return 'profit:profitguardrails';
  if(root.querySelector('[data-stress-action],.stressPanel,.stressResult,.stressEmpty'))return 'collection:collectionstress';
  if(root.querySelector('[data-preflight-action],.preflightHero,.preflightPanel,.preflightResult'))return 'production:preflight';
  if(root.querySelector('[data-quote-action],.quoteHero,.quoteSetup,.quoteCompare'))return 'factory:quotecompare';
  return workspaceRouteFromHeading(root.querySelector('.v2Hero h2')?.textContent);
}

function navSelectorForRoute(route){
  const [family,...rest]=String(route||'').split(':');
  const value=rest.join(':');
  if(family==='profit')return `[data-profit-view="${CSS.escape(value)}"]`;
  if(family==='collection')return `[data-collection-view="${CSS.escape(value)}"]`;
  if(family==='production')return `[data-production-view="${CSS.escape(value)}"]`;
  if(family==='factory')return `[data-factory-view="${CSS.escape(value)}"]`;
  if(family==='v2')return `[data-v2-view="${CSS.escape(value)}"]`;
  if(route==='core:memory')return '#memoryNav';
  if(family==='core')return `#nav button[data-view="${CSS.escape(value)}"]`;
  return null;
}

function scheduleRouteReconcile(renderedRoute){
  if(!renderedRoute||renderedRoute===currentRoute||reconcileScheduled)return;
  const expectedRoute=currentRoute;
  const expectedGeneration=generation;
  reconcileScheduled=true;
  queueMicrotask(()=>{
    reconcileScheduled=false;
    if(currentRoute!==expectedRoute||generation!==expectedGeneration)return;
    const selector=navSelectorForRoute(expectedRoute);
    const target=selector?document.querySelector(selector):null;
    if(target)target.click();
  });
}

if(typeof document!=='undefined'){
  document.addEventListener('click',event=>{
    const target=event.target?.closest?.(NAV_TARGET_SELECTOR);
    const route=routeNameFromNavElement(target);
    if(route)claimWorkspaceRoute(route);
  },true);

  const attachObserver=()=>{
    const app=document.querySelector('#app');
    if(!app)return false;
    new MutationObserver(()=>scheduleRouteReconcile(renderedWorkspaceRoute(app))).observe(app,{childList:true,subtree:true});
    return true;
  };
  if(!attachObserver())document.addEventListener('DOMContentLoaded',attachObserver,{once:true});
}
