let generation=0;
let currentRoute='core:dashboard';

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

if(typeof document!=='undefined'){
  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-profit-view],[data-collection-view],[data-production-view],[data-factory-view],[data-v2-view],#nav button[data-view],#memoryNav');
    const route=routeNameFromNavElement(target);
    if(route)claimWorkspaceRoute(route);
  },true);
}
