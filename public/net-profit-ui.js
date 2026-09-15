import {trueNetProfit,acquisitionSpendScenarios,firstOrderAcquisitionGuardrail} from './net-profit-guardrails.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>\'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(num(value));
const money2=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(num(value));
const pct=value=>`${num(value).toFixed(1)}%`;
const mode=()=>localStorage.getItem('msbo_mode')||'fresh';
const loadSession=()=>{try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}};
const loadState=()=>{try{return JSON.parse(localStorage.getItem('msbo_state')||'{}')}catch{return{}}};
const STORE_KEY='msbo_net_profit_guardrails_v1';
let active=false,account=null,brands=[];

function emptyModel(){
  const s=loadState();
  return {
    source:'manual',sourceNote:'',grossSales:null,discounts:null,refunds:null,netSales:null,shippingCollected:null,
    cogs:null,packagingPeriod:null,outboundShipping:null,fulfillment:null,paymentFees:null,affiliateSpend:null,adSpend:null,
    software:null,rent:null,payroll:null,contractors:null,otherOperating:null,newCustomers:null,targetOperatingMarginPct:10,
    price:num(s.price)||null,landedCost:num(s.landedCost)||null,packaging:num(s.packaging)||null,shippingSubsidy:num(s.shippingSubsidy)||null,
    returnReserve:num(s.returnReserve)||null,processorPercent:num(s.processorPercent)||null,processorFixed:num(s.processorFixed)||null,
    affiliatePct:num(s.affiliatePct)||null,targetPostCacContribution:num(s.requiredPostCac)||null,observedCac:num(s.observedCac)||null,discountPct:num(s.discountPct)||0
  };
}
function demoModel(){return {
  source:'demo',sourceNote:'Foundry Eight demo period',grossSales:18900,discounts:900,refunds:700,netSales:null,shippingCollected:650,
  cogs:6500,packagingPeriod:420,outboundShipping:1800,fulfillment:900,paymentFees:620,affiliateSpend:500,adSpend:3500,
  software:300,rent:0,payroll:2500,contractors:600,otherOperating:250,newCustomers:120,targetOperatingMarginPct:10,
  price:84,landedCost:24.7,packaging:1.2,shippingSubsidy:4.5,returnReserve:2.5,processorPercent:2.9,processorFixed:.3,
  affiliatePct:0,targetPostCacContribution:15,observedCac:18,discountPct:0
}}
function loadModel(){
  if(mode().startsWith('demo'))return demoModel();
  try{const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null');return saved&&typeof saved==='object'?{...emptyModel(),...saved}:emptyModel()}catch{return emptyModel()}
}
function saveModel(model){if(!mode().startsWith('demo'))localStorage.setItem(STORE_KEY,JSON.stringify(model))}
function setSession(session){if(session)localStorage.setItem('msbo_session',JSON.stringify(session));else localStorage.removeItem('msbo_session')}
async function api(url,{method='GET',body=null}={}){
  let session=loadSession();const headers={'Content-Type':'application/json'};if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  let response=await fetch(url,{method,headers,body:body===null?undefined:JSON.stringify(body)});
  if(response.status===401&&session?.refresh_token){
    const refreshed=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    if(refreshed.ok){const payload=await refreshed.json();session=payload.session;setSession(session);headers.Authorization=`Bearer ${session.access_token}`;response=await fetch(url,{method,headers,body:body===null?undefined:JSON.stringify(body)})}
  }
  const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(payload.error||`Request failed (${response.status})`);error.code=payload.code||null;error.status=response.status;throw error}return payload;
}
async function access(){if(mode().startsWith('demo'))return {pro:true,demo:true};if(!loadSession())return {pro:false,signedIn:false};if(!account)account=await api('/api/account');return {pro:Boolean(account.active),signedIn:true}}

const badge=(label,tone='neutral')=>`<span class="v2Badge ${tone}">${esc(label)}</span>`;
const field=(key,label,value,{step='.01',placeholder='',min='0',max=''}={})=>`<label class="profitField"><span>${esc(label)}</span><input data-profit-key="${key}" type="number" step="${step}" min="${min}" ${max!==''?`max="${max}"`:''} value="${value===null||value===undefined?'':esc(value)}" placeholder="${esc(placeholder)}"></label>`;
function gate(){
  if(!loadSession())return `<div class="v2Hero"><div><span class="kicker">TRUE NET PROFIT</span><h2>Profit Guardrails</h2><p>See what the brand actually keeps after the costs that usually get ignored.</p></div></div><div class="v2Gate"><span class="kicker">ACCOUNT REQUIRED</span><h3>Sign in to use the operating layer.</h3><p>The original calculators stay local. Period economics, connected commerce data and acquisition guardrails are part of the operating workspace.</p><button class="primary" data-profit-action="signin">Sign in</button></div>`;
  return `<div class="v2Hero"><div><span class="kicker">TRUE NET PROFIT</span><h2>Profit Guardrails</h2><p>Revenue is not profit. Know what survives COGS, fulfillment, fees, acquisition and overhead.</p></div></div><div class="v2Gate"><span class="kicker">BRAND OS PRO</span><h3>Protect margin before scaling spend.</h3><p>True net profit and acquisition guardrails connect order economics to period-level operating decisions.</p><button id="upgradeNow" class="primary" data-profit-action="upgrade">Upgrade to Pro</button></div>`;
}

function collectModel(){
  const model=loadModel();
  $$('[data-profit-key]').forEach(input=>{model[input.dataset.profitKey]=input.value===''?null:num(input.value)});
  saveModel(model);return model;
}
function periodInput(model){return {
  grossSales:model.grossSales,discounts:model.discounts,refunds:model.refunds,netSales:model.netSales,shippingCollected:model.shippingCollected,
  cogs:model.cogs,packaging:model.packagingPeriod,outboundShipping:model.outboundShipping,fulfillment:model.fulfillment,paymentFees:model.paymentFees,
  affiliateSpend:model.affiliateSpend,adSpend:model.adSpend,software:model.software,rent:model.rent,payroll:model.payroll,contractors:model.contractors,
  otherOperating:model.otherOperating,newCustomers:model.newCustomers,targetOperatingMarginPct:model.targetOperatingMarginPct
}}
function firstOrderInput(model){return {
  price:model.price,discountPct:model.discountPct,landedCost:model.landedCost,packaging:model.packaging,shippingSubsidy:model.shippingSubsidy,
  returnReserve:model.returnReserve,processorPercent:model.processorPercent,processorFixed:model.processorFixed,affiliatePct:model.affiliatePct,
  targetPostCacContribution:model.targetPostCacContribution,observedCac:model.observedCac
}}
function hasPeriodRevenue(model){return num(model.grossSales)>0||num(model.netSales)>0}

function shopifyPanel(model){
  if(mode().startsWith('demo'))return `<div class="profitSourceLine">${badge('FOUNDRY EIGHT · DEMO','signal')}<span>All values below are sample operating data.</span></div>`;
  if(!loadSession())return '';
  return `<div class="profitSourcePanel"><div><span class="kicker">OPTIONAL SOURCE</span><b>Pull commerce observations from Shopify</b><p>Brand OS fills revenue, discounts, refunds and shipping collected. It does not invent COGS, payroll, ad spend or fees.</p></div><div class="profitSourceControls"><select id="profitBrand"><option value="">Choose brand</option>${brands.map(brand=>`<option value="${brand.id}">${esc(brand.name)}</option>`).join('')}</select><button class="outline" data-profit-action="load-shopify">Load Shopify totals</button></div></div>${model.source==='shopify'?`<div class="profitSourceLine">${badge('SHOPIFY OBSERVATION','signal')}<span>${esc(model.sourceNote||'Operational commerce totals loaded from Brand OS.')}</span></div>`:''}`;
}
function inputPanels(model){return `${shopifyPanel(model)}
  <div class="profitPanel"><div class="profitPanelHead"><div><span class="kicker">01 · REVENUE</span><h3>Start with what the business actually sold</h3></div></div><div class="profitGrid g5">
    ${field('grossSales','Gross merchandise sales',model.grossSales,{placeholder:'10000'})}${field('discounts','Discounts',model.discounts,{placeholder:'500'})}${field('refunds','Refunds',model.refunds,{placeholder:'300'})}${field('netSales','Net sales · source truth',model.netSales,{placeholder:'Leave blank to calculate'})}${field('shippingCollected','Shipping collected',model.shippingCollected,{placeholder:'400'})}
  </div><p class="profitFoot">If Net sales is filled from a trusted source, Brand OS uses it directly instead of subtracting refunds twice. Taxes collected are intentionally excluded from operating revenue.</p></div>
  <div class="profitPanel"><div class="profitPanelHead"><div><span class="kicker">02 · DIRECT COSTS</span><h3>Count every cost required to fulfill the revenue</h3></div></div><div class="profitGrid g6">
    ${field('cogs','COGS',model.cogs,{placeholder:'3000'})}${field('packagingPeriod','Packaging',model.packagingPeriod,{placeholder:'300'})}${field('outboundShipping','Shipping labels / subsidy',model.outboundShipping,{placeholder:'700'})}${field('fulfillment','Fulfillment / 3PL',model.fulfillment,{placeholder:'500'})}${field('paymentFees','Payment fees',model.paymentFees,{placeholder:'300'})}${field('affiliateSpend','Affiliate / creator commission',model.affiliateSpend,{placeholder:'200'})}
  </div></div>
  <div class="profitPanel"><div class="profitPanelHead"><div><span class="kicker">03 · ACQUISITION + OVERHEAD</span><h3>Separate growth spend from the cost of running the company</h3></div></div><div class="profitGrid g6">
    ${field('adSpend','Paid acquisition spend',model.adSpend,{placeholder:'1500'})}${field('newCustomers','New customers',model.newCustomers,{step:'1',placeholder:'50'})}${field('software','Software',model.software,{placeholder:'200'})}${field('rent','Rent / storage',model.rent,{placeholder:'400'})}${field('payroll','Payroll',model.payroll,{placeholder:'800'})}${field('contractors','Contractors',model.contractors,{placeholder:'200'})}${field('otherOperating','Other operating expense',model.otherOperating,{placeholder:'100'})}${field('targetOperatingMarginPct','Target operating margin %',model.targetOperatingMarginPct,{step:'.1',max:'100',placeholder:'10'})}
  </div><div class="profitActionRow"><button class="primary" data-profit-action="calculate">Recalculate guardrails</button><button class="outline" data-profit-action="reset">Reset period</button><span>Inputs save on this device. Connected source values are labeled as observations.</span></div></div>`}

function results(model){
  if(!hasPeriodRevenue(model))return `<div class="profitEmpty"><span class="kicker">WAITING FOR PERIOD DATA</span><h3>Enter a real sales period before reading the result.</h3><p>Use a week, month or launch window consistently. Do not mix lifetime revenue with one month of expenses.</p></div>`;
  const result=trueNetProfit(periodInput(model));
  const scenarios=acquisitionSpendScenarios(periodInput(model));
  const tone=result.operatingProfit>=0?'good':'bad';
  const guardTone=result.acquisitionWithinTarget?'good':'bad';
  return `<div class="profitResults">
    <div class="v2MetricGrid profitMetrics">
      <div class="v2Metric"><small>OPERATING REVENUE</small><strong>${money(result.operatingRevenue)}</strong><span>Net merchandise + shipping</span></div>
      <div class="v2Metric ${tone}"><small>TRUE OPERATING PROFIT</small><strong>${money(result.operatingProfit)}</strong><span>${pct(result.operatingMarginPct)} operating margin</span></div>
      <div class="v2Metric"><small>AFTER ACQUISITION</small><strong>${money(result.contributionAfterAcquisition)}</strong><span>Before operating overhead</span></div>
      <div class="v2Metric ${guardTone}"><small>ACQUISITION HEADROOM</small><strong>${money(result.acquisitionHeadroom)}</strong><span>vs ${pct(result.targetOperatingMarginPct)} target margin</span></div>
      <div class="v2Metric"><small>OBSERVED CAC</small><strong>${result.observedCac===null?'—':money2(result.observedCac)}</strong><span>${result.newCustomers?`${Math.round(result.newCustomers)} new customers`:'Add new customers'}</span></div>
      <div class="v2Metric ${guardTone}"><small>MAX CAC @ TARGET</small><strong>${result.maxCacForTarget===null?'—':money2(result.maxCacForTarget)}</strong><span>Period-level ceiling</span></div>
    </div>
    <div class="v2Decision ${guardTone}"><div>${result.acquisitionWithinTarget?'✓':'!'}</div><section><b>${result.acquisitionWithinTarget?'Paid acquisition is inside the modeled profit guardrail.':'Paid acquisition is above the modeled profit guardrail.'}</b><p>${result.acquisitionWithinTarget?`At the current cost structure, Brand OS models up to ${money(result.maxAcquisitionSpendForTarget)} in paid acquisition while preserving a ${pct(result.targetOperatingMarginPct)} operating margin.`:`To preserve a ${pct(result.targetOperatingMarginPct)} operating margin, modeled paid acquisition is capped at ${money(result.maxAcquisitionSpendForTarget)}. Current spend is ${money(result.adSpend)}.`}</p></section></div>
    <div class="profitBreakdown"><div><span>Net merchandise revenue</span><b>${money(result.netMerchandiseRevenue)}</b></div><div><span>Direct costs before ads</span><b>−${money(result.directCosts)}</b></div><div><span>Contribution before acquisition</span><b>${money(result.contributionBeforeAcquisition)}</b></div><div><span>Paid acquisition</span><b>−${money(result.adSpend)}</b></div><div><span>Operating overhead</span><b>−${money(result.operatingExpenses)}</b></div><div class="total"><span>True operating profit</span><b>${money(result.operatingProfit)}</b></div></div>
    <div class="profitScenarioPanel"><div class="profitPanelHead"><div><span class="kicker">SPEND STRESS</span><h3>What happens if paid spend changes?</h3></div>${result.blendedMer===null?badge('MER —','neutral'):badge(`CURRENT MER ${result.blendedMer.toFixed(2)}×`,'signal')}</div><div class="profitScenarioGrid">${scenarios.map(s=>`<div class="profitScenario"><span>${Math.round(s.multiplier*100)}% OF CURRENT SPEND</span><b>${money(s.adSpend)}</b><strong class="${s.withinTarget?'goodText':'badText'}">${money(s.operatingProfit)} profit</strong><small>${pct(s.operatingMarginPct)} margin · ${s.withinTarget?'inside target':'below target'}</small></div>`).join('')}</div>${result.minimumMerAtTarget===null?'':`<p class="profitFoot">Modeled minimum revenue / paid-spend ratio at the selected target margin: <b>${result.minimumMerAtTarget.toFixed(2)}×</b>. This is a business guardrail, not proof that paid media caused the revenue.</p>`}</div>
  </div>`
}

function firstOrderPanel(model){
  const guard=firstOrderAcquisitionGuardrail(firstOrderInput(model));
  return `<div class="profitPanel"><div class="profitPanelHead"><div><span class="kicker">FIRST-ORDER GUARDRAIL</span><h3>Do not let a period-level average hide bad first-order economics</h3></div>${badge(guard.passes?'CAC INSIDE CEILING':'CAC ABOVE CEILING',guard.passes?'good':'bad')}</div>
    <div class="profitGrid g6">${field('price','Selling price',model.price,{placeholder:'84'})}${field('discountPct','Discount %',model.discountPct,{step:'.1',max:'100'})}${field('landedCost','Landed cost',model.landedCost,{placeholder:'24.70'})}${field('packaging','Packaging / order',model.packaging,{placeholder:'1.20'})}${field('shippingSubsidy','Shipping subsidy',model.shippingSubsidy,{placeholder:'4.50'})}${field('returnReserve','Return reserve',model.returnReserve,{placeholder:'2.50'})}${field('processorPercent','Processor %',model.processorPercent,{step:'.1',max:'100',placeholder:'2.9'})}${field('processorFixed','Processor fixed',model.processorFixed,{placeholder:'.30'})}${field('affiliatePct','Affiliate %',model.affiliatePct,{step:'.1',max:'100'})}${field('targetPostCacContribution','Required post-CAC contribution',model.targetPostCacContribution,{placeholder:'15'})}${field('observedCac','Observed CAC',model.observedCac,{placeholder:'18'})}</div>
    <div class="profitFirstOrderMetrics"><div><small>REALIZED PRICE</small><b>${money2(guard.realizedPrice)}</b></div><div><small>PRE-CAC CONTRIBUTION</small><b>${money2(guard.preCacContribution)}</b></div><div><small>MAX FIRST-ORDER CAC</small><b>${money2(guard.maxFirstOrderCac)}</b></div><div><small>CAC HEADROOM</small><b class="${guard.cacHeadroom<0?'badText':'goodText'}">${money2(guard.cacHeadroom)}</b></div></div>
    <p class="profitFoot">First-order ceiling includes landed cost, packaging, shipping subsidy, return reserve, processor fees, affiliate commission and your required post-CAC contribution. It does not assume repeat purchases will rescue a bad first order.</p>
  </div>`
}

async function loadBrands(){if(!loadSession())return;try{const data=await api('/api/brands');brands=data.brands||[]}catch{brands=[]}}
async function loadShopify(model){
  const brandId=$('#profitBrand')?.value;if(!brandId)return flash('Choose a brand first.','bad');
  try{
    const data=await api(`/api/v2/operating-data?brand_id=${encodeURIComponent(brandId)}`);const daily=data.daily||[];
    if(!daily.length)return flash('No synced Shopify commerce observations are available for this brand yet.','warn');
    const sum=key=>daily.reduce((total,row)=>total+num(row[key]),0);
    model.grossSales=sum('gross_sales');model.discounts=sum('discounts');model.refunds=sum('refunds');model.netSales=sum('net_sales');model.shippingCollected=sum('shipping_collected');
    model.source='shopify';model.sourceNote=`${daily.length} daily observation${daily.length===1?'':'s'} loaded. Shopify net sales uses the Brand OS operational definition, not Shopify Analytics official net sales.`;
    saveModel(model);await render();flash('Shopify commerce observations loaded ✓','good');
  }catch(error){flash(error.code==='V2_STORAGE_NOT_READY'?'V2 commerce storage is not enabled on this preview yet.':error.message,error.code==='V2_STORAGE_NOT_READY'?'warn':'bad')}
}
function flash(message,tone='neutral'){let el=$('#profitFlash');if(!el){el=document.createElement('div');el.id='profitFlash';el.className='v2Flash';document.body.appendChild(el)}el.className=`v2Flash ${tone} show`;el.textContent=message;clearTimeout(flash.timer);flash.timer=setTimeout(()=>el.classList.remove('show'),3200)}

async function render(){
  if(!active)return;const app=$('#app');if(!app)return;
  $$('#nav button').forEach(button=>button.classList.remove('active'));$('[data-profit-view="profitguardrails"]')?.classList.add('active');
  $('#title').textContent='Profit Guardrails';
  const gateState=await access();if(!gateState.pro){app.innerHTML=gate();return}
  await loadBrands();const model=loadModel();
  app.innerHTML=`<div class="v2Hero profitHero"><div><span class="kicker">TRUE NET PROFIT · ACQUISITION CONTROL</span><h2>Know what the brand kept—and what it can safely spend next.</h2><p>Build one honest period P&L, then compare paid acquisition against the profit floor you chose. Revenue and attribution are treated as observations, not guaranteed causality.</p></div><div>${badge(model.source==='shopify'?'SHOPIFY + MANUAL COSTS':mode().startsWith('demo')?'FOUNDRY EIGHT DEMO':'MANUAL OPERATING DATA','signal')}</div></div>${inputPanels(model)}${results(model)}${firstOrderPanel(model)}`;
}

function open(){active=true;render();window.scrollTo(0,0)}
document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-profit-view]');if(nav){event.preventDefault();event.stopPropagation();open();return}
  if(event.target.closest('#nav button[data-view],#memoryNav,[data-v2-view],[data-collection-view]')){active=false;return}
  const action=event.target.closest('[data-profit-action]');if(!action)return;
  const type=action.dataset.profitAction;
  if(type==='signin'){$('#authBtn')?.click();return}
  if(type==='upgrade'){$('#billingBtn')?.click();return}
  if(type==='calculate'){const model=collectModel();saveModel(model);render();return}
  if(type==='reset'){localStorage.removeItem(STORE_KEY);render();return}
  if(type==='load-shopify'){const model=collectModel();loadShopify(model);return}
});
