const KEY='msbo_brand_engine_anon_id';

function randomId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  return `be_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`;
}
export function brandEngineAnonymousId(){
  try{
    let value=localStorage.getItem(KEY);
    if(!value){value=randomId();localStorage.setItem(KEY,value)}
    return String(value).slice(0,80);
  }catch{return randomId().slice(0,80)}
}
export async function trackBrandEngine(eventName,properties={}){
  const safe=properties&&typeof properties==='object'&&!Array.isArray(properties)?properties:{};
  try{
    await fetch('/api/brand-engine/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_name:eventName,anonymous_id:brandEngineAnonymousId(),properties:safe}),keepalive:true});
  }catch{}
}
