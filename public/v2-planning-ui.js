import {cashForecast,reorderIntelligence,reorderCashGate} from './operating-intelligence.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>\'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(num(value));
const money2=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(num(value));
const mode=()=>localStorage.getItem('msbo_mode')||'fresh';
const loadSession=()=>{try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}};

const state={brandId:'',items:[],forecastHeadroom:null,cloudReady:true,hydrating:false,token:0};
let observer=null,timer=null;

function setSession(session){if(session)localStorage.setItem('msbo_session',JSON.stringify(session));else localStorage.removeItem('msbo_session')}
async function api(url,{method='GET',body=null}={}){
  let session=loadSession();
  const headers={'Content-Type':'application/json'};
  if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  let response=await fetch(url,{method,headers,body:body===null?undefined:JSON.stringify(body)});
  if(response.status===401&&session?.refresh_token){
    const refreshed=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    if(refreshed.ok){const payload=await refreshed.json();session=payload.session;setSession(session);headers.Authorization=`Bearer ${session.access_token}`;response=await fetch(url,{method,headers,body:body===null?undefined:JSON.stringify(body)})}
  }
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.error||`Request failed (${response.status})`);error.status=response.status;error.code=payload.code||null;throw error}
  return payload;
}

const badge=(text,tone='neutral')=>`<span class="v2Badge ${tone}">${esc(text)}</span>`;
function currentBrandId(){return String($('#reorderBrand')?.value||'').trim()}
function isReorderView(){return $('#title')?.textContent.trim()==='Reorder Intelligence'&&Boolean($('#app'))}
function planningSetting(settings,{itemKey,externalVariantId,skuId,sku}){
  return settings.find(row=>row.item_key===itemKey)
    ||settings.find(row=>externalVariantId&&row.external_variant_id===externalVariantId)
    ||settings.find(row=>skuId&&row.sku_id===skuId)
    ||settings.find(row=>sku&&String(row.sku_code||'').toLowerCase()===String(sku).toLowerCase())
    ||null;
}
function forecastHeadroom(forecasts){
  const forecast=forecasts?.[0];
  if(!forecast)return null;
  const analysis=cashForecast({startingCash:num(forecast.starting_cash),protectedFloor:num(forecast.protected_floor),weeks:forecast.weeks||[]});
  return analysis.minimumHeadroom;
}
function planningValues(setting={},fallback={}){
  return {
    weeklyDemand:setting.manual_weekly_demand??fallback.weeklyDemand??0,
    highWeeklyDemand:setting.high_weekly_demand??'',
    leadWeeks:setting.lead_weeks??'',
    moq:setting.moq??0,
    depositPct:setting.deposit_pct??100,
    landedCost:setting.landed_cost??fallback.landedCost??'',
    supplierNotes:setting.supplier_notes??''
  };
}

async function loadBrandPlanning(brandId,token){
  state.cloudReady=true;
  const skusPromise=api('/api/skus').catch(()=>({skus:[]}));
  const operatingPromise=api(`/api/v2/operating-data?brand_id=${encodeURIComponent(brandId)}`).catch(error=>{
    if(error.code==='V2_STORAGE_NOT_READY')return {inventory:[]};
    throw error;
  });
  const forecastPromise=api(`/api/v2/cash-forecasts?brand_id=${encodeURIComponent(brandId)}`).catch(error=>{
    if(error.code==='V2_STORAGE_NOT_READY')return {forecasts:[]};
    throw error;
  });
  const planningPromise=api(`/api/v2/sku-planning?brand_id=${encodeURIComponent(brandId)}`).catch(error=>{
    if(error.code==='V2_STORAGE_NOT_READY'){state.cloudReady=false;return {settings:[]}}
    throw error;
  });
  const [skuData,operatingData,forecastData,planningData]=await Promise.all([skusPromise,operatingPromise,forecastPromise,planningPromise]);
  if(token!==state.token)return null;
  const savedSkus=(skuData.skus||[]).filter(row=>String(row.brand_id)===String(brandId));
  const inventory=operatingData.inventory||[];
  const settings=planningData.settings||[];
  const skuByCode=new Map(savedSkus.map(row=>[String(row.sku||'').toLowerCase(),row]));
  const observedSkuCodes=new Set(inventory.map(row=>String(row.sku_code||'').toLowerCase()).filter(Boolean));
  const shopifyItems=inventory.map(row=>{
    const externalVariantId=String(row.external_variant_id||'').trim();
    const itemKey=`shopify:${externalVariantId||row.sku_code||row.id}`;
    const internalSku=skuByCode.get(String(row.sku_code||'').toLowerCase())||null;
    const setting=planningSetting(settings,{itemKey,externalVariantId,skuId:internalSku?.id,sku:row.sku_code});
    const values=planningValues(setting,{landedCost:internalSku?.landed_cost});
    return {
      itemKey,source:'shopify',externalVariantId,skuId:internalSku?.id||null,
      sku:row.sku_code||'NO-SKU',label:row.product_name||row.sku_code||'Shopify variant',
      onHand:num(row.on_hand),incoming:num(row.incoming),allocated:num(row.committed),weeklyDemand:num(row.weekly_velocity),
      ...values,weeklyDemand:num(row.weekly_velocity),settingId:setting?.id||null,capturedAt:row.captured_at||null
    };
  });
  const manualItems=savedSkus.filter(row=>!observedSkuCodes.has(String(row.sku||'').toLowerCase())).map(row=>{
    const itemKey=`manual:${row.id}`;
    const setting=planningSetting(settings,{itemKey,skuId:row.id,sku:row.sku});
    const values=planningValues(setting,{landedCost:row.landed_cost});
    return {
      itemKey,source:'manual',externalVariantId:null,skuId:row.id,sku:row.sku||'NO-SKU',label:row.name||row.sku||'Saved SKU',
      onHand:num(row.on_hand),incoming:0,allocated:0,...values,settingId:setting?.id||null
    };
  });
  return {items:[...shopifyItems,...manualItems],forecastHeadroom:forecastHeadroom(forecastData.forecasts||[]),shopifyCount:shopifyItems.length,manualCount:manualItems.length,savedCount:settings.length};
}

function readItemFromCard(item,card){
  const next={...item};
  card.querySelectorAll('[data-plan-field]').forEach(input=>{
    const key=input.dataset.planField;
    if(key==='supplierNotes')next[key]=String(input.value||'').slice(0,2000);
    else next[key]=input.value===''?'':Math.max(0,num(input.value));
  });
  if(next.depositPct!=='')next.depositPct=Math.min(100,num(next.depositPct));
  return next;
}
function modelItem(item){
  return reorderIntelligence({
    weeklyDemand:num(item.weeklyDemand),highWeeklyDemand:item.highWeeklyDemand===''?num(item.weeklyDemand):num(item.highWeeklyDemand),
    leadWeeks:num(item.leadWeeks),onHand:num(item.onHand),inbound:num(item.incoming),allocated:num(item.allocated),
    landedCost:num(item.landedCost),moq:num(item.moq)
  });
}
function cardMarkup(item,index){
  const result=modelItem(item);
  const headroom=state.forecastHeadroom;
  const cashGate=headroom===null?null:reorderCashGate(result,{forecastHeadroom:headroom,depositPct:num(item.depositPct)});
  const severity=result.severity==='critical'?'bad':result.reviewTriggered?'warn':'good';
  const status=!num(item.weeklyDemand)?'NEEDS VELOCITY':!num(item.leadWeeks)?'ADD LEAD TIME':result.severity==='critical'?'URGENT REVIEW':result.reviewTriggered?'REVIEW':'HEALTHY';
  const sourceLabel=item.source==='shopify'?'SHOPIFY OBSERVATION':'SAVED SKU · MANUAL PLAN';
  const velocityField=item.source==='manual'?`<label><span>Weekly demand · manual</span><input type="number" min="0" step=".1" data-plan-field="weeklyDemand" value="${esc(item.weeklyDemand)}"></label>`:'';
  const cashCopy=result.reviewTriggered&&num(item.landedCost)
    ?(cashGate?`At ${num(item.depositPct)}% deposit, modeled cash due now is ${money2(cashGate.cashDueNow)} and leaves ${money2(cashGate.remainingHeadroom)} against the forecast's lowest headroom.`:'Save a 13-week cash forecast to cash-gate this reorder review.')
    :'Add landed cost and demand assumptions to evaluate cash pressure.';
  return `<article class="v2ReorderCard v2PlanningCard" data-plan-index="${index}">
    <div class="v2ReorderTop"><div><span class="kicker">${sourceLabel} · ${esc(item.sku)}</span><h3>${esc(item.label)}</h3></div>${badge(status,severity)}</div>
    <div class="v2ReorderMetrics">
      <div><small>AVAILABLE / ON HAND</small><b>${Math.max(0,Math.round(num(item.onHand)-num(item.allocated)))} / ${Math.round(num(item.onHand))}</b></div>
      <div><small>WEEKLY VELOCITY</small><b>${num(item.weeklyDemand).toFixed(1)}</b></div>
      <div><small>WEEKS COVER</small><b>${Number.isFinite(result.onHandWeeksCover)?result.onHandWeeksCover.toFixed(1):'—'}</b></div>
      <div><small>REORDER POINT</small><b>${num(item.leadWeeks)?Math.ceil(result.reorderPoint):'—'}</b></div>
      <div><small>REVIEW QTY</small><b>${result.reviewTriggered?result.reviewQuantity:'—'}</b></div>
      <div><small>CASH TO REVIEW</small><b>${result.reviewTriggered&&num(item.landedCost)?money(result.reviewCashRequired):'—'}</b></div>
    </div>
    <div class="v2PlanningSourceNote">${item.source==='shopify'?'Velocity and inventory come from Shopify. Supplier terms below stay founder-controlled and are never written back to Shopify.':'This SKU is not currently matched to a Shopify observation. Weekly demand is a founder-entered planning assumption.'}</div>
    <div class="v2ReorderInputs v2PlanningInputs">
      ${velocityField}
      <label><span>Supplier lead time · weeks</span><input type="number" min="0" step=".1" data-plan-field="leadWeeks" value="${esc(item.leadWeeks)}"></label>
      <label><span>High-week demand</span><input type="number" min="0" step=".1" data-plan-field="highWeeklyDemand" placeholder="${num(item.weeklyDemand).toFixed(1)}" value="${esc(item.highWeeklyDemand)}"></label>
      <label><span>MOQ</span><input type="number" min="0" step="1" data-plan-field="moq" value="${num(item.moq)}"></label>
      <label><span>Landed cost / unit</span><input type="number" min="0" step=".01" data-plan-field="landedCost" value="${esc(item.landedCost)}"></label>
      <label><span>Deposit %</span><input type="number" min="0" max="100" step="1" data-plan-field="depositPct" value="${num(item.depositPct)}"></label>
      <label class="v2PlanningNotes"><span>Supplier notes</span><input type="text" maxlength="2000" data-plan-field="supplierNotes" placeholder="Payment terms, production caveats, freight notes…" value="${esc(item.supplierNotes)}"></label>
    </div>
    <div class="v2PlanningActions">
      <button class="outline" data-plan-action="recalculate" data-plan-index="${index}">Recalculate</button>
      <button class="primary" data-plan-action="save" data-plan-index="${index}" ${state.cloudReady?'':'disabled'}>${state.cloudReady?(item.settingId?'Update saved plan':'Save planning'):'Cloud save pending migration'}</button>
    </div>
    ${result.reviewTriggered?`<div class="v2ReorderDecision ${cashGate&&!cashGate.passes?'bad':'warn'}"><b>${cashGate&&!cashGate.passes?'CASH GATE FAILS':'REORDER NEEDS REVIEW'}</b><p>${esc(result.note)} ${esc(cashCopy)}</p></div>`:''}
  </article>`;
}
function renderWorkspace(meta={}){
  if(!isReorderView())return;
  const app=$('#app');if(!app)return;
  let stack=app.querySelector('.v2ReorderStack');
  if(!stack){
    stack=document.createElement('div');stack.className='v2ReorderStack';
    app.appendChild(stack);
  }
  const existingNote=app.querySelector('#v2PlanningSummary');existingNote?.remove();
  const summary=document.createElement('div');summary.id='v2PlanningSummary';summary.className='v2PlanningSummary';
  const headroom=state.forecastHeadroom;
  summary.innerHTML=`<div><span class="kicker">FOUNDER PLANNING LAYER</span><b>${state.items.length} SKU${state.items.length===1?'':'s'} ready for review</b><p>Shopify supplies observations. Your supplier terms and manual demand assumptions stay separate and saved to Brand OS.</p></div><div class="v2PlanningSummaryBadges">${badge(`${meta.shopifyCount||0} SHOPIFY`,'signal')}${badge(`${meta.manualCount||0} MANUAL`,'neutral')}${headroom===null?badge('NO SAVED CASH FORECAST','warn'):badge(`LOWEST HEADROOM ${money(headroom)}`,headroom<0?'bad':'good')}</div>`;
  stack.insertAdjacentElement('beforebegin',summary);
  if(!state.cloudReady){
    const warning=document.createElement('div');warning.className='v2PlanningMigrationNote';warning.textContent='Planning calculations work in this preview, but cloud saving stays disabled until the additive V2 planning migration is applied.';summary.insertAdjacentElement('afterend',warning);
  }
  stack.dataset.planningHydrated='true';
  stack.innerHTML=state.items.length?state.items.map(cardMarkup).join(''):`<div class="v2Empty"><div class="v2EmptyIcon">◇</div><h3>No SKUs to plan yet</h3><p>Add a saved SKU under Brands & SKUs or connect Shopify. Reorder Intelligence will keep synced observations separate from founder planning assumptions.</p><button class="primary" data-plan-action="brands">Open Brands & SKUs</button></div>`;
}

async function hydrate(){
  if(state.hydrating||!isReorderView()||mode().startsWith('demo'))return;
  if($('.v2ReorderStack[data-planning-hydrated="true"]'))return;
  const brandId=currentBrandId();if(!brandId)return;
  state.hydrating=true;state.brandId=brandId;const token=++state.token;
  try{
    const loaded=await loadBrandPlanning(brandId,token);if(!loaded||token!==state.token)return;
    state.items=loaded.items;state.forecastHeadroom=loaded.forecastHeadroom;renderWorkspace(loaded);
  }catch(error){
    const app=$('#app');
    if(app&&isReorderView()){
      const note=document.createElement('div');note.className='v2PlanningMigrationNote bad';note.textContent=`Saved SKU planning could not load: ${error.message}`;app.appendChild(note);
    }
  }finally{state.hydrating=false}
}
function scheduleHydrate(){clearTimeout(timer);timer=setTimeout(hydrate,80)}

async function saveItem(index,card){
  if(!state.cloudReady)return;
  const item=state.items[index];if(!item)return;
  const next=readItemFromCard(item,card);state.items[index]=next;renderWorkspace({shopifyCount:state.items.filter(x=>x.source==='shopify').length,manualCount:state.items.filter(x=>x.source==='manual').length});
  const payload={
    brand_id:state.brandId,item_key:next.itemKey,source:next.source,sku_id:next.skuId||null,external_variant_id:next.externalVariantId||null,
    sku_code:next.sku,label:next.label,manual_weekly_demand:next.source==='manual'?num(next.weeklyDemand):null,
    high_weekly_demand:next.highWeeklyDemand===''?null:num(next.highWeeklyDemand),lead_weeks:num(next.leadWeeks),moq:num(next.moq),
    deposit_pct:num(next.depositPct),landed_cost:next.landedCost===''?null:num(next.landedCost),supplier_notes:next.supplierNotes||null,active:true
  };
  try{
    const result=await api('/api/v2/sku-planning',{method:'POST',body:payload});
    state.items[index]={...next,settingId:result.setting?.id||next.settingId};
    renderWorkspace({shopifyCount:state.items.filter(x=>x.source==='shopify').length,manualCount:state.items.filter(x=>x.source==='manual').length});
    flash('SKU planning saved ✓','good');
  }catch(error){flash(error.message,'bad')}
}
function recalcItem(index,card){
  const item=state.items[index];if(!item)return;
  state.items[index]=readItemFromCard(item,card);
  renderWorkspace({shopifyCount:state.items.filter(x=>x.source==='shopify').length,manualCount:state.items.filter(x=>x.source==='manual').length});
}
function flash(message,tone='neutral'){
  let el=$('#v2PlanningFlash');if(!el){el=document.createElement('div');el.id='v2PlanningFlash';el.className='v2Flash';document.body.appendChild(el)}
  el.className=`v2Flash ${tone} show`;el.textContent=message;clearTimeout(flash.timer);flash.timer=setTimeout(()=>el.classList.remove('show'),3200);
}

document.addEventListener('click',event=>{
  const action=event.target.closest('[data-plan-action]');if(!action)return;
  const type=action.dataset.planAction;
  if(type==='brands'){document.querySelector('#nav button[data-view="brands"]')?.click();return}
  const card=action.closest('[data-plan-index]'),index=Number(action.dataset.planIndex);if(!card||!Number.isInteger(index))return;
  if(type==='recalculate'){event.preventDefault();recalcItem(index,card)}
  if(type==='save'){event.preventDefault();saveItem(index,card)}
});

document.addEventListener('change',event=>{if(event.target.id==='reorderBrand'){state.token++;state.items=[];state.forecastHeadroom=null;scheduleHydrate()}});

function start(){
  const app=$('#app');if(!app)return;
  observer=new MutationObserver(()=>{if(isReorderView()&&!$('.v2ReorderStack[data-planning-hydrated="true"]'))scheduleHydrate()});
  observer.observe(app,{childList:true,subtree:true});
  scheduleHydrate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
