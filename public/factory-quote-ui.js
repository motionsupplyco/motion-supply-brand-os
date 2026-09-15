import {compareFactoryQuotes} from './production-preflight.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>\'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(num(value));
const money2=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(num(value));
const mode=()=>localStorage.getItem('msbo_mode')||'fresh';
const loadSession=()=>{try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}};
const STORE_KEY='msbo_factory_quote_compare_v1';
let active=false,account=null;

function blankQuote(index){return {name:`Factory ${index+1}`,orderQty:null,factoryUnitCost:null,depositPct:null,sampleCost:null,toolingCost:null,inspectionCost:null,freightEstimate:null,dutyEstimate:null,otherProductionCost:null,sampleLeadDays:null,productionLeadDays:null,notes:''}}
function emptyModel(){return {styleName:'',quotes:[blankQuote(0),blankQuote(1),blankQuote(2)]}}
function demoModel(){return {styleName:'Foundry Eight Heavy Hoodie',quotes:[
  {name:'Factory A · example',orderQty:500,factoryUnitCost:19.4,depositPct:30,sampleCost:120,toolingCost:180,inspectionCost:160,freightEstimate:980,dutyEstimate:420,otherProductionCost:0,sampleLeadDays:12,productionLeadDays:38,notes:'Example only.'},
  {name:'Factory B · example',orderQty:500,factoryUnitCost:18.7,depositPct:50,sampleCost:150,toolingCost:0,inspectionCost:null,freightEstimate:1150,dutyEstimate:null,otherProductionCost:0,sampleLeadDays:16,productionLeadDays:31,notes:'Duty and inspection are still unknown.'},
  {name:'Factory C · example',orderQty:500,factoryUnitCost:20.1,depositPct:40,sampleCost:95,toolingCost:250,inspectionCost:140,freightEstimate:860,dutyEstimate:390,otherProductionCost:75,sampleLeadDays:9,productionLeadDays:45,notes:'Example only.'}
]}}
function loadModel(){if(mode().startsWith('demo'))return demoModel();try{const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null');return saved&&Array.isArray(saved.quotes)?{...emptyModel(),...saved,quotes:[0,1,2].map(i=>({...blankQuote(i),...(saved.quotes[i]||{})}))}:emptyModel()}catch{return emptyModel()}}
function saveModel(model){if(!mode().startsWith('demo'))localStorage.setItem(STORE_KEY,JSON.stringify(model))}
function setSession(session){if(session)localStorage.setItem('msbo_session',JSON.stringify(session));else localStorage.removeItem('msbo_session')}
async function api(url){let session=loadSession();const headers={'Content-Type':'application/json'};if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;let response=await fetch(url,{headers});if(response.status===401&&session?.refresh_token){const refreshed=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(refreshed.ok){const payload=await refreshed.json();session=payload.session;setSession(session);headers.Authorization=`Bearer ${session.access_token}`;response=await fetch(url,{headers})}}const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Request failed (${response.status})`);return payload}
async function access(){if(mode().startsWith('demo'))return {pro:true,demo:true};if(!loadSession())return {pro:false,signedIn:false};if(!account)account=await api('/api/account');return {pro:Boolean(account.active),signedIn:true}}

const badge=(text,tone='neutral')=>`<span class="v2Badge ${tone}">${esc(text)}</span>`;
const field=(index,key,label,value,{step='.01',placeholder='',min='0',max=''}={})=>`<label class="quoteField"><span>${esc(label)}</span><input data-quote-index="${index}" data-quote-key="${key}" type="number" min="${min}" step="${step}" ${max!==''?`max="${max}"`:''} value="${value===null||value===undefined?'':esc(value)}" placeholder="${esc(placeholder)}"></label>`;
const textField=(index,key,label,value,placeholder='')=>`<label class="quoteField"><span>${esc(label)}</span><input data-quote-index="${index}" data-quote-text="${key}" value="${esc(value||'')}" placeholder="${esc(placeholder)}"></label>`;

function gate(){
  if(!loadSession())return `<div class="v2Hero"><div><span class="kicker">PRODUCTION SOURCING</span><h2>Factory Quote Compare</h2><p>Put factory quotes on the same page before comparing price, timing and cash exposure.</p></div></div><div class="v2Gate"><span class="kicker">ACCOUNT REQUIRED</span><h3>Sign in to use the operating layer.</h3><p>Quote comparison is part of the production decision workspace.</p><button class="primary" data-quote-action="signin">Sign in</button></div>`;
  return `<div class="v2Hero"><div><span class="kicker">PRODUCTION SOURCING</span><h2>Factory Quote Compare</h2><p>Compare the facts in each quote without pretending price alone proves supplier quality.</p></div></div><div class="v2Gate"><span class="kicker">BRAND OS PRO</span><h3>Normalize factory quotes before choosing what deserves deeper diligence.</h3><p>Brand OS compares cash and timing facts. It does not verify factories or recommend a supplier.</p><button id="upgradeNow" class="primary" data-quote-action="upgrade">Upgrade to Pro</button></div>`;
}
function collect(){
  const model=loadModel();model.styleName=String($('#quoteStyleName')?.value||'').trim();
  $$('[data-quote-index][data-quote-key]').forEach(input=>{const index=Number(input.dataset.quoteIndex);if(model.quotes[index])model.quotes[index][input.dataset.quoteKey]=input.value===''?null:num(input.value)});
  $$('[data-quote-index][data-quote-text]').forEach(input=>{const index=Number(input.dataset.quoteIndex);if(model.quotes[index])model.quotes[index][input.dataset.quoteText]=String(input.value||'').trim()});
  $$('[data-quote-notes]').forEach(input=>{const index=Number(input.dataset.quoteNotes);if(model.quotes[index])model.quotes[index].notes=String(input.value||'').slice(0,2000)});
  saveModel(model);return model
}
function quoteEditor(quote,index){return `<article class="quoteEditor"><div class="quoteEditorHead"><span class="kicker">QUOTE ${index+1}</span>${textField(index,'name','Factory / supplier',quote.name,`Factory ${index+1}`)}</div><div class="quoteGrid">
  ${field(index,'orderQty','Quantity',quote.orderQty,{step:'1',placeholder:'500'})}${field(index,'factoryUnitCost','Unit quote',quote.factoryUnitCost,{placeholder:'19.00'})}${field(index,'depositPct','Deposit %',quote.depositPct,{step:'1',max:'100',placeholder:'50'})}${field(index,'sampleCost','Sample cost',quote.sampleCost,{placeholder:'120'})}${field(index,'toolingCost','Tooling / setup',quote.toolingCost,{placeholder:'0'})}${field(index,'inspectionCost','Inspection / QC',quote.inspectionCost,{placeholder:'Unknown? leave blank'})}${field(index,'freightEstimate','Freight estimate',quote.freightEstimate,{placeholder:'Unknown? leave blank'})}${field(index,'dutyEstimate','Duty / import tax',quote.dutyEstimate,{placeholder:'Unknown? leave blank'})}${field(index,'otherProductionCost','Other known cost',quote.otherProductionCost,{placeholder:'0'})}${field(index,'sampleLeadDays','Sample lead · days',quote.sampleLeadDays,{step:'1',placeholder:'14'})}${field(index,'productionLeadDays','Production lead · days',quote.productionLeadDays,{step:'1',placeholder:'35'})}</div><label class="quoteNotes"><span>Quote notes</span><textarea data-quote-notes="${index}" maxlength="2000" placeholder="What is included? What is still unclear?">${esc(quote.notes||'')}</textarea></label></article>`}

function known(value,coverage,label){return coverage?value:`${value}*`}
function results(model){
  const rows=compareFactoryQuotes(model.quotes);
  return `<section class="quoteCompare"><div class="quoteCompareHead"><div><span class="kicker">NORMALIZED COMPARISON</span><h3>${esc(model.styleName||'Factory quotes')}</h3></div>${badge('FACTS · NOT A RECOMMENDATION','signal')}</div>
  <div class="quoteTableWrap"><table class="quoteTable"><thead><tr><th>Quote</th>${rows.map(row=>`<th>${esc(row.name)}</th>`).join('')}</tr></thead><tbody>
    <tr><td>Production quantity</td>${rows.map(row=>`<td>${row.orderQty.toLocaleString()}</td>`).join('')}</tr>
    <tr><td>Factory unit quote</td>${rows.map(row=>`<td>${money2(row.factoryUnitCost)}</td>`).join('')}</tr>
    <tr><td>Production subtotal</td>${rows.map(row=>`<td>${money(row.productionSubtotal)}</td>`).join('')}</tr>
    <tr><td>Deposit terms</td>${rows.map(row=>`<td>${row.depositPct.toFixed(0)}% · ${money(row.deposit)}</td>`).join('')}</tr>
    <tr><td>Remaining factory balance</td>${rows.map(row=>`<td>${money(row.balance)}</td>`).join('')}</tr>
    <tr><td>Sample + tooling + deposit</td>${rows.map(row=>`<td>${money(row.preProductionCash)}</td>`).join('')}</tr>
    <tr><td>Freight estimate</td>${rows.map(row=>`<td>${row.coverage.freightEstimate?money(row.freightEstimate):'UNKNOWN'}</td>`).join('')}</tr>
    <tr><td>Duty / import-tax estimate</td>${rows.map(row=>`<td>${row.coverage.dutyEstimate?money(row.dutyEstimate):'UNKNOWN'}</td>`).join('')}</tr>
    <tr><td>Inspection / QC estimate</td>${rows.map(row=>`<td>${row.coverage.inspectionCost?money(row.inspectionCost):'UNKNOWN'}</td>`).join('')}</tr>
    <tr class="quoteTotalRow"><td>Total known cash</td>${rows.map(row=>`<td><b>${money(row.totalKnownCash)}</b>${row.missingEstimateLabels.length?`<small>Excludes ${esc(row.missingEstimateLabels.join(', '))}</small>`:'<small>Tracked estimates entered</small>'}</td>`).join('')}</tr>
    <tr><td>Sample lead time</td>${rows.map(row=>`<td>${row.sampleLeadDays===null?'UNKNOWN':`${Math.round(row.sampleLeadDays)} days`}</td>`).join('')}</tr>
    <tr><td>Production lead time</td>${rows.map(row=>`<td>${row.productionLeadDays===null?'UNKNOWN':`${Math.round(row.productionLeadDays)} days`}</td>`).join('')}</tr>
  </tbody></table></div>
  <div class="quoteTruth"><b>How to read this:</b><p>A lower quoted cost, smaller deposit or faster lead time is only one fact. Brand OS does not know from a quote whether a factory is legitimate, capable, ethical, financially stable or able to reproduce the approved sample. Use Production Preflight and independent supplier diligence before sending money.</p></div>
  </section>`
}
async function render(){
  if(!active)return;const app=$('#app');if(!app)return;$$('#nav button').forEach(button=>button.classList.remove('active'));$('[data-factory-view="quotecompare"]')?.classList.add('active');$('#title').textContent='Factory Quote Compare';const accessState=await access();if(!accessState.pro){app.innerHTML=gate();return}const model=loadModel();app.innerHTML=`<div class="v2Hero quoteHero"><div><span class="kicker">COST · CASH · TIMING</span><h2>Make every factory quote answer the same questions.</h2><p>Normalize three quotes so missing landed costs, different deposits and different lead times cannot hide behind one attractive unit price.</p></div><div>${badge(mode().startsWith('demo')?'EXAMPLE QUOTES':'FOUNDER-ENTERED QUOTES','signal')}</div></div><section class="quoteSetup"><label class="quoteStyle"><span>STYLE / PRODUCT BEING QUOTED</span><input id="quoteStyleName" value="${esc(model.styleName||'')}" placeholder="Heavyweight hoodie"></label><div class="quoteEditors">${model.quotes.map(quoteEditor).join('')}</div><div class="quoteActions"><button class="primary" data-quote-action="compare">Compare quotes</button><button class="outline" data-quote-action="reset">Reset quotes</button><span>Blank freight, duty or QC stays UNKNOWN—not zero.</span></div></section>${results(model)}`}
function flash(message,tone='neutral'){let el=$('#quoteFlash');if(!el){el=document.createElement('div');el.id='quoteFlash';el.className='v2Flash';document.body.appendChild(el)}el.className=`v2Flash ${tone} show`;el.textContent=message;clearTimeout(flash.timer);flash.timer=setTimeout(()=>el.classList.remove('show'),2400)}
function open(){active=true;render();window.scrollTo(0,0)}
document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-factory-view="quotecompare"]');if(nav){event.preventDefault();event.stopPropagation();open();return}
  if(event.target.closest('#nav button[data-view],#memoryNav,[data-v2-view],[data-collection-view],[data-profit-view],[data-production-view]')){active=false;return}
  const action=event.target.closest('[data-quote-action]');if(!action)return;const type=action.dataset.quoteAction;
  if(type==='signin'){$('#authBtn')?.click();return}if(type==='upgrade'){$('#billingBtn')?.click();return}if(type==='compare'){collect();render();flash('Quotes normalized ✓','good');return}if(type==='reset'){localStorage.removeItem(STORE_KEY);render();return}
});
document.addEventListener('change',event=>{if(active&&event.target.matches('[data-quote-index],#quoteStyleName,[data-quote-notes]'))collect()});
