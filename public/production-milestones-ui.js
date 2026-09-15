import {productionTimeline} from './production-timeline.js';
import {buildProductionMilestones} from './production-milestones.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>\'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const mode=()=>localStorage.getItem('msbo_mode')||'fresh';
const PREFLIGHT_KEY='msbo_production_preflight_v1';
const STORE_KEY='msbo_production_milestones_v1';
const DEMO_STORE_KEY='msbo_demo_production_milestones_v1';

function loadJson(key,fallback=null){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function saveJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
function storageKey(){return mode().startsWith('demo')?DEMO_STORE_KEY:STORE_KEY}
function todayIso(){const now=new Date();const yyyy=now.getFullYear(),mm=String(now.getMonth()+1).padStart(2,'0'),dd=String(now.getDate()).padStart(2,'0');return `${yyyy}-${mm}-${dd}`}
function contextKey(){
  if(mode().startsWith('demo'))return 'demo:foundry-eight';
  const preflight=loadJson(PREFLIGHT_KEY,{})||{};
  return [preflight.factoryName||'',preflight.styleName||'',preflight.quoteReference||''].join('|');
}
function loadActuals(){
  const stored=loadJson(storageKey(),null);
  if(!stored||stored.contextKey!==contextKey())return {};
  return stored.actuals&&typeof stored.actuals==='object'?stored.actuals:{};
}
function saveActuals(actuals){saveJson(storageKey(),{contextKey:contextKey(),actuals,updatedAt:new Date().toISOString()})}
function timelineInputFromDom(){
  const input={};
  $$('[data-timeline-key]').forEach(field=>{const key=field.dataset.timelineKey;input[key]=field.type==='date'?String(field.value||''):(field.value===''?null:Number(field.value))});
  return input;
}
function timelineFromCurrentPreflight(){return productionTimeline(timelineInputFromDom())}

const STATUS={
  unscheduled:{label:'UNSCHEDULED',tone:'neutral'},scheduled:{label:'SCHEDULED',tone:'neutral'},upcoming:{label:'UPCOMING',tone:'neutral'},due_soon:{label:'DUE SOON',tone:'warn'},overdue:{label:'MODELED DATE MISSED',tone:'bad'},completed_on_time:{label:'COMPLETE · ON/BEFORE PLAN',tone:'good'},completed_late:{label:'COMPLETE · AFTER PLAN',tone:'warn'},completed_unscheduled:{label:'COMPLETE · NO PLAN DATE',tone:'good'},invalid_future_actual:{label:'CHECK ACTUAL DATE',tone:'bad'}
};
function statusCopy(item){
  if(item.status==='overdue')return `${Math.abs(item.daysUntil)} day${Math.abs(item.daysUntil)===1?'':'s'} past the modeled date`;
  if(item.status==='due_soon')return item.daysUntil===0?'Modeled for today':`Modeled in ${item.daysUntil} day${item.daysUntil===1?'':'s'}`;
  if(item.status==='upcoming')return `Modeled in ${item.daysUntil} days`;
  if(item.status==='completed_late')return `${item.slippageDays} day${item.slippageDays===1?'':'s'} after the modeled date`;
  if(item.status==='completed_on_time')return item.slippageDays===0?'Recorded on the modeled date':`${Math.abs(item.slippageDays)} day${Math.abs(item.slippageDays)===1?'':'s'} before the modeled date`;
  if(item.status==='invalid_future_actual')return 'Actual completion cannot be in the future';
  if(item.status==='completed_unscheduled')return 'Recorded complete without a modeled date';
  if(item.status==='scheduled')return 'Modeled date set';
  return item.plannedDate?'Waiting for actual completion':'Add timeline dates above';
}
function actualKey(id){return ({po:'depositDate',production:'productionCompleteDate',qc:'qcCompleteDate',arrival:'arrivalDate',ready:'inventoryReadyDate',launch:'launchDate'})[id]}

function milestoneRow(item,today){
  const meta=STATUS[item.status]||STATUS.unscheduled;
  const key=actualKey(item.id);
  return `<div class="productionMilestoneRow" data-milestone-id="${item.id}">
    <div class="productionMilestoneIdentity"><b>${esc(item.label)}</b><small>${esc(statusCopy(item))}</small></div>
    <div class="productionMilestoneDate"><span>MODELED</span><b>${esc(item.plannedDate||'—')}</b></div>
    <label class="productionMilestoneActual"><span>ACTUAL</span><input data-milestone-actual="${key}" type="date" max="${today}" value="${esc(item.actualDate||'')}"></label>
    <div class="productionMilestoneState"><span class="v2Badge ${meta.tone}">${esc(meta.label)}</span></div>
  </div>`;
}

function renderTracker(){
  if(String($('#title')?.textContent||'').trim()!=='Production Preflight')return;
  const timelinePanel=$('#productionTimelinePanel');if(!timelinePanel)return;
  const actuals=loadActuals();const today=todayIso();const timeline=timelineFromCurrentPreflight();const result=buildProductionMilestones({timeline,actuals,asOfDate:today});
  let panel=$('#productionMilestonesPanel');
  if(!panel){panel=document.createElement('section');panel.id='productionMilestonesPanel';panel.className='productionMilestonesPanel';const cash=$('#manufacturingCashTiming');if(cash)cash.insertAdjacentElement('beforebegin',panel);else timelinePanel.insertAdjacentElement('afterend',panel)}
  const tone=result.status==='needs_attention'?'bad':result.status==='complete'?'good':'signal';
  const next=result.nextMilestone?`${result.nextMilestone.label} · ${result.nextMilestone.plannedDate}`:'No open modeled milestone';
  panel.innerHTML=`<div class="productionMilestoneHead"><div><span class="kicker">LIVE PRODUCTION TRACKER</span><h3>Record what actually happened against the modeled production path.</h3></div><span class="v2Badge ${tone}">${result.status==='needs_attention'?'NEEDS ATTENTION':result.status==='complete'?'TRACKED PLAN COMPLETE':result.status==='unscoped'?'TIMELINE NEEDED':'ACTIVE RUN'}</span></div>
    <p>Planned dates come from Production Timeline above. Actual dates are founder-recorded facts. Brand OS compares the two but does not assign blame for schedule movement.</p>
    <div class="productionMilestoneSummary"><div><small>OPEN MODELED</small><b>${result.counts.open}</b></div><div><small>OVERDUE</small><b class="${result.counts.overdue?'badText':''}">${result.counts.overdue}</b></div><div><small>COMPLETED</small><b>${result.counts.completed}</b></div><div><small>COMPLETED LATE</small><b>${result.counts.completedLate}</b></div><div><small>NEXT MODELED</small><b>${esc(next)}</b></div></div>
    <div class="productionMilestoneRows">${result.milestones.map(item=>milestoneRow(item,today)).join('')}</div>
    <div class="productionMilestoneFoot"><span>${esc(result.disclaimer)}</span><button class="outline" data-milestone-action="clear">Clear recorded actuals</button></div>`;
}

function collectActuals(){
  const actuals=loadActuals();
  $$('[data-milestone-actual]').forEach(input=>{const key=input.dataset.milestoneActual;if(input.value)actuals[key]=input.value;else delete actuals[key]});
  saveActuals(actuals);return actuals;
}
function flash(message,tone='neutral'){let el=$('#productionMilestoneFlash');if(!el){el=document.createElement('div');el.id='productionMilestoneFlash';el.className='v2Flash';document.body.appendChild(el)}el.className=`v2Flash ${tone} show`;el.textContent=message;clearTimeout(flash.timer);flash.timer=setTimeout(()=>el.classList.remove('show'),2400)}

document.addEventListener('change',event=>{
  if(event.target.matches('[data-milestone-actual]')){collectActuals();renderTracker();return}
  if(event.target.matches('[data-timeline-key]'))queueMicrotask(renderTracker);
});
document.addEventListener('click',event=>{
  const action=event.target.closest('[data-milestone-action]');if(!action)return;
  if(action.dataset.milestoneAction==='clear'){localStorage.removeItem(storageKey());renderTracker();flash('Recorded production actuals cleared.','neutral')}
});

const app=$('#app');if(app)new MutationObserver(()=>queueMicrotask(renderTracker)).observe(app,{childList:true,subtree:true});
queueMicrotask(renderTracker);
