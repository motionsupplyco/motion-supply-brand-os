import {productionTimeline} from './production-timeline.js';
import {buildProductionMilestones} from './production-milestones.js';
import {buildOperatingAlerts} from './operating-intelligence.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>\'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const mode=()=>localStorage.getItem('msbo_mode')||'fresh';
const PREFLIGHT_KEY='msbo_production_preflight_v1';
const TIMELINE_KEY='msbo_production_timeline_v1';
const DEMO_TIMELINE_KEY='msbo_demo_production_timeline_v1';
const MILESTONE_KEY='msbo_production_milestones_v1';
const DEMO_MILESTONE_KEY='msbo_demo_production_milestones_v1';

function loadJson(key,fallback=null){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function todayIso(){const now=new Date();const yyyy=now.getFullYear(),mm=String(now.getMonth()+1).padStart(2,'0'),dd=String(now.getDate()).padStart(2,'0');return `${yyyy}-${mm}-${dd}`}
function contextKey(preflight={}){
  if(mode().startsWith('demo'))return 'demo:foundry-eight';
  return [preflight.factoryName||'',preflight.styleName||'',preflight.quoteReference||''].join('|');
}
function timelineStorageKey(){return mode().startsWith('demo')?DEMO_TIMELINE_KEY:TIMELINE_KEY}
function milestoneStorageKey(){return mode().startsWith('demo')?DEMO_MILESTONE_KEY:MILESTONE_KEY}
function currentProductionContext(){const preflight=loadJson(PREFLIGHT_KEY,{})||{};return {preflight,key:contextKey(preflight)}}
function loadProductionAlertInputs(){
  const {key}=currentProductionContext();
  const storedTimeline=loadJson(timelineStorageKey(),null);
  if(!storedTimeline||storedTimeline.contextKey!==key)return null;
  const storedActuals=loadJson(milestoneStorageKey(),null);
  const actuals=storedActuals?.contextKey===key&&storedActuals.actuals&&typeof storedActuals.actuals==='object'?storedActuals.actuals:{};
  return {timeline:productionTimeline(storedTimeline),actuals};
}
function productionAlerts(){
  const input=loadProductionAlertInputs();if(!input)return [];
  const milestones=buildProductionMilestones({timeline:input.timeline,actuals:input.actuals,asOfDate:todayIso()});
  return buildOperatingAlerts({productionMilestones:milestones}).filter(alert=>alert.type==='production_milestone');
}
function alertCard(alert,index){
  return `<article class="v2Alert ${esc(alert.severity)}" data-production-operating-alert="${esc(alert.entityKey)}"><div class="v2AlertCode">P${String(index+1).padStart(2,'0')}</div><section><div class="v2AlertTop"><span class="v2Badge ${alert.severity==='critical'?'bad':'warn'}">${esc(alert.severity.toUpperCase())}</span><span>PRODUCTION MILESTONE</span></div><h3>${esc(alert.title)}</h3><p>${esc(alert.detail)}</p><div class="v2ProviderActions"><button class="outline" data-production-view="preflight">Open Production Preflight</button></div></section></article>`;
}
function summaryNumbers(summary){
  const values=[...summary.querySelectorAll(':scope > div > b')].map(node=>Number(node.textContent)||0);
  return {open:values[0]||0,critical:values[1]||0,warning:values[2]||0};
}
function updateSummary(summary,alerts){
  if(!summary.dataset.productionBase){summary.dataset.productionBase=JSON.stringify(summaryNumbers(summary))}
  let base={open:0,critical:0,warning:0};try{base=JSON.parse(summary.dataset.productionBase)||base}catch{}
  const values=[...summary.querySelectorAll(':scope > div > b')];
  if(values[0])values[0].textContent=String(base.open+alerts.length);
  if(values[1])values[1].textContent=String(base.critical+alerts.filter(alert=>alert.severity==='critical').length);
  if(values[2])values[2].textContent=String(base.warning+alerts.filter(alert=>alert.severity==='warning').length);
}
function enhanceOperatingAlerts(){
  if(String($('#title')?.textContent||'').trim()!=='Operating Alerts')return;
  const stack=$('.v2AlertStack'),summary=$('.v2AlertSummary');if(!stack||!summary)return;
  const alerts=productionAlerts();
  const signature=JSON.stringify(alerts.map(alert=>[alert.entityKey,alert.severity,alert.title,alert.detail]));
  if(stack.dataset.productionAlertSignature===signature)return;
  stack.dataset.productionAlertSignature=signature;
  stack.querySelectorAll('[data-production-operating-alert]').forEach(node=>node.remove());
  const empty=stack.querySelector('.v2Empty');if(empty)empty.style.display=alerts.length?'none':'';
  if(alerts.length)stack.insertAdjacentHTML('afterbegin',alerts.map(alertCard).join(''));
  updateSummary(summary,alerts);
}

const app=$('#app');if(app)new MutationObserver(()=>queueMicrotask(enhanceOperatingAlerts)).observe(app,{childList:true,subtree:true});
window.addEventListener('storage',event=>{if([TIMELINE_KEY,DEMO_TIMELINE_KEY,MILESTONE_KEY,DEMO_MILESTONE_KEY,PREFLIGHT_KEY].includes(event.key))queueMicrotask(enhanceOperatingAlerts)});
queueMicrotask(enhanceOperatingAlerts);
