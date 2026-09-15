import {productionPreflight,PRODUCTION_PREFLIGHT_CHECKS} from './production-preflight.js';
import {MANUFACTURING_CASH_TRANSFER_KEY,buildManufacturingCashTransfer,applyManufacturingCashTransfer} from './manufacturing-cash-transfer.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>\'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(num(value));
const mode=()=>localStorage.getItem('msbo_mode')||'fresh';
const PREFLIGHT_KEY='msbo_production_preflight_v1';
const TIMING_KEY='msbo_production_cash_timing_v1';

function loadJson(key,fallback=null){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function saveJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
function blankChecks(){return Object.fromEntries(PRODUCTION_PREFLIGHT_CHECKS.map(check=>[check.id,'missing']))}
function flash(message,tone='neutral'){
  let el=$('#manufacturingHandoffFlash');
  if(!el){el=document.createElement('div');el.id='manufacturingHandoffFlash';el.className='v2Flash';document.body.appendChild(el)}
  el.className=`v2Flash ${tone} show`;el.textContent=message;clearTimeout(flash.timer);flash.timer=setTimeout(()=>el.classList.remove('show'),3000);
}
function currentTitle(){return String($('#title')?.textContent||'').trim()}

function quoteFromDom(index){
  const quote={};
  $$(`[data-quote-index="${index}"][data-quote-key]`).forEach(input=>{quote[input.dataset.quoteKey]=input.value===''?null:num(input.value)});
  $$(`[data-quote-index="${index}"][data-quote-text]`).forEach(input=>{quote[input.dataset.quoteText]=String(input.value||'').trim()});
  quote.notes=String($(`[data-quote-notes="${index}"]`)?.value||'').trim();
  return quote;
}
function moveQuoteToPreflight(index){
  if(mode().startsWith('demo'))return flash('Example quotes stay in demo mode. Switch to your own brand data before moving a quote into Preflight.','warn');
  const quote=quoteFromDom(index);
  if(!quote.name)return flash('Add a factory / supplier name first.','bad');
  const model={
    factoryName:quote.name,
    styleName:String($('#quoteStyleName')?.value||'').trim(),
    quoteReference:'Imported from Factory Quote Compare',
    checks:blankChecks(),
    orderQty:quote.orderQty??null,
    factoryUnitCost:quote.factoryUnitCost??null,
    depositPct:quote.depositPct??null,
    sampleCost:quote.sampleCost??null,
    toolingCost:quote.toolingCost??null,
    inspectionCost:quote.inspectionCost??null,
    freightEstimate:quote.freightEstimate??null,
    dutyEstimate:quote.dutyEstimate??null,
    otherProductionCost:quote.otherProductionCost??null,
    sampleLeadDays:quote.sampleLeadDays??null,
    productionLeadDays:quote.productionLeadDays??null,
    notes:[quote.notes,'Imported from Factory Quote Compare. All Production Preflight readiness checks were reset and must be reviewed again.'].filter(Boolean).join('\n\n')
  };
  saveJson(PREFLIGHT_KEY,model);
  localStorage.removeItem(TIMING_KEY);
  flash('Quote moved to Production Preflight. Readiness checks reset ✓','good');
  document.querySelector('[data-production-view="preflight"]')?.click();
}
function enhanceQuoteCompare(){
  const table=$('.quoteTable');if(!table||table.dataset.handoffReady==='1')return;
  table.dataset.handoffReady='1';
  const tbody=table.querySelector('tbody');if(!tbody)return;
  const headers=[...table.querySelectorAll('thead th')].slice(1);
  if(!headers.length)return;
  const row=document.createElement('tr');row.className='quoteHandoffRow';row.dataset.handoffRow='1';
  row.innerHTML=`<td>Production workflow</td>${headers.map((_,index)=>`<td><button class="outline quoteHandoffBtn" data-handoff-quote="${index}" ${mode().startsWith('demo')?'disabled':''}>Use in Preflight</button><small>Resets every readiness check</small></td>`).join('')}`;
  tbody.appendChild(row);
}

function loadTiming(){return {...{depositWeek:null,balanceWeek:null,freightDutyWeek:null,inspectionOtherWeek:null},...(loadJson(TIMING_KEY,{})||{})}}
function saveTimingFromDom(){
  const timing=loadTiming();
  $$('[data-manufacturing-week]').forEach(input=>{timing[input.dataset.manufacturingWeek]=input.value===''?null:Math.trunc(num(input.value))});
  saveJson(TIMING_KEY,timing);return timing;
}
function preflightTransfer(){
  const model=loadJson(PREFLIGHT_KEY,{});const result=productionPreflight(model);const commitment=result.commitment;const timing=saveTimingFromDom();
  return buildManufacturingCashTransfer({
    source:'production-preflight',factoryName:model.factoryName,styleName:model.styleName,quoteReference:model.quoteReference,createdAt:new Date().toISOString(),
    deposit:commitment.deposit,balance:commitment.balance,freightEstimate:commitment.freightEstimate,dutyEstimate:commitment.dutyEstimate,
    inspectionCost:commitment.inspectionCost,otherProductionCost:commitment.otherProductionCost,
    freightKnown:commitment.coverage.freightEstimate,dutyKnown:commitment.coverage.dutyEstimate,inspectionKnown:commitment.coverage.inspectionCost,
    ...timing
  });
}
function prepareCashForecast(){
  if(mode().startsWith('demo'))return flash('Demo cash stays isolated. Switch to your own data before preparing a manufacturing cash handoff.','warn');
  const model=loadJson(PREFLIGHT_KEY,{});const result=productionPreflight(model);
  if(!result.commitment.coreCommercialInputsReady)return flash('Lock production quantity, factory unit cost and deposit terms first.','bad');
  const transfer=preflightTransfer();
  if(transfer.missingTiming.length)return flash(`Choose a forecast week for: ${transfer.missingTiming.join(', ')}.`,'bad');
  if(!transfer.valid)return flash('There is no production cash ready to move into the forecast yet.','bad');
  saveJson(MANUFACTURING_CASH_TRANSFER_KEY,transfer);
  flash(`Manufacturing cash prepared: ${money(transfer.total)} across ${transfer.lines.length} line items. Review it in Cash Forecast.`,'good');
  document.querySelector('[data-v2-view="cashforecast"]')?.click();
}
function enhancePreflight(){
  const result=$('.preflightResult');if(!result||$('#manufacturingCashTiming'))return;
  const timing=loadTiming();
  const section=document.createElement('section');section.id='manufacturingCashTiming';section.className='manufacturingCashPanel';
  section.innerHTML=`<div class="manufacturingCashHead"><div><span class="kicker">05 · CASH FORECAST HANDOFF</span><h3>Put the unpaid production commitment on the 13-week cash map</h3></div><span class="v2Badge signal">REVIEW BEFORE APPLY</span></div>
    <p>Choose when each known cash item is expected to leave. Brand OS will prepare a transfer for Cash Forecast—it will not change the forecast until you press Apply there.</p>
    <div class="manufacturingWeekGrid">
      ${weekField('depositWeek','Deposit week',timing.depositWeek)}${weekField('balanceWeek','Factory balance week',timing.balanceWeek)}${weekField('freightDutyWeek','Freight / duty week',timing.freightDutyWeek)}${weekField('inspectionOtherWeek','Inspection / other week',timing.inspectionOtherWeek)}
    </div>
    <div class="manufacturingCashActions"><button class="primary" data-manufacturing-action="prepare">Prepare for Cash Forecast</button><span>Sample + tooling are left manual because Preflight allows those costs to be already paid.</span></div>`;
  result.insertAdjacentElement('afterend',section);
}
function weekField(key,label,value){return `<label><span>${esc(label)}</span><input data-manufacturing-week="${key}" type="number" min="1" max="13" step="1" value="${value??''}" placeholder="1–13"></label>`}

function loadPending(){const pending=loadJson(MANUFACTURING_CASH_TRANSFER_KEY,null);return pending&&pending.valid===true?pending:null}
function forecastFromDom(){
  const weeks=Array.from({length:13},(_,index)=>({label:`Week ${index+1}`}));
  $$('[data-forecast-week][data-forecast-key]').forEach(input=>{const index=Number(input.dataset.forecastWeek),key=input.dataset.forecastKey;if(index>=0&&index<13)weeks[index][key]=Math.max(0,num(input.value))});
  return {name:String($('#v2ForecastName')?.value||'13-week cash forecast'),starting_cash:num($('#v2StartingCash')?.value),protected_floor:num($('#v2ProtectedFloor')?.value),weeks};
}
function transferLineLabel(line){return `W${String(line.week).padStart(2,'0')} · ${line.label} · ${money(line.amount)}`}
function enhanceCashForecast(){
  const toolbar=$('.v2Toolbar');if(!toolbar||$('#manufacturingCashPending'))return;
  const transfer=loadPending();if(!transfer)return;
  const panel=document.createElement('section');panel.id='manufacturingCashPending';panel.className='manufacturingCashPanel pending';
  panel.innerHTML=`<div class="manufacturingCashHead"><div><span class="kicker">PENDING MANUFACTURING CASH</span><h3>${esc(transfer.styleName||'Production commitment')}</h3></div><span class="v2Badge warn">NOT APPLIED</span></div>
    <p>${esc(transfer.factoryName||'Factory')} · ${money(transfer.total)} modeled cash. Applying this <b>adds</b> the amounts below to the current forecast values; it does not replace them.</p>
    <div class="manufacturingLineList">${(transfer.lines||[]).map(line=>`<div><span>${esc(transferLineLabel(line))}</span><small>${esc(line.category)}</small></div>`).join('')}</div>
    ${transfer.unknownEstimates?.length?`<div class="manufacturingUnknown"><b>Still unknown:</b> ${esc(transfer.unknownEstimates.join(', '))}. Those estimates are not included.</div>`:''}
    <div class="manufacturingCashActions"><button class="primary" data-manufacturing-action="apply">Apply to this forecast</button><button class="outline" data-manufacturing-action="discard">Discard transfer</button><span>${esc(transfer.note||'')}</span></div>`;
  toolbar.insertAdjacentElement('afterend',panel);
}
function applyPending(){
  const transfer=loadPending();if(!transfer)return flash('No pending manufacturing cash transfer found.','warn');
  try{
    const current=forecastFromDom();const result=applyManufacturingCashTransfer(current,transfer);
    for(const line of result.appliedLines){
      const input=document.querySelector(`[data-forecast-week="${line.week-1}"][data-forecast-key="${line.category}"]`);
      if(input)input.value=String(num(result.forecast.weeks[line.week-1][line.category]));
    }
    localStorage.removeItem(MANUFACTURING_CASH_TRANSFER_KEY);
    document.querySelector('[data-v2-action="forecast-recalc"]')?.click();
    flash(`${money(result.appliedTotal)} added to the 13-week forecast ✓`,'good');
  }catch(error){flash(error.message,'bad')}
}
function discardPending(){localStorage.removeItem(MANUFACTURING_CASH_TRANSFER_KEY);$('#manufacturingCashPending')?.remove();flash('Pending manufacturing cash transfer discarded.','neutral')}

function enhance(){
  const title=currentTitle();
  if(title==='Factory Quote Compare')enhanceQuoteCompare();
  if(title==='Production Preflight')enhancePreflight();
  if(title==='Cash Forecast')enhanceCashForecast();
}

document.addEventListener('click',event=>{
  const quote=event.target.closest('[data-handoff-quote]');if(quote){event.preventDefault();moveQuoteToPreflight(Number(quote.dataset.handoffQuote));return}
  const action=event.target.closest('[data-manufacturing-action]');if(!action)return;
  if(action.dataset.manufacturingAction==='prepare'){prepareCashForecast();return}
  if(action.dataset.manufacturingAction==='apply'){applyPending();return}
  if(action.dataset.manufacturingAction==='discard'){discardPending();return}
});
document.addEventListener('change',event=>{if(event.target.matches('[data-manufacturing-week]'))saveTimingFromDom()});

const app=$('#app');if(app)new MutationObserver(()=>queueMicrotask(enhance)).observe(app,{childList:true,subtree:true});
queueMicrotask(enhance);
