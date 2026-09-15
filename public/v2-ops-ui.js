import {FOUNDRY_EIGHT} from './math.js';
import {FORECAST_WEEKS,cashForecast,cashForecastScenario,reorderIntelligence,reorderCashGate,buildOperatingAlerts} from './operating-intelligence.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number.isFinite(Number(value))?Number(value):0);
const exactMoney=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(Number(value))?Number(value):0);
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const safeJson=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
const V2_FORECAST_KEY='msbo_v2_cash_forecast';
const V2_REORDER_KEY='msbo_v2_reorder_settings';
const V2_VIEW_KEY='msbo_v2_last_view';

let activeV2=null;
let account=null;
let brands=[];
let skus=[];
let integrationConfig=null;
let connections=[];
let operatingData=null;
let selectedBrandId=localStorage.getItem('msbo_v2_brand_id')||'';
let cloudForecastId=null;
let busy=false;

function readSession(){return safeJson('msbo_session',null)}
function isDemo(){const mode=localStorage.getItem('msbo_mode');return mode==='demo'||mode==='demo-edited'}
function isPro(){return Boolean(account?.active)}
function canUseV2(){return isDemo()||isPro()}
function currentState(){return safeJson('msbo_state',{})}
function closeMenu(){window.msboCloseMenu?.({restoreFocus:false})}

async function v2Api(url,{method='GET',body,auth=true}={}){
  let session=readSession();
  const headers={'Content-Type':'application/json'};
  if(auth&&session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  let response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  if(response.status===401&&auth&&session?.refresh_token){
    const refresh=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    if(refresh.ok){
      const json=await refresh.json();
      session=json.session;
      localStorage.setItem('msbo_session',JSON.stringify(session));
      headers.Authorization=`Bearer ${session.access_token}`;
      response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    }
  }
  const json=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(json.error||`Request failed (${response.status})`);error.status=response.status;error.code=json.code||null;throw error}
  return json;
}

async function track(eventName,properties={}){
  try{await v2Api('/api/events',{method:'POST',body:{event_name:eventName,anonymous_id:localStorage.getItem('msbo_anon_id')||null,properties},auth:Boolean(readSession())})}catch{}
}

function injectNav(){
  const nav=$('#nav');
  if(!nav||$('#v2NavGroup'))return;
  const block=document.createElement('div');
  block.id='v2NavGroup';
  block.innerHTML=`
    <div class="navgroup v2NavLabel">Operating Intelligence <span class="v2Beta">V2</span></div>
    <button type="button" data-v2-view="attention"><span>!</span>Attention Queue</button>
    <button type="button" data-v2-view="forecast"><span>13</span>13-Week Cash Forecast</button>
    <button type="button" data-v2-view="reorder"><span>↻</span>Reorder Intelligence</button>
    <button type="button" data-v2-view="integrations"><span>⎔</span>Integrations</button>`;
  nav.append(...block.childNodes);
}

function setNavActive(view){
  $$('#nav button').forEach(button=>button.classList.toggle('active',button.dataset.v2View===view));
}

function viewTitle(view){return ({attention:'Attention Queue',forecast:'13-Week Cash Forecast',reorder:'Reorder Intelligence',integrations:'Integrations'})[view]||'Operating Intelligence'}

function sourceChip(text,kind='neutral'){return `<span class="v2Chip ${kind}">${escapeHtml(text)}</span>`}
function callout(title,text,kind='neutral'){return `<div class="v2Callout ${kind}"><b>${escapeHtml(title)}</b><p>${escapeHtml(text)}</p></div>`}
function metric(label,value,note='',kind=''){return `<div class="v2Metric ${kind}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong>${note?`<span>${escapeHtml(note)}</span>`:''}</div>`}
function empty(title,text){return `<div class="v2Empty"><b>${escapeHtml(title)}</b><p>${escapeHtml(text)}</p></div>`}

function gateMarkup(){
  if(isDemo())return '';
  if(!readSession())return `<div class="v2Gate"><span class="kicker">OPERATING INTELLIGENCE</span><h2>Sign in to use the live operating layer.</h2><p>The original calculators still work locally. Forecasting, synced data, alerts and saved operating intelligence use your account.</p><button class="primary" data-v2-auth>Sign in</button></div>`;
  if(!isPro())return `<div class="v2Gate"><span class="kicker">BRAND OS PRO</span><h2>Operating Intelligence is part of Pro.</h2><p>Use cash forecasting, reorder intelligence, integrations and alerts as one connected operating layer.</p><div class="v2Price">$19<span>/month</span></div><p class="mini">Cancel anytime.</p><button class="primary" data-v2-upgrade>Upgrade to Pro · $19/mo</button></div>`;
  return '';
}

async function refreshIdentity(){
  const session=readSession();
  if(!session){account=null;brands=[];skus=[];return}
  try{
    const [acct,brandData,skuData]=await Promise.all([
      v2Api('/api/account'),v2Api('/api/brands'),v2Api('/api/skus')
    ]);
    account=acct;brands=brandData.brands||[];skus=skuData.skus||[];
    if(!selectedBrandId&&brands[0])selectedBrandId=brands[0].id;
    if(selectedBrandId&&!brands.some(brand=>String(brand.id)===String(selectedBrandId)))selectedBrandId=brands[0]?.id||'';
    if(selectedBrandId)localStorage.setItem('msbo_v2_brand_id',selectedBrandId);
  }catch(error){if(error.status===401){account=null;brands=[];skus=[]}}
}

async function loadV2Cloud(){
  integrationConfig=await fetch('/api/v2/integrations/config').then(response=>response.ok?response.json():null).catch(()=>null);
  connections=[];operatingData=null;cloudForecastId=null;
  if(!isPro()||!selectedBrandId)return;
  try{connections=(await v2Api('/api/v2/integrations')).connections||[]}catch(error){if(error.code!=='V2_STORAGE_NOT_READY')console.warn('v2-integrations',error)}
  try{
    operatingData=await v2Api(`/api/v2/operating-data?brand_id=${encodeURIComponent(selectedBrandId)}`);
    cloudForecastId=operatingData?.forecast?.id||null;
    if(operatingData?.forecast?.weeks?.length){
      const cloud={name:operatingData.forecast.name,startingCash:number(operatingData.forecast.starting_cash),protectedFloor:number(operatingData.forecast.protected_floor),weeks:operatingData.forecast.weeks};
      localStorage.setItem(V2_FORECAST_KEY,JSON.stringify(cloud));
    }
  }catch(error){if(error.code!=='V2_STORAGE_NOT_READY')console.warn('v2-operating-data',error)}
}

function blankWeeks(){return Array.from({length:FORECAST_WEEKS},(_,index)=>({label:`Week ${index+1}`,dtcPayouts:0,wholesaleReceipts:0,otherInflows:0,factoryDeposits:0,factoryBalances:0,freightDuty:0,marketing:0,payrollContractors:0,softwareRent:0,taxesDebt:0,otherOutflows:0}))}
function forecastDraft(){
  const saved=safeJson(V2_FORECAST_KEY,null);
  if(saved?.weeks?.length)return {...saved,weeks:Array.from({length:FORECAST_WEEKS},(_,i)=>({...blankWeeks()[i],...(saved.weeks[i]||{})}))};
  const state=currentState();
  return {name:'13-week forecast',startingCash:number(state.cashStart),protectedFloor:number(state.protectedFloor),weeks:blankWeeks()};
}
function saveForecastDraft(draft){localStorage.setItem(V2_FORECAST_KEY,JSON.stringify(draft))}

function forecastSummary(draft){
  const base=cashForecast(draft);
  const downside=cashForecastScenario(draft,{inflowMultiplier:.8,marketingMultiplier:1.15});
  return {base,downside};
}

function forecastView(){
  const gate=gateMarkup();if(gate)return gate;
  const draft=forecastDraft(),{base,downside}=forecastSummary(draft);
  const baseKind=base.passes?'good':'bad',downKind=downside.passes?'good':'bad';
  const breach=base.firstBreachWeek?`Week ${base.firstBreachWeek} · ${money(base.firstBreachAmount)} below floor`:'No modeled floor breach';
  return `<div class="v2Page">
    <div class="v2Hero"><div><span class="kicker">PROTECT CASH · 13 WEEKS</span><h2>See the cash problem before the bank balance shows it.</h2><p>Plan expected cash movement week by week. This is an operating forecast, not accounting or a guarantee of future receipts.</p></div><div class="v2HeroActions">${sourceChip(isDemo()?'DEMO / MANUAL':'MANUAL + CONNECTED DATA','live')}<button class="ghost" data-v2-reset-forecast>Reset forecast</button></div></div>
    <div class="v2MetricGrid">
      ${metric('Ending cash',money(base.endingCash),'Base case',baseKind)}
      ${metric('Lowest headroom',money(base.minimumHeadroom),`Week ${base.minimumWeek||'—'}`,baseKind)}
      ${metric('First floor breach',base.firstBreachWeek?`Week ${base.firstBreachWeek}`:'None',breach,baseKind)}
      ${metric('Downside ending cash',money(downside.endingCash),'80% inflows · 115% marketing',downKind)}
    </div>
    <div class="v2Panel">
      <div class="v2PanelHead"><div><span class="kicker">FORECAST CONTROLS</span><h3>Cash starting point</h3></div><div class="v2SaveState" id="v2ForecastSaveState">Saved on this device</div></div>
      <div class="v2FormGrid v2ForecastTop">
        <label>Forecast name<input id="v2ForecastName" type="text" maxlength="160" value="${escapeHtml(draft.name||'13-week forecast')}"></label>
        <label>Starting cash<input id="v2StartingCash" type="number" step="0.01" value="${number(draft.startingCash)}"></label>
        <label>Protected cash floor<input id="v2ProtectedFloor" type="number" min="0" step="0.01" value="${number(draft.protectedFloor)}"></label>
      </div>
      <div class="v2ForecastLegend"><span>INFLOWS</span><span>OUTFLOWS</span><span>Each week closes into the next week automatically.</span></div>
      <div class="v2TableWrap"><table class="v2ForecastTable"><thead><tr><th>Week</th><th>DTC payouts</th><th>Wholesale</th><th>Other in</th><th>Factory deposit</th><th>Factory balance</th><th>Freight / duty</th><th>Marketing</th><th>Payroll</th><th>Overhead</th><th>Taxes / debt</th><th>Other out</th><th>Closing cash</th><th>Headroom</th></tr></thead><tbody>
        ${base.weeks.map((row,index)=>`<tr class="${row.belowFloor?'v2BreachRow':''}"><td><input data-v2-week="${index}" data-v2-week-key="label" value="${escapeHtml(draft.weeks[index].label||`Week ${index+1}`)}" aria-label="Week ${index+1} label"></td>${['dtcPayouts','wholesaleReceipts','otherInflows','factoryDeposits','factoryBalances','freightDuty','marketing','payrollContractors','softwareRent','taxesDebt','otherOutflows'].map(key=>`<td><input data-v2-week="${index}" data-v2-week-key="${key}" type="number" min="0" step="0.01" value="${number(draft.weeks[index][key])}" aria-label="${key} week ${index+1}"></td>`).join('')}<td class="v2Money">${money(row.closingCash)}</td><td class="v2Money ${row.headroom<0?'badText':'goodText'}">${money(row.headroom)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="v2ActionRow"><button class="primary" data-v2-save-forecast>${isPro()?'Save forecast to Brand OS':'Save forecast'}</button><span class="mini">Downside scenario automatically stress-tests 20% lower operating inflows and 15% higher marketing.</span></div>
    </div>
    ${base.firstBreachWeek?callout('Cash floor at risk',`Base case falls below your protected floor in Week ${base.firstBreachWeek}. The modeled shortfall is ${money(base.firstBreachAmount)}. Review PO timing, marketing, payroll and expected receipts before committing more cash.`,'bad'):callout('Base case stays above your floor','No protected-floor breach is modeled across the 13-week base case. Keep updating actual receipts and obligations each week.','good')}
  </div>`;
}

function localReorderSettings(){return safeJson(V2_REORDER_KEY,{})}
function saveReorderSettings(value){localStorage.setItem(V2_REORDER_KEY,JSON.stringify(value))}
function itemKey(item){return item.external_variant_id?`shopify:${item.external_variant_id}`:item.id?`sku:${item.id}`:`local:${item.sku_code||item.sku||item.product_name||'item'}`}
function selectedBrand(){return brands.find(brand=>String(brand.id)===String(selectedBrandId))||null}

function reorderItems(){
  if(isDemo())return [{id:'foundry-demo',sku_code:'FE-HOODIE',product_name:'Foundry Eight Core Hoodie',on_hand:FOUNDRY_EIGHT.onHand,incoming:FOUNDRY_EIGHT.inbound,committed:FOUNDRY_EIGHT.allocated,weekly_velocity:FOUNDRY_EIGHT.weeklyDemand,landed_cost:FOUNDRY_EIGHT.landedCost,demo:true}];
  if(operatingData?.inventory?.length)return operatingData.inventory;
  return skus.filter(item=>!selectedBrandId||String(item.brand_id)===String(selectedBrandId)).map(item=>({...item,sku_code:item.sku,product_name:item.name,incoming:0,committed:0,weekly_velocity:0}));
}

function reorderModelFor(item,settings){
  const demo=item.demo;
  const defaults=demo?{leadWeeks:FOUNDRY_EIGHT.leadWeeks,highWeeklyDemand:FOUNDRY_EIGHT.highWeeklyDemand,moq:0,depositPct:50,landedCost:FOUNDRY_EIGHT.landedCost}:{};
  const config={...defaults,...settings};
  return reorderIntelligence({
    weeklyDemand:number(config.weeklyDemand??item.weekly_velocity),
    highWeeklyDemand:number(config.highWeeklyDemand??item.weekly_velocity),leadWeeks:number(config.leadWeeks),
    onHand:number(item.on_hand),inbound:number(config.inbound??item.incoming),allocated:number(config.allocated??item.committed),
    landedCost:number(config.landedCost??item.landed_cost),moq:number(config.moq)
  });
}

function reorderView(){
  const gate=gateMarkup();if(gate)return gate;
  const settings=localReorderSettings(),items=reorderItems();
  if(!items.length)return `<div class="v2Page"><div class="v2Hero"><div><span class="kicker">REORDER INTELLIGENCE</span><h2>Demand first. Cash second. PO last.</h2><p>Brand OS will never treat a reorder point as an automatic purchase order.</p></div></div>${empty('No SKU data yet','Add saved SKUs, load the Foundry Eight demo, or connect Shopify. Reorder intelligence needs inventory plus a sales pace and supplier lead time.')}</div>`;
  const draft=forecastDraft(),forecast=cashForecast(draft);
  return `<div class="v2Page">
    <div class="v2Hero"><div><span class="kicker">INVENTORY · CASH · SUPPLIER TIME</span><h2>Know which SKU deserves a reorder review—and whether cash can support it.</h2><p>Synced inventory is an observation. Lead time, MOQ and supplier terms remain founder-controlled planning inputs.</p></div><div>${sourceChip(operatingData?.inventory?.length?'SHOPIFY OBSERVATION':isDemo()?'FOUNDRY EIGHT DEMO':'SAVED SKU DATA','live')}</div></div>
    <div class="v2MetricGrid">${metric('SKUs analyzed',String(items.length),'Current selected source')}${metric('Cash headroom',money(forecast.minimumHeadroom),'Lowest point in current 13-week forecast',forecast.minimumHeadroom>=0?'good':'bad')}${metric('Review triggers',String(items.filter(item=>reorderModelFor(item,settings[itemKey(item)]||{}).reviewTriggered).length),'Not automatic POs')}${metric('Urgent stock risk',String(items.filter(item=>reorderModelFor(item,settings[itemKey(item)]||{}).likelyRunsOutBeforeReplenishment).length),'Cover ≤ lead time')}</div>
    <div class="v2ItemStack">${items.map(item=>{
      const key=itemKey(item),config=settings[key]||{},result=reorderModelFor(item,config),depositPct=number(config.depositPct??50),gateResult=reorderCashGate(result,{forecastHeadroom:forecast.minimumHeadroom,depositPct});
      const severity=result.severity==='critical'?'bad':result.reviewTriggered?'warn':'good';
      return `<article class="v2ReorderCard" data-v2-item="${escapeHtml(key)}"><div class="v2ReorderHead"><div><div class="v2ItemId">${escapeHtml(item.sku_code||'NO SKU')}</div><h3>${escapeHtml(item.product_name||'Unnamed product')}</h3></div>${sourceChip(result.reviewTriggered?(result.severity==='critical'?'URGENT REVIEW':'REVIEW'):'ABOVE REVIEW POINT',severity)}</div>
        <div class="v2MetricGrid compact">${metric('Inventory position',`${Math.ceil(result.inventoryPosition)} units`,'On hand + inbound − allocated')}${metric('Review point',`${Math.ceil(result.reorderPoint)} units`,'Lead-time demand + high-demand reserve')}${metric('On-hand cover',Number.isFinite(result.onHandWeeksCover)?`${result.onHandWeeksCover.toFixed(1)} wk`:'—','Using observed/planned weekly demand')}${metric('Review quantity',result.reviewTriggered?`${result.reviewQuantity} units`:'0 units',result.reviewTriggered?'Before cash/MOQ judgment':'No reorder review triggered')}</div>
        <div class="v2FormGrid v2ReorderInputs">
          <label>Weekly demand<input data-v2-plan="weeklyDemand" type="number" min="0" step="0.01" value="${number(config.weeklyDemand??item.weekly_velocity)}"></label>
          <label>High-demand week<input data-v2-plan="highWeeklyDemand" type="number" min="0" step="0.01" value="${number(config.highWeeklyDemand??(item.demo?FOUNDRY_EIGHT.highWeeklyDemand:item.weekly_velocity))}"></label>
          <label>Supplier lead time (weeks)<input data-v2-plan="leadWeeks" type="number" min="0" step="0.1" value="${number(config.leadWeeks??(item.demo?FOUNDRY_EIGHT.leadWeeks:0))}"></label>
          <label>MOQ<input data-v2-plan="moq" type="number" min="0" step="1" value="${number(config.moq)}"></label>
          <label>Landed cost / unit<input data-v2-plan="landedCost" type="number" min="0" step="0.01" value="${number(config.landedCost??item.landed_cost)}"></label>
          <label>Deposit due now %<input data-v2-plan="depositPct" type="number" min="0" max="100" step="1" value="${depositPct}"></label>
        </div>
        <div class="v2Decision ${gateResult.passes?'good':'bad'}"><div><small>CASH-GATED REVIEW</small><b>${result.reviewTriggered?(gateResult.passes?'CASH CAN SUPPORT MODELED DEPOSIT':'HOLD / CHANGE TERMS'):'NO PO REVIEW NEEDED'}</b></div><div>${result.reviewTriggered?`${exactMoney(gateResult.cashDueNow)} due now · ${exactMoney(gateResult.remainingHeadroom)} headroom after modeled deposit`:'Inventory position is above the current review point.'}</div></div>
        <p class="mini">${escapeHtml(result.note)} ${result.reviewTriggered?escapeHtml(gateResult.note):''}</p>
      </article>`;
    }).join('')}</div>
  </div>`;
}

function computedLocalAlerts(){
  const draft=forecastDraft(),forecast=cashForecast(draft),settings=localReorderSettings();
  const reorders=reorderItems().map(item=>({sku:item.sku_code||item.sku,label:item.product_name||item.name||item.sku_code,result:reorderModelFor(item,settings[itemKey(item)]||{})}));
  return buildOperatingAlerts({forecast,reorders});
}
function alertCard(alert){
  const kind=alert.severity==='critical'?'bad':alert.severity==='warning'?'warn':'neutral';
  return `<article class="v2Alert ${kind}"><div class="v2AlertTop">${sourceChip(alert.severity.toUpperCase(),kind)}<span>${escapeHtml(alert.type.replaceAll('_',' ').toUpperCase())}</span></div><h3>${escapeHtml(alert.title)}</h3><p>${escapeHtml(alert.detail)}</p></article>`;
}
function attentionView(){
  const gate=gateMarkup();if(gate)return gate;
  const localAlerts=computedLocalAlerts();
  const cloud=(operatingData?.alerts||[]).map(row=>({type:row.alert_type,severity:row.severity,title:row.title,detail:row.detail}));
  const deduped=[...localAlerts,...cloud].filter((alert,index,array)=>array.findIndex(candidate=>candidate.type===alert.type&&candidate.title===alert.title)===index);
  const critical=deduped.filter(alert=>alert.severity==='critical').length,warnings=deduped.filter(alert=>alert.severity==='warning').length;
  return `<div class="v2Page"><div class="v2Hero"><div><span class="kicker">COMMAND CENTER · ATTENTION QUEUE</span><h2>Start with what can cost you money.</h2><p>Brand OS ranks modeled cash, inventory and acquisition risks. Alerts explain evidence; they do not automatically spend, order inventory or claim causation.</p></div><div>${sourceChip(deduped.length?`${deduped.length} OPEN SIGNAL${deduped.length===1?'':'S'}`:'NO OPEN SIGNALS',deduped.length?'warn':'good')}</div></div>
    <div class="v2MetricGrid">${metric('Critical',String(critical),'Needs review first',critical?'bad':'good')}${metric('Watch',String(warnings),'Review before committing cash',warnings?'warn':'good')}${metric('Forecast window','13 weeks','Current operating model')}${metric('Data mode',operatingData?'CONNECTED + MANUAL':isDemo()?'DEMO':'MANUAL','Source-aware')}</div>
    <div class="v2AlertStack">${deduped.length?deduped.map(alertCard).join(''):empty('Nothing is currently flagged','That does not mean the business is risk-free. Complete the cash forecast, enter supplier lead times, or connect live store data to give Brand OS more evidence.')}</div>
    <div class="v2ActionGrid"><button class="v2ActionCard" data-v2-jump="forecast"><span>01</span><b>Stress-test cash</b><small>See the first week your plan crosses the floor.</small></button><button class="v2ActionCard" data-v2-jump="reorder"><span>02</span><b>Review inventory</b><small>Pair sales velocity with lead time and cash.</small></button><button class="v2ActionCard" data-v2-jump="integrations"><span>03</span><b>Connect data</b><small>Reduce manual entry and keep signals current.</small></button></div>
  </div>`;
}

function brandSelect(){
  if(!brands.length)return '<option value="">Add a brand first</option>';
  return brands.map(brand=>`<option value="${escapeHtml(brand.id)}" ${String(brand.id)===String(selectedBrandId)?'selected':''}>${escapeHtml(brand.name)}</option>`).join('');
}
function connectionFor(provider){return connections.find(connection=>connection.provider===provider&&String(connection.brandId)===String(selectedBrandId))||null}
function providerCard(provider,label,description){
  const config=integrationConfig?.providers?.[provider],connection=connectionFor(provider),configured=Boolean(config?.configured);
  const status=connection?.status||(!configured?'setup_required':'not_connected');
  const kind=status==='connected'?'good':status==='needs_attention'?'warn':'neutral';
  const statusLabel=status==='connected'?'CONNECTED':status==='needs_attention'?'NEEDS ATTENTION':status==='disconnected'?'DISCONNECTED':configured?'READY TO CONNECT':'ADMIN SETUP REQUIRED';
  const details=provider==='shopify'?'Orders · refunds · products · inventory':provider==='meta'?'Ad spend · delivery · attributed performance':provider==='tiktok'?'Ad spend · delivery · attributed performance':'Campaign + flow performance';
  return `<article class="v2Provider"><div class="v2ProviderTop"><div><div class="v2ProviderLogo">${escapeHtml(label.slice(0,1))}</div><div><h3>${escapeHtml(label)}</h3><p>${escapeHtml(description)}</p></div></div>${sourceChip(statusLabel,kind)}</div><div class="v2ProviderDetails">${escapeHtml(details)}</div>${connection?`<div class="v2Connection"><b>${escapeHtml(connection.externalAccountName||connection.externalAccountId||label)}</b><span>Last sync: ${connection.lastSyncedAt?new Date(connection.lastSyncedAt).toLocaleString():'Never'}</span></div>`:''}<div class="v2ActionRow">${provider==='shopify'?shopifyActions(configured,connection):`<button class="outline" disabled>${configured?'Connection flow in V2 build':'Configure provider app first'}</button>`}</div></article>`;
}
function shopifyActions(configured,connection){
  if(!configured)return '<button class="outline" disabled>Configure Shopify app first</button>';
  if(connection?.status==='connected'||connection?.status==='needs_attention')return `<button class="primary" data-v2-shopify-sync>Sync Shopify now</button><button class="ghost" data-v2-shopify-disconnect>Disconnect</button>`;
  return `<input id="v2ShopDomain" class="v2InlineInput" placeholder="your-store.myshopify.com" autocomplete="off"><button class="primary" data-v2-shopify-connect>Connect Shopify</button>`;
}
function integrationsView(){
  const gate=gateMarkup();if(gate)return gate;
  return `<div class="v2Page"><div class="v2Hero"><div><span class="kicker">CONNECT DATA · KEEP CONTROL</span><h2>Replace recurring manual entry with source-aware data.</h2><p>Brand OS stores only the operating data it needs. Provider credentials stay encrypted server-side and never enter browser storage.</p></div><div>${sourceChip(selectedBrand()?.name||'SELECT BRAND','live')}</div></div>
    <div class="v2Panel"><div class="v2PanelHead"><div><span class="kicker">DATA OWNER</span><h3>Which brand are you connecting?</h3></div></div><label class="v2BrandSelect">Brand<select id="v2BrandSelect">${brandSelect()}</select></label></div>
    <div class="v2ProviderGrid">${providerCard('shopify','Shopify','Storefront commerce + inventory')}${providerCard('meta','Meta Ads','Paid social acquisition')}${providerCard('tiktok','TikTok Ads','Paid social acquisition')}${providerCard('klaviyo','Klaviyo','Owned-channel marketing')}</div>
    ${callout('Source-aware by design','Shopify observations do not overwrite your saved SKU assumptions. Brand OS keeps live source data, founder planning inputs and calculated recommendations separate so you can tell what came from where.','good')}
    <div class="v2SecurityGrid"><div><b>No browser tokens</b><span>Access and refresh tokens are encrypted server-side.</span></div><div><b>PII minimized</b><span>Operating sync does not need customer names, emails or addresses.</span></div><div><b>Partial means partial</b><span>If a sync hits a pagination cap, Brand OS says so instead of claiming completeness.</span></div></div>
  </div>`;
}

async function renderV2(view,{reload=false}={}){
  if(busy)return;
  activeV2=view;localStorage.setItem(V2_VIEW_KEY,view);setNavActive(view);closeMenu();
  if($('#title'))$('#title').textContent=viewTitle(view);
  const app=$('#app');if(!app)return;
  app.innerHTML='<div class="v2Loading"><span></span><b>Loading operating intelligence…</b></div>';
  busy=true;
  try{
    await refreshIdentity();
    if(reload||!integrationConfig)await loadV2Cloud();
    app.innerHTML=({attention:attentionView,forecast:forecastView,reorder:reorderView,integrations:integrationsView})[view]?.()||attentionView();
    bindV2();
    if(view==='forecast')track('cash_forecast_opened');
    if(view==='reorder')track('reorder_review_opened');
  }finally{busy=false}
  window.scrollTo(0,0);
}

function updateForecastFromDom(){
  const draft=forecastDraft();
  draft.name=$('#v2ForecastName')?.value.trim()||'13-week forecast';
  draft.startingCash=number($('#v2StartingCash')?.value);
  draft.protectedFloor=Math.max(0,number($('#v2ProtectedFloor')?.value));
  $$('[data-v2-week]').forEach(input=>{
    const index=Number(input.dataset.v2Week),key=input.dataset.v2WeekKey;
    if(!draft.weeks[index])draft.weeks[index]={};
    draft.weeks[index][key]=key==='label'?input.value:number(input.value);
  });
  saveForecastDraft(draft);return draft;
}
async function saveForecast(){
  const draft=updateForecastFromDom();
  const state=$('#v2ForecastSaveState');if(state)state.textContent='Saving…';
  if(isPro()&&selectedBrandId){
    try{
      const body={brand_id:selectedBrandId,name:draft.name,starting_cash:draft.startingCash,protected_floor:draft.protectedFloor,weeks:draft.weeks};
      const result=cloudForecastId?await v2Api(`/api/v2/cash-forecasts/${encodeURIComponent(cloudForecastId)}`,{method:'PUT',body}):await v2Api('/api/v2/cash-forecasts',{method:'POST',body});
      cloudForecastId=result.forecast?.id||cloudForecastId;
      if(state)state.textContent='Saved to Brand OS ✓';
      track('cash_forecast_saved',{cloud:true,brand_id:selectedBrandId});
    }catch(error){
      if(state)state.textContent=error.code==='V2_STORAGE_NOT_READY'?'Saved on device · cloud migration not enabled yet':`Saved on device · ${error.message}`;
      track('cash_forecast_saved',{cloud:false,code:error.code||'SAVE_FAILED'});
    }
  }else{if(state)state.textContent='Saved on this device ✓';track('cash_forecast_saved',{cloud:false})}
  await renderV2('forecast');
}

function updateReorderItem(card){
  const key=card.dataset.v2Item,all=localReorderSettings(),next={...(all[key]||{})};
  card.querySelectorAll('[data-v2-plan]').forEach(input=>next[input.dataset.v2Plan]=number(input.value));
  all[key]=next;saveReorderSettings(all);renderV2('reorder');
}

async function connectShopify(){
  const shop=$('#v2ShopDomain')?.value.trim();
  if(!selectedBrandId)return alert('Add or choose a brand first.');
  if(!shop)return alert('Enter your permanent myshopify.com store domain.');
  track('integration_connect_started',{provider:'shopify',brand_id:selectedBrandId});
  try{const result=await v2Api('/api/v2/integrations/shopify/connect',{method:'POST',body:{brand_id:selectedBrandId,shop}});location.href=result.url}catch(error){alert(error.message)}
}
async function syncShopify(){
  if(!selectedBrandId)return;
  track('integration_sync_started',{provider:'shopify',brand_id:selectedBrandId});
  const button=$('[data-v2-shopify-sync]');if(button){button.disabled=true;button.textContent='Syncing…'}
  try{const result=await v2Api('/api/v2/integrations/shopify/sync',{method:'POST',body:{brand_id:selectedBrandId}});track('integration_sync_completed',{provider:'shopify',partial:Boolean(result.partial),records:Number(result.recordsWritten)||0});await loadV2Cloud();await renderV2('integrations')}catch(error){track('integration_sync_failed',{provider:'shopify',code:error.code||'SYNC_FAILED'});alert(error.message);if(button){button.disabled=false;button.textContent='Sync Shopify now'}}
}
async function disconnectShopify(){
  if(!selectedBrandId||!confirm('Disconnect Shopify from this brand? Synced historical aggregates will remain, but future syncs stop until you reconnect.'))return;
  try{await v2Api(`/api/v2/integrations/shopify/${encodeURIComponent(selectedBrandId)}`,{method:'DELETE'});await loadV2Cloud();await renderV2('integrations')}catch(error){alert(error.message)}
}

function bindV2(){
  $('[data-v2-auth]')?.addEventListener('click',()=>$('#authBtn')?.click());
  $('[data-v2-upgrade]')?.addEventListener('click',()=>$('#billingBtn')?.click());
  $('[data-v2-reset-forecast]')?.addEventListener('click',()=>{if(confirm('Reset the 13-week forecast on this device?')){localStorage.removeItem(V2_FORECAST_KEY);renderV2('forecast')}});
  $('[data-v2-save-forecast]')?.addEventListener('click',saveForecast);
  $$('[data-v2-week],#v2ForecastName,#v2StartingCash,#v2ProtectedFloor').forEach(input=>input.addEventListener('change',()=>{updateForecastFromDom();renderV2('forecast')}));
  $$('.v2ReorderCard').forEach(card=>card.querySelectorAll('[data-v2-plan]').forEach(input=>input.addEventListener('change',()=>updateReorderItem(card))));
  $$('[data-v2-jump]').forEach(button=>button.addEventListener('click',()=>renderV2(button.dataset.v2Jump)));
  $('#v2BrandSelect')?.addEventListener('change',async event=>{selectedBrandId=event.target.value;localStorage.setItem('msbo_v2_brand_id',selectedBrandId);await loadV2Cloud();renderV2('integrations')});
  $('[data-v2-shopify-connect]')?.addEventListener('click',connectShopify);
  $('[data-v2-shopify-sync]')?.addEventListener('click',syncShopify);
  $('[data-v2-shopify-disconnect]')?.addEventListener('click',disconnectShopify);
}

function handleIntegrationReturn(){
  const url=new URL(location.href),status=url.searchParams.get('integration');
  if(!status)return false;
  url.searchParams.delete('integration');url.searchParams.delete('code');history.replaceState({},'',url.pathname+url.search+url.hash);
  injectNav();
  setTimeout(async()=>{
    await renderV2('integrations',{reload:true});
    if(status==='shopify_connected'){track('integration_connected',{provider:'shopify'});alert('Shopify connected. Run the first sync to bring operating data into Brand OS.')}
    else alert('Shopify could not be connected. Try again from Integrations.');
  },0);
  return true;
}

function boot(){
  injectNav();
  document.addEventListener('click',event=>{
    const v2Button=event.target.closest('#nav button[data-v2-view]');
    if(v2Button){event.preventDefault();renderV2(v2Button.dataset.v2View);return}
    const normal=event.target.closest('#nav button[data-view]');
    if(normal){activeV2=null;$$('#nav button[data-v2-view]').forEach(button=>button.classList.remove('active'))}
  });
  handleIntegrationReturn();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
