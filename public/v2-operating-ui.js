import {cashForecast,reorderIntelligence,reorderCashGate,buildOperatingAlerts} from './operating-intelligence.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number.isFinite(Number(value))?Number(value):0);
const money2=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(Number(value))?Number(value):0);
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const mode=()=>localStorage.getItem('msbo_mode')||'fresh';
const loadSession=()=>{try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}};
const loadState=()=>{try{return JSON.parse(localStorage.getItem('msbo_state')||'{}')}catch{return{}}};

let activeView=null;
let account=null;
let brands=[];
let v2State={
  brandId:'',forecast:null,forecastId:null,operatingData:null,planning:[],connections:[],providerConfig:null,
  reorderInputs:new Map(),alerts:[]
};

function setSession(session){if(session)localStorage.setItem('msbo_session',JSON.stringify(session));else localStorage.removeItem('msbo_session')}
async function api(url,{method='GET',body=null,auth=true}={}){
  let session=loadSession();
  const headers={'Content-Type':'application/json'};
  if(auth&&session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  let response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined});
  if(response.status===401&&auth&&session?.refresh_token){
    const refreshed=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    if(refreshed.ok){const payload=await refreshed.json();setSession(payload.session);session=payload.session;headers.Authorization=`Bearer ${session.access_token}`;response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined})}
  }
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.error||`Request failed (${response.status})`);error.status=response.status;error.code=payload.code||null;throw error}
  return payload;
}
async function track(name,properties={}){try{await api('/api/events',{method:'POST',body:{event_name:name,anonymous_id:localStorage.getItem('msbo_anon_id')||null,properties},auth:Boolean(loadSession())})}catch{}}

const badge=(label,tone='neutral')=>`<span class="v2Badge ${tone}">${esc(label)}</span>`;
const source=(label)=>`<span class="v2Source">${esc(label)}</span>`;
const empty=(title,copy,action='')=>`<div class="v2Empty"><div class="v2EmptyIcon">◇</div><h3>${esc(title)}</h3><p>${esc(copy)}</p>${action}</div>`;
const loading=()=>`<div class="v2Loading"><span></span><b>Loading operating intelligence…</b></div>`;
const shell=(kicker,title,copy,body,aside='')=>`<div class="v2Hero"><div><span class="kicker">${esc(kicker)}</span><h2>${esc(title)}</h2><p>${esc(copy)}</p></div>${aside}</div>${body}`;

function app(){return $('#app')}
function title(text){const el=$('#title');if(el)el.textContent=text}
function activateNav(view){
  $$('#nav button').forEach(button=>button.classList.remove('active'));
  const button=document.querySelector(`[data-v2-view="${view}"]`);button?.classList.add('active');
}
function coreJump(view){document.querySelector(`#nav button[data-view="${view}"]`)?.click()}
function signInAction(){return `<button class="primary" data-v2-action="signin">Sign in</button>`}
function proAction(){return `<button class="primary" data-v2-action="upgrade">Upgrade to Pro · $19/month</button>`}

function demoForecast(){
  const state=loadState();
  const price=num(state.price)||78,weeklyDemand=num(state.weeklyDemand)||10,cac=num(state.observedCac)||15;
  const poTotal=(num(state.proposedUnits)||80)*(num(state.landedCost)||27.4);
  const depositPct=num(state.depositPct)||50;
  const deposit=poTotal*depositPct/100,balance=poTotal-deposit;
  const weeks=Array.from({length:13},(_,index)=>({
    label:`Week ${index+1}`,dtcPayouts:price*weeklyDemand,wholesaleReceipts:0,otherInflows:0,
    factoryDeposits:index===0?deposit:0,factoryBalances:index===4?balance:0,freightDuty:0,
    marketing:cac*weeklyDemand,payrollContractors:0,softwareRent:0,taxesDebt:0,otherOutflows:0
  }));
  return {name:'Foundry Eight · 13-week demo',starting_cash:num(state.cashStart)||7500,protected_floor:num(state.protectedFloor)||2500,weeks};
}
function blankForecast(){
  const state=loadState();
  return {name:'13-week cash forecast',starting_cash:num(state.cashStart),protected_floor:num(state.protectedFloor),weeks:Array.from({length:13},(_,index)=>({label:`Week ${index+1}`,dtcPayouts:0,wholesaleReceipts:0,otherInflows:0,factoryDeposits:0,factoryBalances:0,freightDuty:0,marketing:0,payrollContractors:0,softwareRent:0,taxesDebt:0,otherOutflows:0}))};
}
function analysisOfForecast(forecast=v2State.forecast){return cashForecast({startingCash:num(forecast?.starting_cash),protectedFloor:num(forecast?.protected_floor),weeks:forecast?.weeks||[]})}

function forecastSummary(analysis){
  const risk=analysis.passes?{label:'FLOOR PROTECTED',tone:'good'}:{label:`BREACH · WEEK ${analysis.firstBreachWeek}`,tone:'bad'};
  return `<div class="v2MetricGrid">
    <div class="v2Metric"><small>ENDING CASH</small><strong>${money(analysis.endingCash)}</strong><span>Week 13 modeled close</span></div>
    <div class="v2Metric"><small>LOWEST CASH</small><strong>${money(analysis.minimumCash)}</strong><span>Week ${analysis.minimumWeek||'—'}</span></div>
    <div class="v2Metric"><small>LOWEST HEADROOM</small><strong class="${analysis.minimumHeadroom<0?'negative':''}">${money(analysis.minimumHeadroom)}</strong><span>vs protected floor</span></div>
    <div class="v2Metric"><small>CASH STATUS</small><strong class="statusText ${risk.tone}">${risk.label}</strong><span>${analysis.passes?'No modeled floor breach':'Commitments exceed your floor'}</span></div>
  </div>`;
}
function forecastAdvice(analysis){
  if(analysis.passes)return `<div class="v2Decision good"><div>✓</div><section><b>Modeled cash floor holds.</b><p>Your lowest modeled headroom is ${money2(analysis.minimumHeadroom)}. This is still a forecast: expected receipts are not guaranteed cash.</p></section></div>`;
  return `<div class="v2Decision bad"><div>!</div><section><b>Cash protection fails in Week ${analysis.firstBreachWeek}.</b><p>The first modeled shortfall is ${money2(analysis.firstBreachAmount)}. Review PO timing, ad spend, payroll, taxes and expected receipts before committing more cash.</p></section></div>`;
}
function cashInput(weekIndex,key,value,label){return `<label class="v2Cell"><span>${esc(label)}</span><input type="number" step=".01" data-forecast-week="${weekIndex}" data-forecast-key="${key}" value="${Number(value||0)}"></label>`}
function renderForecastEditor(){
  const forecast=v2State.forecast||blankForecast(),analysis=analysisOfForecast(forecast),demo=mode().startsWith('demo');
  const rows=(forecast.weeks||[]).map((week,index)=>`<div class="v2ForecastWeek">
    <div class="v2WeekHead"><b>W${String(index+1).padStart(2,'0')}</b><span>${esc(week.label||`Week ${index+1}`)}</span><strong>${money(analysis.weeks[index]?.closingCash)}</strong></div>
    <div class="v2WeekGrid">
      ${cashInput(index,'dtcPayouts',week.dtcPayouts,'DTC payouts')}
      ${cashInput(index,'wholesaleReceipts',week.wholesaleReceipts,'Wholesale')}
      ${cashInput(index,'factoryDeposits',week.factoryDeposits,'Factory deposit')}
      ${cashInput(index,'factoryBalances',week.factoryBalances,'Factory balance')}
      ${cashInput(index,'freightDuty',week.freightDuty,'Freight / duty')}
      ${cashInput(index,'marketing',week.marketing,'Marketing')}
      ${cashInput(index,'payrollContractors',week.payrollContractors,'Payroll / contractors')}
      ${cashInput(index,'softwareRent',week.softwareRent,'Software / rent')}
      ${cashInput(index,'taxesDebt',week.taxesDebt,'Taxes / debt')}
      ${cashInput(index,'otherOutflows',week.otherOutflows,'Other outflows')}
    </div>
  </div>`).join('');
  const brandControl=!demo&&loadSession()?brandSelector('forecastBrand'):source(demo?'FOUNDRY EIGHT · DEMO':'MANUAL FORECAST');
  const save=demo?'':`<button class="primary" data-v2-action="save-forecast">Save forecast</button>`;
  return shell('OPERATING INTELLIGENCE','13-Week Cash Forecast','See when commitments, inventory payments and acquisition spend put operating cash at risk before the money leaves your account.',`
    <div class="v2Toolbar">${brandControl}<div class="v2ToolbarActions"><button class="outline" data-v2-action="forecast-reset">Reset 13 weeks</button>${save}</div></div>
    <div class="v2TopInputs">
      <label><span>Starting cash</span><input id="v2StartingCash" type="number" step=".01" value="${num(forecast.starting_cash)}"></label>
      <label><span>Protected operating floor</span><input id="v2ProtectedFloor" type="number" step=".01" value="${num(forecast.protected_floor)}"></label>
      <label><span>Forecast name</span><input id="v2ForecastName" value="${esc(forecast.name||'13-week cash forecast')}"></label>
      <button class="outline v2Recalc" data-v2-action="forecast-recalc">Recalculate</button>
    </div>
    ${forecastSummary(analysis)}${forecastAdvice(analysis)}
    <div class="v2SectionHead"><div><span class="kicker">WEEKLY CASH MAP</span><h3>13 weeks of money in vs money out</h3></div><span>Expected receipts are estimates, not guaranteed cash.</span></div>
    <div class="v2ForecastStack">${rows}</div>
  `,badge('PRO OPERATING LAYER','signal'));
}

function brandSelector(id){
  return `<label class="v2BrandSelect"><span>BRAND</span><select id="${id}"><option value="">Select brand</option>${brands.map(brand=>`<option value="${brand.id}" ${brand.id===v2State.brandId?'selected':''}>${esc(brand.name)}</option>`).join('')}</select></label>`;
}
async function ensureAccount(){
  if(mode().startsWith('demo'))return {demo:true,pro:true};
  if(!loadSession())return {signedIn:false,pro:false};
  if(!account)account=await api('/api/account');
  return {signedIn:true,pro:Boolean(account.active),account};
}
async function ensureBrands(){if(!loadSession())return[];if(!brands.length){const data=await api('/api/brands');brands=data.brands||[]}return brands}
function gateScreen(feature,copy){
  if(!loadSession())return shell('OPERATING INTELLIGENCE',feature,copy,empty('Sign in to use the operating layer','Your calculator data can stay local, but saved forecasts, synced inventory and integrations need an account.',signInAction()));
  return shell('OPERATING INTELLIGENCE',feature,copy,`<div class="v2Gate"><span class="kicker">BRAND OS PRO</span><h3>Turn the model into an operating system.</h3><p>Cash forecasting, automated inventory intelligence and connected store data are part of the recurring Pro operating layer.</p>${proAction()}</div>`);
}
function brandNeeded(feature){return shell('OPERATING INTELLIGENCE',feature,'Connect operating intelligence to one saved clothing brand.',empty('Create your first brand','Cash, inventory and integrations stay scoped to a brand so data never gets mixed together.',`<button class="primary" data-v2-action="brands">Open Brands & SKUs</button>`));}

function collectForecastInputs(){
  const forecast=v2State.forecast||blankForecast();
  forecast.starting_cash=num($('#v2StartingCash')?.value);
  forecast.protected_floor=Math.max(0,num($('#v2ProtectedFloor')?.value));
  forecast.name=String($('#v2ForecastName')?.value||'13-week cash forecast').trim().slice(0,160);
  $$('[data-forecast-week]').forEach(input=>{
    const week=Number(input.dataset.forecastWeek),key=input.dataset.forecastKey;
    if(!forecast.weeks[week])forecast.weeks[week]={label:`Week ${week+1}`};
    forecast.weeks[week][key]=Math.max(0,num(input.value));
  });
  v2State.forecast=forecast;
}
async function saveForecast(){
  collectForecastInputs();
  if(!v2State.brandId)return flash('Choose a brand first.','bad');
  const payload={brand_id:v2State.brandId,name:v2State.forecast.name,starting_cash:v2State.forecast.starting_cash,protected_floor:v2State.forecast.protected_floor,weeks:v2State.forecast.weeks};
  try{
    const result=v2State.forecastId?await api(`/api/v2/cash-forecasts/${encodeURIComponent(v2State.forecastId)}`,{method:'PUT',body:payload}):await api('/api/v2/cash-forecasts',{method:'POST',body:payload});
    v2State.forecastId=result.forecast?.id||v2State.forecastId;v2State.forecast=result.forecast||v2State.forecast;
    track('cash_forecast_saved',{brand_id:v2State.brandId,passes:result.analysis?.passes,first_breach_week:result.analysis?.firstBreachWeek||null});
    renderCurrent();flash('Forecast saved ✓','good');
  }catch(error){flash(error.message,'bad')}
}
async function loadForecastForBrand(){
  if(!v2State.brandId){v2State.forecast=blankForecast();v2State.forecastId=null;return}
  try{
    const data=await api(`/api/v2/cash-forecasts?brand_id=${encodeURIComponent(v2State.brandId)}`);
    const latest=data.forecasts?.[0];
    if(latest){v2State.forecast=latest;v2State.forecastId=latest.id}else{v2State.forecast=blankForecast();v2State.forecastId=null}
  }catch(error){if(error.code==='V2_STORAGE_NOT_READY'){v2State.forecast=blankForecast();v2State.forecastId=null;flash('V2 storage is not enabled on this preview yet. Local forecasting still works.','warn')}else throw error}
}

function foundryReorderItems(){
  const state=loadState();
  return [{key:'demo:foundry-hoodie',sku:'FE-HOODIE',label:'Foundry Eight · Heavy Hoodie',weeklyDemand:num(state.weeklyDemand)||10,highWeeklyDemand:num(state.highWeeklyDemand)||14,leadWeeks:num(state.leadWeeks)||6,onHand:num(state.onHand)||35,inbound:num(state.inbound),allocated:num(state.allocated),landedCost:num(state.landedCost)||27.4,moq:0,depositPct:num(state.depositPct)||50,source:'DEMO'}];
}
function inventoryToReorderItems(){
  const inventory=v2State.operatingData?.inventory||[];
  return inventory.map(row=>{
    const key=`shopify:${row.external_variant_id||row.sku_code||row.id}`;
    const saved=v2State.reorderInputs.get(key)||{};
    return {key,sku:row.sku_code||'NO-SKU',label:row.product_name||row.sku_code||'Shopify variant',weeklyDemand:num(row.weekly_velocity),highWeeklyDemand:saved.highWeeklyDemand??'',leadWeeks:saved.leadWeeks??'',onHand:num(row.on_hand),inbound:num(row.incoming),allocated:num(row.committed),landedCost:saved.landedCost??'',moq:saved.moq??0,depositPct:saved.depositPct??100,source:'SHOPIFY',capturedAt:row.captured_at};
  });
}
function reorderCard(item,index,forecastHeadroom){
  const result=reorderIntelligence({...item,highWeeklyDemand:item.highWeeklyDemand===''?item.weeklyDemand:item.highWeeklyDemand,leadWeeks:item.leadWeeks,landedCost:item.landedCost,moq:item.moq});
  const gate=reorderCashGate(result,{forecastHeadroom,depositPct:item.depositPct});
  const severity=result.severity==='critical'?'bad':result.reviewTriggered?'warn':'good';
  const statusLabel=!result.weeklyDemand?'NEEDS VELOCITY':!num(item.leadWeeks)?'ADD LEAD TIME':result.severity==='critical'?'URGENT REVIEW':result.reviewTriggered?'REVIEW':'HEALTHY';
  const gateTone=gate.status==='fail'?'bad':'warn';
  const gateLabel=gate.status==='unknown'?'CASH GATE NEEDS FORECAST':gate.passes?'REORDER NEEDS REVIEW':'CASH GATE FAILS';
  const cashCopy=!num(item.landedCost)
    ?'Add landed cost to cash-gate the reorder.'
    :gate.status==='unknown'
      ?`At ${num(item.depositPct)}% deposit, modeled cash due now is ${money2(gate.cashDueNow)}. Save a 13-week cash forecast before treating this reorder as cash-safe or cash-blocked.`
      :`At ${num(item.depositPct)}% deposit, modeled cash due now is ${money2(gate.cashDueNow)} and would leave ${money2(gate.remainingHeadroom)} against the forecast's lowest headroom.`;
  return `<article class="v2ReorderCard" data-reorder-index="${index}">
    <div class="v2ReorderTop"><div><span class="kicker">${esc(item.source)} · ${esc(item.sku)}</span><h3>${esc(item.label)}</h3></div>${badge(statusLabel,severity)}</div>
    <div class="v2ReorderMetrics">
      <div><small>AVAILABLE / ON HAND</small><b>${Math.max(0,Math.round(num(item.onHand)-num(item.allocated)))} / ${Math.round(num(item.onHand))}</b></div>
      <div><small>WEEKLY VELOCITY</small><b>${num(item.weeklyDemand).toFixed(1)}</b></div>
      <div><small>WEEKS COVER</small><b>${Number.isFinite(result.onHandWeeksCover)?result.onHandWeeksCover.toFixed(1):'—'}</b></div>
      <div><small>REORDER POINT</small><b>${num(item.leadWeeks)?Math.ceil(result.reorderPoint):'—'}</b></div>
      <div><small>REVIEW QTY</small><b>${result.reviewTriggered?result.reviewQuantity:'—'}</b></div>
      <div><small>CASH TO REVIEW</small><b>${result.reviewTriggered&&num(item.landedCost)?money(result.reviewCashRequired):'—'}</b></div>
    </div>
    <div class="v2ReorderInputs">
      <label><span>Supplier lead time · weeks</span><input type="number" step=".1" data-reorder-field="leadWeeks" value="${esc(item.leadWeeks)}"></label>
      <label><span>High-week demand</span><input type="number" step=".1" data-reorder-field="highWeeklyDemand" placeholder="${num(item.weeklyDemand).toFixed(1)}" value="${esc(item.highWeeklyDemand)}"></label>
      <label><span>MOQ</span><input type="number" step="1" data-reorder-field="moq" value="${num(item.moq)}"></label>
      <label><span>Landed cost / unit</span><input type="number" step=".01" data-reorder-field="landedCost" value="${esc(item.landedCost)}"></label>
      <label><span>Deposit %</span><input type="number" step="1" min="0" max="100" data-reorder-field="depositPct" value="${num(item.depositPct)}"></label>
      <button class="outline" data-v2-action="reorder-recalc" data-reorder-index="${index}">Recalculate</button>
    </div>
    ${result.reviewTriggered?`<div class="v2ReorderDecision ${gateTone}"><b>${gateLabel}</b><p>${esc(result.note)} ${cashCopy}</p></div>`:''}
  </article>`;
}
function renderReorderView(){
  const demo=mode().startsWith('demo'),items=demo?foundryReorderItems():inventoryToReorderItems();
  const hasCashForecast=demo||Boolean(v2State.forecastId);
  const forecast=hasCashForecast&&v2State.forecast?analysisOfForecast(v2State.forecast):null,headroom=forecast?.minimumHeadroom??null;
  const body=!items.length?empty('No live inventory source yet','Connect Shopify to pull variant-level inventory and velocity automatically. Until then, the existing Inventory & Reorder calculator still works for manual scenarios.',`<div class="split"><button class="primary" data-v2-view="integrations">Open Integrations</button><button class="outline" data-v2-action="inventory-core">Manual inventory calculator</button></div>`):`<div class="v2Toolbar">${demo?source('FOUNDRY EIGHT · DEMO'):brandSelector('reorderBrand')}<div>${forecast?badge(`CASH FLOOR HEADROOM ${money(headroom)}`,headroom<0?'bad':'good'):badge('NO SAVED CASH FORECAST','warn')}</div></div><div class="v2ReorderStack">${items.map((item,index)=>reorderCard(item,index,headroom)).join('')}</div>`;
  return shell('OPERATING INTELLIGENCE','Reorder Intelligence','Know which size/SKU needs attention, how much stock is positioned, what the supplier will require, and whether your cash can absorb the move.',body,badge('SOURCE-AWARE','signal'));
}

function alertsFromCurrent(){
  const demo=mode().startsWith('demo'),hasCashForecast=demo||Boolean(v2State.forecastId);
  const forecast=hasCashForecast&&v2State.forecast?analysisOfForecast(v2State.forecast):null;
  const items=demo?foundryReorderItems():inventoryToReorderItems();
  const reorders=items.map(item=>({sku:item.sku,label:item.label,result:reorderIntelligence({...item,highWeeklyDemand:item.highWeeklyDemand===''?item.weeklyDemand:item.highWeeklyDemand})}));
  return buildOperatingAlerts({forecast,reorders});
}
function renderAlerts(){
  const alerts=alertsFromCurrent();
  const cards=alerts.length?alerts.map((alert,index)=>`<article class="v2Alert ${alert.severity}"><div class="v2AlertCode">${String(index+1).padStart(2,'0')}</div><section><div class="v2AlertTop">${badge(alert.severity.toUpperCase(),alert.severity==='critical'?'bad':'warn')}<span>${esc(alert.type.replaceAll('_',' ').toUpperCase())}</span></div><h3>${esc(alert.title)}</h3><p>${esc(alert.detail)}</p></section></article>`).join(''):empty('No modeled operating alerts','Brand OS only raises an alert when the numbers you supplied or synced cross a rule. No fake warnings are invented to make the dashboard look busy.');
  return shell('OPERATING INTELLIGENCE','Operating Alerts','One queue for the decisions that can cost the brand money: cash-floor breaches, late reorder windows, and eventually acquisition efficiency from connected ad platforms.',`<div class="v2AlertSummary"><div><span>OPEN SIGNALS</span><b>${alerts.length}</b></div><div><span>CRITICAL</span><b>${alerts.filter(x=>x.severity==='critical').length}</b></div><div><span>WARNING</span><b>${alerts.filter(x=>x.severity==='warning').length}</b></div></div><div class="v2AlertStack">${cards}</div>`,badge('RULE-BASED · EVIDENCE BACKED','signal'));
}

function providerCard(key,name,description,connection){
  const config=v2State.providerConfig?.providers?.[key];
  const connected=Boolean(connection&&connection.status!=='disconnected');
  const status=connected?connection.status==='needs_attention'?badge('NEEDS ATTENTION','warn'):badge('CONNECTED','good'):config?.configured?badge('READY TO CONNECT','signal'):badge(key==='shopify'?'SETUP REQUIRED':'FRAMEWORK READY','neutral');
  let action='';
  if(key==='shopify'&&connected)action=`<div class="v2ProviderActions"><button class="primary" data-v2-action="shopify-sync">Sync now</button><button class="outline" data-v2-action="disconnect" data-provider="shopify">Disconnect</button></div>`;
  else if(key==='shopify'&&config?.configured)action=`<div class="v2ConnectFields"><input id="shopifyDomain" placeholder="your-store.myshopify.com"><button class="primary" data-v2-action="shopify-connect">Connect Shopify</button></div>`;
  else if(key==='shopify')action=`<div class="v2ProviderNote">Shopify OAuth credentials are not configured on this deployment yet. Brand OS will not fake a connection.</div>`;
  else action=`<div class="v2ProviderNote">Connector architecture is prepared. OAuth/reporting goes live only after the provider app, permissions and review requirements are configured.</div>`;
  return `<article class="v2Provider"><div class="v2ProviderLogo">${key==='shopify'?'S':key==='meta'?'M':key==='tiktok'?'T':'K'}</div><section><div class="v2ProviderTitle"><div><h3>${esc(name)}</h3><p>${esc(description)}</p></div>${status}</div>${connection?`<div class="v2ConnectionMeta"><span>${esc(connection.externalAccountName||connection.externalAccountId||'Connected account')}</span><span>Last sync: ${connection.lastSyncedAt?new Date(connection.lastSyncedAt).toLocaleString():'Not synced yet'}</span></div>`:''}${action}</section></article>`;
}
function renderIntegrations(){
  const connectionFor=provider=>v2State.connections.find(connection=>connection.provider===provider&&(!v2State.brandId||connection.brandId===v2State.brandId));
  return shell('DATA LAYER','Integrations Center','Replace repetitive manual entry with source-aware store and marketing data. Connections are brand-scoped and provider tokens stay encrypted server-side.',`
    <div class="v2Toolbar">${brandSelector('integrationBrand')}<span class="v2Privacy">NO CUSTOMER PII NEEDED FOR OPERATING METRICS</span></div>
    <div class="v2ProviderStack">
      ${providerCard('shopify','Shopify','Orders, refunds, discounts, products, inventory and variant velocity.',connectionFor('shopify'))}
      ${providerCard('meta','Meta Ads','Spend and performance signals for acquisition guardrails.',connectionFor('meta'))}
      ${providerCard('tiktok','TikTok Ads','Paid acquisition spend and performance signals.',connectionFor('tiktok'))}
      ${providerCard('klaviyo','Klaviyo','Campaign and flow performance for owned-channel economics.',connectionFor('klaviyo'))}
    </div>
    <div class="v2Decision"><div>i</div><section><b>Source-aware by design.</b><p>Shopify observations do not overwrite founder-maintained SKU assumptions. Meta/TikTok attribution will be shown as provider-reported performance, not treated as guaranteed causal truth.</p></section></div>
  `,badge('ENCRYPTED · SERVER SIDE','signal'));
}

function flash(message,tone='neutral'){
  let el=$('#v2Flash');if(!el){el=document.createElement('div');el.id='v2Flash';document.body.appendChild(el)}
  el.className=`v2Flash ${tone}`;el.textContent=message;el.classList.add('show');clearTimeout(flash.timer);flash.timer=setTimeout(()=>el.classList.remove('show'),3600);
}
async function loadOperatingData(){
  if(!v2State.brandId)return;
  try{v2State.operatingData=await api(`/api/v2/operating-data?brand_id=${encodeURIComponent(v2State.brandId)}`)}catch(error){if(error.code==='V2_STORAGE_NOT_READY'){v2State.operatingData={inventory:[],daily:[],alerts:[]};flash('V2 cloud storage is not enabled on this preview yet.','warn')}else throw error}
}
async function loadIntegrationData(){
  v2State.providerConfig=await api('/api/v2/integrations/config',{auth:false}).catch(()=>({providers:{}}));
  try{const data=await api('/api/v2/integrations');v2State.connections=data.connections||[]}catch(error){if(error.code==='V2_STORAGE_NOT_READY'){v2State.connections=[];flash('V2 connection storage is not enabled on this preview yet.','warn')}else throw error}
}
async function chooseDefaultBrand(){await ensureBrands();if(!v2State.brandId&&brands.length)v2State.brandId=brands[0].id}

async function renderForecastView(){
  const access=await ensureAccount();
  if(!access.pro){app().innerHTML=gateScreen('13-Week Cash Forecast','See when inventory, marketing and operating commitments threaten liquidity before the money leaves your account.');return}
  if(access.demo){v2State.forecast=demoForecast();v2State.forecastId=null;app().innerHTML=renderForecastEditor();return}
  await chooseDefaultBrand();if(!brands.length){app().innerHTML=brandNeeded('13-Week Cash Forecast');return}
  await loadForecastForBrand();app().innerHTML=renderForecastEditor();track('cash_forecast_opened',{brand_id:v2State.brandId});
}
async function renderReorder(){
  const access=await ensureAccount();
  if(!access.pro){app().innerHTML=gateScreen('Reorder Intelligence','Turn store velocity, supplier lead time, MOQ and operating cash into a reorder review signal.');return}
  if(access.demo){v2State.forecast=demoForecast();app().innerHTML=renderReorderView();return}
  await chooseDefaultBrand();if(!brands.length){app().innerHTML=brandNeeded('Reorder Intelligence');return}
  await Promise.all([loadOperatingData(),loadForecastForBrand()]);app().innerHTML=renderReorderView();track('reorder_review_opened',{brand_id:v2State.brandId});
}
async function renderAlertView(){
  const access=await ensureAccount();if(!access.pro){app().innerHTML=gateScreen('Operating Alerts','Surface the decisions that need attention without filling the dashboard with fake KPIs.');return}
  if(access.demo){v2State.forecast=demoForecast();app().innerHTML=renderAlerts();return}
  await chooseDefaultBrand();if(!brands.length){app().innerHTML=brandNeeded('Operating Alerts');return}
  await Promise.all([loadOperatingData(),loadForecastForBrand()]);app().innerHTML=renderAlerts();
}
async function renderIntegrationView(){
  const access=await ensureAccount();if(!access.pro){app().innerHTML=gateScreen('Integrations Center','Automate store, inventory and acquisition data instead of repeatedly entering the same numbers.');return}
  await chooseDefaultBrand();if(!brands.length){app().innerHTML=brandNeeded('Integrations Center');return}
  await loadIntegrationData();app().innerHTML=renderIntegrations();
}
async function renderCurrent(){
  if(!activeView)return;
  title({cashforecast:'Cash Forecast',reorderintel:'Reorder Intelligence',operatingalerts:'Operating Alerts',integrations:'Integrations Center'}[activeView]||'Operating Intelligence');
  app().innerHTML=loading();
  try{
    if(activeView==='cashforecast')await renderForecastView();
    if(activeView==='reorderintel')await renderReorder();
    if(activeView==='operatingalerts')await renderAlertView();
    if(activeView==='integrations')await renderIntegrationView();
  }catch(error){app().innerHTML=shell('OPERATING INTELLIGENCE','Could not load this workspace','The existing Brand OS tools are still available.',`<div class="v2Decision bad"><div>!</div><section><b>${esc(error.message)}</b><p>${error.code?`Code: ${esc(error.code)}`:'Refresh and try again.'}</p></section></div>`)}
}
async function openView(view){activeView=view;activateNav(view);await renderCurrent();window.scrollTo(0,0)}

function updateReorderItem(index,card){
  const items=mode().startsWith('demo')?foundryReorderItems():inventoryToReorderItems();
  const item=items[index];if(!item)return;
  card.querySelectorAll('[data-reorder-field]').forEach(input=>{const key=input.dataset.reorderField;item[key]=input.value===''?'':num(input.value)});
  v2State.reorderInputs.set(item.key,{leadWeeks:item.leadWeeks,highWeeklyDemand:item.highWeeklyDemand,moq:item.moq,landedCost:item.landedCost,depositPct:item.depositPct});
}
async function connectShopify(){
  if(!v2State.brandId)return flash('Choose a brand first.','bad');
  const shop=$('#shopifyDomain')?.value.trim();if(!shop)return flash('Enter your permanent Shopify store domain.','bad');
  try{track('integration_connect_started',{provider:'shopify',brand_id:v2State.brandId});const result=await api('/api/v2/integrations/shopify/connect',{method:'POST',body:{brand_id:v2State.brandId,shop}});location.href=result.url}catch(error){flash(error.message,'bad')}
}
async function syncShopify(){
  try{track('integration_sync_started',{provider:'shopify',brand_id:v2State.brandId});flash('Shopify sync started…');const result=await api('/api/v2/integrations/shopify/sync',{method:'POST',body:{brand_id:v2State.brandId}});track('integration_sync_completed',{provider:'shopify',brand_id:v2State.brandId,partial:result.partial,records_written:result.recordsWritten});await loadIntegrationData();flash(result.partial?'Shopify synced partially — review sync limits.':'Shopify sync complete ✓',result.partial?'warn':'good');renderCurrent()}catch(error){track('integration_sync_failed',{provider:'shopify',brand_id:v2State.brandId,code:error.code||null});flash(error.message,'bad')}
}
async function disconnectProvider(provider){
  if(!confirm(`Disconnect ${provider}? Synced operating snapshots stay in Brand OS, but new data will stop until you reconnect.`))return;
  try{await api(`/api/v2/integrations/${encodeURIComponent(provider)}/${encodeURIComponent(v2State.brandId)}`,{method:'DELETE'});await loadIntegrationData();flash(`${provider} disconnected.`,'good');renderCurrent()}catch(error){flash(error.message,'bad')}
}

// V2 nav uses data-v2-view instead of data-view, so legacy app.js never tries to render an unknown route.
document.addEventListener('click',event=>{
  const v2Button=event.target.closest('[data-v2-view]');
  if(v2Button){event.preventDefault();event.stopPropagation();openView(v2Button.dataset.v2View);return}
  if(event.target.closest('#nav button[data-view],#memoryNav')){activeView=null;$$('[data-v2-view]').forEach(button=>button.classList.remove('active'));return}
  const action=event.target.closest('[data-v2-action]');if(!action)return;
  const type=action.dataset.v2Action;
  if(type==='signin'){$('#authBtn')?.click();return}
  if(type==='upgrade'){$('#billingBtn')?.click();return}
  if(type==='brands'){coreJump('brands');return}
  if(type==='inventory-core'){coreJump('inventory');return}
  if(type==='forecast-recalc'){collectForecastInputs();renderCurrent();return}
  if(type==='forecast-reset'){v2State.forecast=blankForecast();v2State.forecastId=null;renderCurrent();return}
  if(type==='save-forecast'){saveForecast();return}
  if(type==='reorder-recalc'){const card=action.closest('[data-reorder-index]');updateReorderItem(Number(action.dataset.reorderIndex),card);renderCurrent();return}
  if(type==='shopify-connect'){connectShopify();return}
  if(type==='shopify-sync'){syncShopify();return}
  if(type==='disconnect'){disconnectProvider(action.dataset.provider);return}
});

document.addEventListener('change',event=>{
  if(event.target.id==='forecastBrand'||event.target.id==='reorderBrand'||event.target.id==='integrationBrand'){
    v2State.brandId=event.target.value;v2State.forecast=null;v2State.forecastId=null;v2State.operatingData=null;renderCurrent();
  }
});

const callback=new URLSearchParams(location.search).get('integration');
if(callback==='shopify_connected'){flash('Shopify connected. Choose the brand and run your first sync.','good');history.replaceState({},'',location.pathname)}
if(callback==='shopify_error'){flash('Shopify connection did not complete. Open Integrations to retry.','bad');history.replaceState({},'',location.pathname)}
