import {productionPreflight,PRODUCTION_PREFLIGHT_CHECKS} from './production-preflight.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>\'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(num(value));
const money2=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(num(value));
const mode=()=>localStorage.getItem('msbo_mode')||'fresh';
const loadSession=()=>{try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}};
const STORE_KEY='msbo_production_preflight_v1';
let active=false,account=null;

function blankChecks(){return Object.fromEntries(PRODUCTION_PREFLIGHT_CHECKS.map(check=>[check.id,'missing']))}
function emptyModel(){return {
  factoryName:'',styleName:'',quoteReference:'',checks:blankChecks(),orderQty:null,factoryUnitCost:null,depositPct:null,
  sampleCost:null,toolingCost:null,inspectionCost:null,freightEstimate:null,dutyEstimate:null,otherProductionCost:null,
  sampleLeadDays:null,productionLeadDays:null,notes:''
}}
function demoModel(){return {
  factoryName:'Example Factory',styleName:'Foundry Eight Heavy Hoodie',quoteReference:'EXAMPLE-PO-01',
  checks:{styleIdentity:'ready',materialSpec:'ready',measurementSpec:'ready',tolerances:'ready',constructionSpec:'ready',artworkPlacement:'ready',colorSpec:'ready',labelsPackaging:'ready',sizeGrade:'ready',approvedSample:'ready',sampleMeasurementsRecorded:'ready',writtenQuote:'ready',paymentTerms:'ready',productionLeadTime:'ready',incoterm:'ready',defectRemedy:'missing',inspectionPlan:'missing'},
  orderQty:500,factoryUnitCost:19,depositPct:50,sampleCost:140,toolingCost:200,inspectionCost:null,freightEstimate:950,dutyEstimate:null,otherProductionCost:0,
  sampleLeadDays:14,productionLeadDays:35,notes:'Example assumptions only. Replace every field with your factory documents before using this as a real preflight.'
}}
function loadModel(){
  if(mode().startsWith('demo'))return demoModel();
  try{const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null');return saved&&typeof saved==='object'?{...emptyModel(),...saved,checks:{...blankChecks(),...(saved.checks||{})}}:emptyModel()}catch{return emptyModel()}
}
function saveModel(model){if(!mode().startsWith('demo'))localStorage.setItem(STORE_KEY,JSON.stringify(model))}
function setSession(session){if(session)localStorage.setItem('msbo_session',JSON.stringify(session));else localStorage.removeItem('msbo_session')}
async function api(url){
  let session=loadSession();const headers={'Content-Type':'application/json'};if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  let response=await fetch(url,{headers});
  if(response.status===401&&session?.refresh_token){
    const refreshed=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    if(refreshed.ok){const payload=await refreshed.json();session=payload.session;setSession(session);headers.Authorization=`Bearer ${session.access_token}`;response=await fetch(url,{headers})}
  }
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Request failed (${response.status})`);return payload;
}
async function access(){if(mode().startsWith('demo'))return {pro:true,demo:true};if(!loadSession())return {pro:false,signedIn:false};if(!account)account=await api('/api/account');return {pro:Boolean(account.active),signedIn:true}}

const badge=(text,tone='neutral')=>`<span class="v2Badge ${tone}">${esc(text)}</span>`;
const field=(key,label,value,{step='.01',placeholder='',min='0',max=''}={})=>`<label class="preflightField"><span>${esc(label)}</span><input data-preflight-key="${key}" type="number" min="${min}" step="${step}" ${max!==''?`max="${max}"`:''} value="${value===null||value===undefined?'':esc(value)}" placeholder="${esc(placeholder)}"></label>`;
const textField=(key,label,value,placeholder='')=>`<label class="preflightField"><span>${esc(label)}</span><input data-preflight-text="${key}" value="${esc(value||'')}" placeholder="${esc(placeholder)}"></label>`;

function gate(){
  if(!loadSession())return `<div class="v2Hero"><div><span class="kicker">PRODUCTION CONTROL</span><h2>Production Preflight</h2><p>Check the documents and cash exposure before treating a factory deposit like a routine payment.</p></div></div><div class="v2Gate"><span class="kicker">ACCOUNT REQUIRED</span><h3>Sign in to use the operating layer.</h3><p>The preflight stays tied to the same Brand OS operating workspace as forecasting and reorder decisions.</p><button class="primary" data-preflight-action="signin">Sign in</button></div>`;
  return `<div class="v2Hero"><div><span class="kicker">PRODUCTION CONTROL</span><h2>Production Preflight</h2><p>Check tech-pack readiness, sample approval, written terms and cash exposure before production money moves.</p></div></div><div class="v2Gate"><span class="kicker">BRAND OS PRO</span><h3>Catch production gaps before they become expensive.</h3><p>This is an internal decision gate—not factory verification.</p><button id="upgradeNow" class="primary" data-preflight-action="upgrade">Upgrade to Pro</button></div>`;
}
function collectModel(){
  const model=loadModel();
  $$('[data-preflight-key]').forEach(input=>{model[input.dataset.preflightKey]=input.value===''?null:num(input.value)});
  $$('[data-preflight-text]').forEach(input=>{model[input.dataset.preflightText]=String(input.value||'').trim()});
  $$('[data-preflight-check]').forEach(select=>{model.checks[select.dataset.preflightCheck]=select.value});
  const notes=$('#preflightNotes');if(notes)model.notes=String(notes.value||'').slice(0,3000);
  saveModel(model);return model;
}
function inputForEngine(model){return {...model,checks:model.checks}}
function statusLabel(result){
  if(result.status==='blocked')return {text:'BLOCKED BEFORE DEPOSIT',tone:'bad'};
  if(result.status==='needs_review')return {text:'NEEDS REVIEW',tone:'warn'};
  return {text:'READY FOR INTERNAL REVIEW',tone:'good'};
}
function checklistGroup(model,group,title,copy){
  const checks=PRODUCTION_PREFLIGHT_CHECKS.filter(check=>check.group===group);
  return `<section class="preflightPanel"><div class="preflightPanelHead"><div><span class="kicker">${esc(title)}</span><h3>${esc(copy)}</h3></div></div><div class="preflightChecklist">${checks.map(check=>{
    const value=model.checks?.[check.id]||'missing';
    return `<label class="preflightCheck"><div><b>${esc(check.label)}</b><span>${check.blocking?'Deposit blocker if missing':check.waivable?'Mark N/A only when it truly does not apply':'Review before production'}</span></div><select data-preflight-check="${check.id}"><option value="missing" ${value==='missing'?'selected':''}>Not ready</option><option value="ready" ${value==='ready'?'selected':''}>Ready / documented</option>${check.waivable?`<option value="na" ${value==='na'?'selected':''}>Not applicable</option>`:''}</select></label>`
  }).join('')}</div></section>`;
}
function commercialInputs(model){return `<section class="preflightPanel"><div class="preflightPanelHead"><div><span class="kicker">04 · CASH COMMITMENT</span><h3>Model what the factory decision puts at risk</h3></div></div>
  <div class="preflightGrid g4">${textField('factoryName','Factory / supplier',model.factoryName,'Factory name')}${textField('styleName','Style / product',model.styleName,'Heavyweight hoodie')}${textField('quoteReference','Quote / PO reference',model.quoteReference,'Quote date or ID')}${field('orderQty','Production quantity',model.orderQty,{step:'1',placeholder:'500'})}${field('factoryUnitCost','Factory unit cost',model.factoryUnitCost,{placeholder:'19.00'})}${field('depositPct','Deposit %',model.depositPct,{step:'1',max:'100',placeholder:'50'})}${field('sampleCost','Sample cost paid / planned',model.sampleCost,{placeholder:'140'})}${field('toolingCost','Tooling / setup',model.toolingCost,{placeholder:'200'})}${field('inspectionCost','Inspection / QC estimate',model.inspectionCost,{placeholder:'Enter 0 only if truly none'})}${field('freightEstimate','Freight estimate',model.freightEstimate,{placeholder:'950'})}${field('dutyEstimate','Duty / import-tax estimate',model.dutyEstimate,{placeholder:'Enter estimate'})}${field('otherProductionCost','Other production cost',model.otherProductionCost,{placeholder:'0'})}${field('sampleLeadDays','Sample lead time · days',model.sampleLeadDays,{step:'1',placeholder:'14'})}${field('productionLeadDays','Production lead time · days',model.productionLeadDays,{step:'1',placeholder:'35'})}</div>
  <label class="preflightNotes"><span>Founder notes</span><textarea id="preflightNotes" maxlength="3000" placeholder="What still needs confirmation? What did the factory promise in writing?">${esc(model.notes||'')}</textarea></label>
  <div class="preflightActions"><button class="primary" data-preflight-action="calculate">Run preflight</button><button class="outline" data-preflight-action="reset">Reset</button><span>Saved on this device. Example/demo data is labeled.</span></div></section>`}

function resultPanel(model){
  const result=productionPreflight(inputForEngine(model)),commitment=result.commitment,status=statusLabel(result);
  return `<section class="preflightResult"><div class="preflightResultHead"><div><span class="kicker">DECISION GATE</span><h3>${esc(model.styleName||'Production commitment')}</h3></div>${badge(status.text,status.tone)}</div>
    <div class="v2MetricGrid preflightMetrics"><div class="v2Metric"><small>DOCUMENT COVERAGE</small><strong>${Math.round(result.coveragePct)}%</strong><span>${result.addressed} of ${result.totalChecks} addressed</span></div><div class="v2Metric ${status.tone}"><small>DEPOSIT</small><strong>${money(commitment.deposit)}</strong><span>${commitment.depositPct.toFixed(0)}% of production subtotal</span></div><div class="v2Metric"><small>PRE-PRODUCTION CASH</small><strong>${money(commitment.preProductionCash)}</strong><span>Sample + tooling + deposit</span></div><div class="v2Metric"><small>FACTORY BALANCE</small><strong>${money(commitment.balance)}</strong><span>Production subtotal less deposit</span></div><div class="v2Metric"><small>TOTAL KNOWN CASH</small><strong>${money(commitment.totalKnownCash)}</strong><span>${commitment.missingEstimateLabels.length?'Not all landed estimates entered':'All tracked estimates entered'}</span></div><div class="v2Metric"><small>POST-DEPOSIT KNOWN CASH</small><strong>${money(commitment.postDepositKnownCash)}</strong><span>Balance + known downstream costs</span></div></div>
    ${result.blockingMessages.length?`<div class="preflightIssues bad"><b>Do not treat the deposit as internally cleared yet.</b><ul>${result.blockingMessages.map(message=>`<li>${esc(message)}</li>`).join('')}</ul></div>`:`<div class="preflightIssues good"><b>No modeled deposit blockers remain.</b><p>That only means the documentation fields in this preflight are addressed. It does not validate the supplier.</p></div>`}
    ${result.cautions.length?`<div class="preflightIssues warn"><b>Still needs founder review</b><ul>${result.cautions.map(message=>`<li>${esc(message)}</li>`).join('')}</ul></div>`:''}
    <div class="preflightDisclaimer">${esc(result.disclaimer)}</div>
  </section>`;
}
async function render(){
  if(!active)return;const app=$('#app');if(!app)return;
  $$('#nav button').forEach(button=>button.classList.remove('active'));$('[data-production-view="preflight"]')?.classList.add('active');$('#title').textContent='Production Preflight';
  const accessState=await access();if(!accessState.pro){app.innerHTML=gate();return}
  const model=loadModel();
  app.innerHTML=`<div class="v2Hero preflightHero"><div><span class="kicker">FACTORY · TECH PACK · CASH</span><h2>Do the production homework before the deposit becomes irreversible.</h2><p>Address the spec, approval and commercial terms that can create disputes later, then see exactly how much known cash the commitment consumes.</p></div><div>${badge(mode().startsWith('demo')?'EXAMPLE DATA':'FOUNDER INPUTS','signal')}</div></div>${checklistGroup(model,'tech_pack','01 · TECH PACK','Is the product actually specified?')}${checklistGroup(model,'approval','02 · SAMPLE APPROVAL','Did the approved physical sample become the reference?')}${checklistGroup(model,'commercial','03 · WRITTEN TERMS','Can both sides point to the same commercial terms?')}${commercialInputs(model)}${resultPanel(model)}`;
}
function flash(message,tone='neutral'){let el=$('#preflightFlash');if(!el){el=document.createElement('div');el.id='preflightFlash';el.className='v2Flash';document.body.appendChild(el)}el.className=`v2Flash ${tone} show`;el.textContent=message;clearTimeout(flash.timer);flash.timer=setTimeout(()=>el.classList.remove('show'),2600)}
function open(){active=true;render();window.scrollTo(0,0)}
document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-production-view]');if(nav){event.preventDefault();event.stopPropagation();open();return}
  if(event.target.closest('#nav button[data-view],#memoryNav,[data-v2-view],[data-collection-view],[data-profit-view]')){active=false;return}
  const action=event.target.closest('[data-preflight-action]');if(!action)return;
  const type=action.dataset.preflightAction;
  if(type==='signin'){$('#authBtn')?.click();return}
  if(type==='upgrade'){$('#billingBtn')?.click();return}
  if(type==='calculate'){collectModel();render();flash('Preflight recalculated ✓','good');return}
  if(type==='reset'){localStorage.removeItem(STORE_KEY);render();return}
});
document.addEventListener('change',event=>{if(active&&event.target.matches('[data-preflight-check],[data-preflight-key],[data-preflight-text]'))collectModel()});
