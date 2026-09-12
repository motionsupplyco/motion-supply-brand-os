import { FOUNDRY_EIGHT, STARTER_STATE, preCacContribution, postCacContribution, maxFirstOrderCac, grossMarginPct, contributionMarginPct, breakEvenOrders, inventoryMath, wholesaleContribution, retailerGrossMarginPct, normalized3pl, crossoverOrders, cashCheckpoint, processorFee, realizedPrice, purchaseOrderGate, cacFromSpend, funnelMetrics } from './math.js';
import { summarizeShopifyCsv } from './shopify.js';

const VERSION='5'; const clone=x=>JSON.parse(JSON.stringify(x));
const storedVersion=localStorage.getItem('msbo_version');
let state=storedVersion===VERSION?{...clone(STARTER_STATE),...JSON.parse(localStorage.getItem('msbo_state')||'{}')}:clone(STARTER_STATE);
let mode=storedVersion===VERSION?(localStorage.getItem('msbo_mode')||'fresh'):'fresh';
let touched=new Set(storedVersion===VERSION?JSON.parse(localStorage.getItem('msbo_touched')||'[]'):[]);
let lastImport=storedVersion===VERSION?JSON.parse(localStorage.getItem('msbo_last_import')||'null'):null;
localStorage.setItem('msbo_version',VERSION); if(storedVersion!==VERSION){localStorage.setItem('msbo_state',JSON.stringify(state));localStorage.setItem('msbo_mode',mode);localStorage.setItem('msbo_touched','[]');localStorage.removeItem('msbo_last_import')}
let config={authConfigured:false,cloudConfigured:false,billingConfigured:false},session=loadSession(),entitlement={plan:'free',active:false};
let current='dashboard',brands=[],skus=[];
const $=s=>document.querySelector(s); const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(+n)?+n:0); const pct=n=>`${(+n||0).toFixed(1)}%`;
const save=()=>{localStorage.setItem('msbo_state',JSON.stringify(state));localStorage.setItem('msbo_mode',mode);localStorage.setItem('msbo_version',VERSION);localStorage.setItem('msbo_touched',JSON.stringify([...touched]));if(lastImport)localStorage.setItem('msbo_last_import',JSON.stringify(lastImport));else localStorage.removeItem('msbo_last_import')};
const status=(kind,label)=>`<span class="status ${kind}">${label}</span>`;
const metric=(a,b,c='',kind='')=>`<div class="metric"><span class="metricAccent"></span><div class="metricTop"><small>${a}</small>${kind?status(kind,kind==='good'?'HEALTHY':kind==='warn'?'WATCH':'FIX'):''}</div><strong>${b}</strong><div class="metricNote">${c}</div></div>`;
const hasInput=key=>mode==='demo'||mode==='demo-edited'||touched.has(key);
const field=(key,label,help='',step='.01',placeholder='Enter value')=>`<div class="field"><label>${label}</label><input data-key="${key}" type="number" step="${step}" value="${hasInput(key)?state[key]:''}" placeholder="${placeholder}">${help?`<small>${help}</small>`:''}</div>`;
const sourceBadge=(label=mode==='demo'?'DEMO CASE':mode==='demo-edited'?'EDITED DEMO':'USER INPUT')=>`<span class="sourceTag">${label}</span>`;
const row=(a,b)=>`<div class="row"><span>${a}</span><b>${b}</b></div>`;
const head=(t,d,s)=>`<div class="toolhead"><div><span class="kicker">OPERATING TOOL</span><h2>${t}</h2><p class="muted">${d}</p></div><span class="source">${s}</span></div>`;
const readyProduct=()=>hasInput('price')&&state.price>0&&hasInput('landedCost')&&state.landedCost>=0;
const readyCacFloor=()=>readyProduct()&&hasInput('requiredPostCac');
const readyCac=()=>readyCacFloor()&&(hasInput('observedCac')||(hasInput('adSpend')&&hasInput('newCustomers')&&state.newCustomers>0));
const readyInv=()=>hasInput('weeklyDemand')&&state.weeklyDemand>0&&hasInput('leadWeeks')&&state.leadWeeks>0&&hasInput('onHand');
const readyCash=()=>hasInput('cashStart')&&hasInput('protectedFloor');
const calculatedCac=()=>hasInput('adSpend')&&hasInput('newCustomers')&&state.newCustomers>0?cacFromSpend(state):null;
const effectiveCac=()=>hasInput('observedCac')?state.observedCac:calculatedCac();
const effectiveState=()=>({...state,observedCac:effectiveCac()??0});
const readyFunnel=()=>hasInput('sessions')&&state.sessions>0&&hasInput('orders');
const missingOrderCosts=()=>['packaging','shippingSubsidy','returnReserve','processorPercent','processorFixed'].filter(k=>!hasInput(k));
function loadSession(){try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}}
function storeSession(s){session=s||null;if(session)localStorage.setItem('msbo_session',JSON.stringify(session));else localStorage.removeItem('msbo_session')}
async function api(url,method='GET',body,withAuth=false){
  const headers={'Content-Type':'application/json'};if(withAuth&&session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  let r;
  try{r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined})}catch{throw new Error('Brand OS could not reach its server. Refresh the page and check the deployment status.')}
  if(r.status===401&&withAuth&&session?.refresh_token){
    let rr;try{rr=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})})}catch{throw new Error('Could not refresh your session.')}
    if(rr.ok){const j=await rr.json();storeSession(j.session);headers.Authorization=`Bearer ${session.access_token}`;r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined})}
  }
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`Request failed (${r.status})`);return j
}
async function init(){config=await fetch('/api/public-config').then(r=>r.json()).catch(()=>config);await refreshAccount();render()}
async function refreshAccount(){if(!session){entitlement={plan:config.authConfigured?'free':'local',active:false};brands=[];skus=[];updateAccount();return}try{const acct=await api('/api/account','GET',null,true);entitlement={plan:acct.plan,active:acct.active};await loadCloud()}catch(e){storeSession(null);brands=[];skus=[];entitlement={plan:'free',active:false}}updateAccount()}
function updateAccount(){if(!$('#planPill'))return;$('#planPill').textContent=session?entitlement.plan.toUpperCase():(mode==='demo'?'DEMO':mode==='demo-edited'?'DEMO*':'LOCAL');$('#authBtn').textContent=session?'Account':'Sign in';$('#billingBtn').classList.toggle('hidden',!session||!config.billingConfigured);$('#billingBtn').textContent=entitlement.active?'Billing':'Upgrade'}
async function loadCloud(){const [b,s]=await Promise.all([api('/api/brands','GET',null,true),api('/api/skus','GET',null,true)]);brands=b.brands||[];skus=s.skus||[]}

const views={dashboard:'Business Health',profit:'Profit & Pricing',cac:'Customer Acquisition Cost',funnel:'Store Funnel',discount:'Discount Ceiling',inventory:'Inventory & Reorder',wholesale:'Wholesale Economics',launch:'Launch & Break-Even',fulfillment:'3PL Decision',cash:'Cash Checkpoint',po:'PO Cash Gate',shopify:'Shopify CSV Dashboard',brands:'Brands & SKUs',advisor:'Next Move Advisor'};

function onboarding(){
  const items=[
    ['Product economics',readyProduct(),'Add retail price + landed cost','profit'],
    ['CAC guardrail',readyCacFloor(),'Set the contribution floor you refuse to give up','cac'],
    ['Inventory timing',readyInv(),'Add weekly demand, lead time and on-hand','inventory'],
    ['Cash protection',readyCash(),'Add current cash + protected operating floor','cash']
  ];
  const done=items.filter(x=>x[1]).length;
  return `<div class="onboard"><div><span class="kicker">SETUP ${done}/4</span><h2>Build your model before Brand OS judges it.</h2><p>New accounts start blank on purpose. Enter your own numbers, import store data, or load Foundry Eight only when you want a worked demo.</p><div class="sourceLine">${sourceBadge()}</div></div><div class="setupList">${items.map(x=>`<button data-jump="${x[3]}" class="setupItem ${x[1]?'done':''}"><span>${x[1]?'✓':'○'}</span><div><b>${x[0]}</b><small>${x[2]}</small></div></button>`).join('')}</div></div>`
}

function dashboard(){
  if(!readyProduct()) return `${onboarding()}<div class="sectionbar"><h3>Start with decisions that cost money</h3><span>No fake KPIs</span></div><div class="healthgrid"><div class="healthcard"><b>Profit before revenue</b><p>Build one product's real order economics before you spend to acquire customers.</p></div><div class="healthcard"><b>Cash before inventory</b><p>Protect operating cash before approving a production order.</p></div><div class="healthcard"><b>Demand before reorder</b><p>Use actual sales pace and lead time; comments and waitlists are signals, not guaranteed demand.</p></div></div>`;
  const es=effectiveState(), c=preCacContribution(es), pc=readyCac()?postCacContribution(es):null, im=inventoryMath(state), maxcac=readyCacFloor()?maxFirstOrderCac(es):null;
  const be=readyCac()&&hasInput('fixedLaunchCost')?breakEvenOrders(es):Infinity, cashx=readyCash()?cashCheckpoint(state):null, poc=readyCash()&&hasInput('proposedUnits')?purchaseOrderGate(state):null;
  const profitKind=readyCac()?(pc>=state.requiredPostCac?'good':pc>0?'warn':'bad'):'warn';
  const cacKind=readyCac()?(effectiveCac()<=maxcac?'good':effectiveCac()<=maxcac*1.15?'warn':'bad'):'warn';
  const invKind=readyInv()?(im.inventoryPosition>im.reorderPoint?'good':'warn'):'warn';
  const cashKind=readyCash()?(cashx.headroom>=0?'good':'bad'):'warn';
  const next=nextMoves()[0]||['Finish setup','Enter enough real inputs for Brand OS to make a decision.'];
  const importBlock=lastImport?`<div class="sectionbar"><h3>Store pulse</h3><span>${sourceBadge('SHOPIFY IMPORT')}</span></div>${renderImport(lastImport,true)}`:'';
  return `${onboarding()}<div class="dashboardIntro"><div><span class="kicker">BUSINESS HEALTH</span><h2>See only the numbers you actually supplied.</h2><p>${mode==='demo'?'<b>Demo mode:</b> every number below is the Foundry Eight case, not your brand.':mode==='demo-edited'?'<b>Edited demo:</b> this model still contains Foundry Eight case inputs unless you replace them.':'Blank inputs stay blank. No benchmark or business result is invented for you.'}</p></div><div class="brandchip"><small>Current model</small><b>${mode==='demo'?'Foundry Eight demo':mode==='demo-edited'?'Edited Foundry Eight demo':brands[0]?.name?escapeHtml(brands[0].name):'Local model'}</b></div></div>
  <div class="grid g4">
    ${metric('Pre-CAC contribution',money(c),`${pct(contributionMarginPct(es))} contribution margin`,missingOrderCosts().length?'warn':'good')}
    ${metric('Max first-order CAC',maxcac===null?'Set floor':money(maxcac),readyCacFloor()?`Protects ${money(state.requiredPostCac)} after acquisition`:'Needs your contribution floor',readyCacFloor()?'good':'warn')}
    ${metric('Break-even orders',Number.isFinite(be)?be:'Needs CAC + launch cost',Number.isFinite(be)?`${money(state.fixedLaunchCost)} fixed launch cost`:'Not calculated from missing inputs',Number.isFinite(be)&&state.launchUnits>0&&state.launchUnits>=be?'good':'warn')}
    ${metric('Reorder review point',readyInv()?Math.ceil(im.reorderPoint)+' units':'Set up inventory',readyInv()?`${im.weeksCover.toFixed(1)} weeks on-hand cover before inbound`:'Needs demand + lead time + on-hand',invKind)}
  </div>
  <div class="sectionbar"><h3>What needs attention</h3><span>Decision triggers, not vanity metrics</span></div>
  <div class="healthgrid">
    <div class="healthcard"><div class="healthhead"><b>Profitability</b>${readyCac()?status(profitKind,profitKind==='good'?'HEALTHY':profitKind==='warn'?'WATCH':'FIX'):status('warn','NEEDS CAC')}</div><p>${readyCac()?`Modeled contribution after acquisition is ${money(pc)}.`:`Product economics exist, but acquisition cost is not set yet.`}</p></div>
    <div class="healthcard"><div class="healthhead"><b>Inventory</b>${readyInv()?status(invKind,invKind==='good'?'ABOVE REVIEW POINT':'REVIEW REORDER'):status('warn','SET UP')}</div><p>${readyInv()?`${Math.ceil(im.inventoryPosition)} units positioned against a ${Math.ceil(im.reorderPoint)}-unit review point.`:'No reorder decision until demand, lead time and on-hand are entered.'}</p></div>
    <div class="healthcard"><div class="healthhead"><b>Cash</b>${readyCash()?status(cashKind,cashKind==='good'?'ABOVE FLOOR':'BELOW FLOOR'):status('warn','SET UP')}</div><p>${readyCash()?`Quick-check headroom is ${money(cashx.headroom)}${poc?`; proposed PO full-payment headroom is ${money(poc.fullPoHeadroom)}`:''}.`:'No cash judgment until current cash and your protected floor are entered.'}</p></div>
  </div>
  ${importBlock}
  <div class="sectionbar"><h3>Next move</h3><span>Highest-priority rule from your model</span></div><div class="decision"><div><span class="kicker">MOTION SUPPLY RECOMMENDATION</span><h3>${next[0]}</h3><p>${next[1]}</p></div><button data-jump="advisor">See all moves →</button></div>
  <div class="sectionbar"><h3>Quick actions</h3><span>Run the decision you need</span></div><div class="actions"><div class="actioncard" data-jump="profit"><div class="icon">$</div><b>Check a product</b><small>Contribution, margin and costs.</small></div><div class="actioncard" data-jump="cac"><div class="icon">◎</div><b>Set CAC ceiling</b><small>Work backward from contribution.</small></div><div class="actioncard" data-jump="po"><div class="icon">PO</div><b>Gate a purchase order</b><small>See if the PO breaks your cash floor.</small></div><div class="actioncard" data-jump="shopify"><div class="icon">S</div><b>Import Shopify</b><small>Use real store exports.</small></div></div>`
}

function productBreakdown(){
  const fee=processorFee(state.price,state),c=preCacContribution(state,0,0);
  return `${row('Revenue / order',money(state.price))}${row('Landed product cost','-'+money(state.landedCost))}${row('Packaging',hasInput('packaging')?'-'+money(state.packaging):'Not entered')}${row('Shipping subsidy',hasInput('shippingSubsidy')?'-'+money(state.shippingSubsidy):'Not entered')}${row('Return/refund reserve',hasInput('returnReserve')?'-'+money(state.returnReserve):'Not entered')}${row('Processor fee',hasInput('processorPercent')||hasInput('processorFixed')?'-'+money(fee):'Not entered')}${row('Gross margin',pct(grossMarginPct(state)))}${row('Pre-CAC contribution',money(c))}${row('Contribution margin',pct(contributionMarginPct(state)))}`
}

function profit(){
  const c=preCacContribution(state,0,0),missing=missingOrderCosts();
  return `${head('Profit & Pricing','Build one product from the sale price down. Contribution is not accounting profit; it is the order-level money left after the variable costs you entered.','Founder Edition Ch. 2–3')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="grid g2"><div class="card"><div class="form">
  ${field('price','Retail price','What the customer pays before discounts.')}
  ${field('landedCost','Landed product cost','Product + inbound freight/duties allocated per unit.')}
  ${field('packaging','Packaging / order','Enter 0 only if this really costs you nothing.')}
  ${field('shippingSubsidy','Shipping you absorb / order','Your cost, not the shopper’s shipping charge.')}
  ${field('returnReserve','Return/refund reserve / order','Your planning reserve based on your own history; not a universal benchmark.')}
  ${field('processorPercent','Payment processor %','Enter your actual processor terms; Brand OS does not assume a provider.','.1')}
  ${field('processorFixed','Processor fixed fee','Enter your actual fixed fee per successful order.')}
  </div></div><div class="result"><small>PRE-CAC CONTRIBUTION</small><div class="big">${readyProduct()?money(c):'—'}</div>${readyProduct()?productBreakdown():'<p class="muted">Retail price and landed cost are required.</p>'}</div></div>
  ${readyProduct()&&missing.length?`<div class="warning mt"><b>Incomplete cost model.</b> Still blank: ${missing.map(k=>({packaging:'packaging',shippingSubsidy:'shipping subsidy',returnReserve:'return/refund reserve',processorPercent:'processor %',processorFixed:'processor fixed fee'}[k])).join(', ')}. Blank is treated as $0 for the math, so fill these before trusting the result.</div>`:''}
  <div class="advice mt"><b>Decision rule</b>Do not set ad budgets or discount depth from revenue or gross margin alone. Use contribution after the costs that actually move with the order.</div>`
}

function cac(){
  const calc=calculatedCac(),es=effectiveState(),mx=readyCacFloor()?maxFirstOrderCac(es):null,pc=readyCac()?postCacContribution(es):null;
  return `${head('Customer Acquisition Cost','Work backward from contribution instead of borrowing a benchmark from somebody else’s brand.','Founder Edition Ch. 8')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="grid g2"><div class="card"><div class="form">
  ${field('requiredPostCac','Contribution you require after CAC','This is your operating floor. No universal benchmark is defensible here.')}
  ${field('observedCac','Observed / expected CAC','Enter directly if you already know fully loaded acquisition cost.')}
  <div class="formDivider">OR CALCULATE CAC</div>
  ${field('adSpend','Acquisition spend for the same period','Use the spend tied to acquiring the new customers counted below.')}
  ${field('newCustomers','New customers acquired','Do not use total orders if repeat buyers are included.','1')}
  </div></div>
  <div class="result"><small>MAX FIRST-ORDER CAC</small><div class="big">${mx===null?'—':money(mx)}</div>
  ${row('Calculated CAC from spend',calc===null?'—':money(calc))}
  ${row('CAC used by model',readyCac()?money(effectiveCac()):'—')}
  ${row('Contribution after CAC',pc===null?'—':money(pc))}
  ${row('Gap to ceiling',readyCac()&&mx!==null?money(mx-effectiveCac()):'—')}
  ${calc!==null&&!hasInput('observedCac')?'<div class="mini mt">Brand OS is using spend ÷ new customers because direct CAC is blank.</div>':''}</div></div>
  <div class="advice mt"><b>Formula</b>Max first-order CAC = full-price pre-CAC contribution − the contribution you require to remain after acquisition.</div>`
}

function funnel(){
  const x=funnelMetrics(state);
  return `${head('Store Funnel','Use the same date range for every input. This tool shows where shoppers fall out; it does not invent a “good” conversion rate.','Founder Edition Ch. 15 / 22')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="grid g2"><div class="card"><div class="form">
  ${field('sessions','Store sessions','Use your analytics platform for the same period.','1')}
  ${field('addToCarts','Sessions / visitors that added to cart','Keep the source definition consistent.','1')}
  ${field('checkouts','Checkouts started','Same period and source as sessions.','1')}
  ${field('orders','Completed orders','Same period and source as sessions.','1')}
  </div></div><div class="result"><small>STORE CONVERSION RATE</small><div class="big">${readyFunnel()?pct(x.conversionRate):'—'}</div>
  ${row('Add-to-cart rate',readyFunnel()?pct(x.addToCartRate):'—')}
  ${row('Checkout-start rate',readyFunnel()?pct(x.checkoutStartRate):'—')}
  ${row('Cart → checkout',readyFunnel()&&state.addToCarts>0?pct(x.cartToCheckoutRate):'—')}
  ${row('Checkout completion',readyFunnel()&&state.checkouts>0?pct(x.checkoutCompletionRate):'—')}</div></div>
  <div class="advice mt"><b>How to use it</b>Compare your own periods and experiments. A falling step tells you where to investigate; the number alone does not tell you the cause.</div>`
}

function discount(){
  const ds=[0,10,15,20,25],es=effectiveState(),ready=readyProduct()&&readyCacFloor()&&readyCac();
  return `${head('Discount Ceiling','Test the whole offer stack before publishing the code.','Founder Edition Ch. 4')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="card"><div class="form">${field('affiliatePct','Affiliate commission %','Enter 0 if none applies.','1')}${field('observedCac','CAC during offer','Or leave blank and fill acquisition spend + new customers in the CAC tool.')}${field('requiredPostCac','Required post-CAC contribution floor')}</div></div>
  ${ready?`<div class="table mt"><table><thead><tr><th>Offer</th><th>Realized price</th><th>Pre-CAC contribution</th><th>After CAC</th><th>Floor</th></tr></thead><tbody>${ds.map(d=>{const p=realizedPrice(es,d),c=preCacContribution(es,d,state.affiliatePct),a=c-effectiveCac();return `<tr><td>${d?d+'% off':'Full price'}</td><td>${money(p)}</td><td>${money(c)}</td><td>${money(a)}</td><td>${a>=state.requiredPostCac?status('good','PASS'):a>0?status('warn','WATCH'):status('bad','FAIL')}</td></tr>`}).join('')}</tbody></table></div>`:`<div class="empty mt"><b>Finish product economics, CAC and your post-CAC floor first.</b><p>Brand OS will not label a discount PASS/FAIL against a $0 floor you never chose.</p></div>`}`
}

function inventory(){
  const x=inventoryMath(state);
  return `${head('Inventory & Reorder','A reorder point is a review trigger, not an automatic purchase order.','Founder Edition Ch. 42 / 46 / 47')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="grid g2"><div class="card"><div class="form">
  ${field('weeklyDemand','Base weekly unit demand','Use observed sales pace for the SKU / size group you are planning.','1')}
  ${field('highWeeklyDemand','High-case weekly demand','Optional scenario. If blank, Brand OS uses base demand and adds no scenario reserve.','1')}
  ${field('leadWeeks','Supplier lead time (weeks)','Use realistic order-to-receipt time, not just factory production time.','.1')}
  ${field('onHand','On-hand units','Physical sellable stock now.','1')}
  ${field('inbound','Confirmed inbound units','Already ordered and expected to arrive.','1')}
  ${field('allocated','Allocated / committed units','Orders, wholesale commitments or units not freely available.','1')}
  </div></div><div class="result"><small>REORDER REVIEW POINT</small><div class="big">${readyInv()?Math.ceil(x.reorderPoint)+' units':'—'}</div>
  ${row('Base lead-time demand',readyInv()?Math.ceil(x.leadDemand)+' units':'—')}
  ${row('Scenario reserve',readyInv()?Math.ceil(x.safetyStock)+' units':'—')}
  ${row('Inventory position',readyInv()?Math.ceil(x.inventoryPosition)+' units':'—')}
  ${row('Gap to review point',readyInv()?Math.ceil(x.reorderGap)+' units':'—')}
  ${row('On-hand weeks cover',readyInv()&&Number.isFinite(x.weeksCover)?x.weeksCover.toFixed(1)+' weeks':'—')}</div></div>
  <div class="advice mt"><b>Do not convert interest directly into a PO.</b>Use sales pace, stockout timing, restock conversion, returns, size curve, lead time and cash before committing inventory.</div>`
}

function wholesale(){
  const c=wholesaleContribution(state),ret=retailerGrossMarginPct(state),ready=readyProduct()&&hasInput('wholesalePrice');
  return `${head('Wholesale Economics','Know both your unit contribution and the retailer’s gross-margin room before you accept a deal.','Founder Edition Ch. 10 / 53 / 56')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="grid g2"><div class="card"><div class="form">${field('wholesalePrice','Wholesale price')}${field('wholesaleHandling','Handling / unit','Pick/pack, wholesale prep, labels or other per-unit handling.')}${field('wholesaleRepPct','Rep commission %','Enter 0 if no rep commission applies.','1')}</div></div>
  <div class="result"><small>WHOLESALE CONTRIBUTION</small><div class="big">${ready?money(c)+'/unit':'—'}</div>
  ${row('Landed cost',ready?'-'+money(state.landedCost):'—')}
  ${row('Handling',ready?'-'+money(state.wholesaleHandling):'—')}
  ${row('Rep commission',ready?'-'+money(state.wholesalePrice*state.wholesaleRepPct/100):'—')}
  ${row('Retailer gross-margin room at your MSRP',ready?pct(ret):'—')}</div></div>
  <div class="advice mt"><b>Retailer margin is not your margin.</b>The retailer figure only compares MSRP to wholesale price; their own operating costs are separate.</div>`
}

function launch(){
  const es=effectiveState(),be=readyCac()&&hasInput('fixedLaunchCost')?breakEvenOrders(es):Infinity;
  return `${head('Launch & Break-Even','Break-even tells you how many contribution-positive orders cover fixed launch costs. It does not prove demand exists.','Founder Edition Ch. 5 / 24')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="grid g2"><div class="card"><div class="form">${field('fixedLaunchCost','Fixed launch cost','Creative, samples, setup and other fixed launch spend.')}${field('launchUnits','Units available','','1')}${field('observedCac','Expected CAC','Or calculate CAC from spend + new customers in the CAC tool.')}</div></div>
  <div class="result"><small>BREAK-EVEN ORDERS</small><div class="big">${Number.isFinite(be)?be:'—'}</div>
  ${row('Contribution after CAC',readyCac()?money(postCacContribution(es,0,0)):'—')}
  ${row('Launch inventory',hasInput('launchUnits')?state.launchUnits+' units':'—')}
  ${row('Inventory covers break-even',hasInput('launchUnits')&&Number.isFinite(be)?(state.launchUnits>=be?'Yes':'No'):'—')}</div></div>
  ${!readyCac()?'<div class="warning mt"><b>Needs CAC.</b> Brand OS will not calculate an acquisition-adjusted break-even while CAC is missing.</div>':''}`
}

function fulfillment(){
  const ready=hasInput('monthlyOrders')&&state.monthlyOrders>0&&hasInput('inhouseFulfillment')&&hasInput('thirdPartyVariable')&&hasInput('thirdPartyMonthly');
  const n=ready?normalized3pl(state):Infinity,c=ready?crossoverOrders(state):Infinity;
  return `${head('3PL Decision','Normalize monthly minimums before comparing a 3PL quote to your in-house fulfillment cost.','Founder Edition Ch. 59 / 64')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="grid g2"><div class="card"><div class="form">${field('inhouseFulfillment','In-house non-postage cost / order','Labor, packaging-related handling, storage/error reserve—use your own definition consistently.')}${field('thirdPartyVariable','3PL variable cost / order')}${field('thirdPartyMonthly','3PL monthly fixed / minimum')}${field('monthlyOrders','Monthly orders','','1')}</div></div>
  <div class="result"><small>NORMALIZED 3PL COST</small><div class="big">${ready?money(n)+'/order':'—'}</div>
  ${row('In-house baseline',ready?money(state.inhouseFulfillment):'—')}${row('Cost-only crossover',ready&&Number.isFinite(c)?c.toLocaleString()+' orders/mo':ready?'No cost crossover':'—')}</div></div>
  <div class="advice mt"><b>Cost is not the only gate.</b>Also compare receiving, storage, returns, B2B, accuracy, shipping cutoffs, integrations, support and transition risk.</div>`
}

function cash(){
  const x=readyCash()?cashCheckpoint(state):null;
  return `${head('Cash Checkpoint','A fast liquidity stress check. Put every input in the same planning window. Use the full 13-week forecast for actual operating management.','Founder Edition Ch. 7 / 74')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="grid g2"><div class="card"><div class="form">
  ${field('cashStart','Starting cash')}${field('expectedInflows','Near-term inflows')}${field('wholesaleReceivable','Wholesale receivable expected in window')}${field('committedOutflows','Other committed outflows')}${field('supplierBalance','Supplier / PO balances already owed')}${field('payroll','Payroll')}${field('taxReserve','Tax reserve')}${field('processorHold','Processor hold')}${field('protectedFloor','Protected operating cash floor','Your own internal floor, not a universal benchmark.')}
  </div></div><div class="result"><small>PROJECTED CHECKPOINT</small><div class="big">${x?money(x.projectedCash):'—'}</div>${row('Headroom vs floor',x?money(x.headroom):'—')}</div></div>
  <div class="advice mt"><b>Keep the window consistent.</b>Do not mix a two-week inflow estimate with a six-week outflow estimate and call the result runway.</div>`
}

function po(){
  const x=readyCash()&&hasInput('proposedUnits')&&hasInput('depositPct')?purchaseOrderGate(state):null,pass=x&&x.fullPoHeadroom>=0;
  return `${head('PO Cash Gate','Test the proposed inventory commitment against your cash floor before approving it.','Founder Edition Ch. 48 / 74')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="grid g2"><div class="card"><div class="form">
  ${field('proposedUnits','Proposed units','','1')}${field('landedCost','Landed cost / unit')}${field('depositPct','Deposit %','Enter the actual supplier payment schedule.','1')}
  <div class="formDivider">SAME PLANNING WINDOW</div>
  ${field('cashStart','Starting cash')}${field('expectedInflows','Near-term inflows')}${field('wholesaleReceivable','Wholesale receivable')}${field('committedOutflows','Other committed outflows')}${field('supplierBalance','Existing supplier balances')}${field('payroll','Payroll')}${field('taxReserve','Tax reserve')}${field('processorHold','Processor hold')}${field('protectedFloor','Protected cash floor')}
  </div></div><div class="result"><small>PO DECISION</small><div class="big">${x?(pass?'PASS':'HOLD'):'—'}</div>
  ${row('Cash before proposed PO',x?money(x.baseCash):'—')}${row('PO total',x?money(x.poTotal):'—')}${row('Deposit due',x?money(x.deposit):'—')}${row('Cash after deposit',x?money(x.afterDeposit):'—')}${row('Cash after full PO',x?money(x.afterFullPo):'—')}${row('Full-PO headroom vs floor',x?money(x.fullPoHeadroom):'—')}</div></div>
  <div class="advice mt"><b>${x?(pass?'Cash gate passes.':'Cash gate does not pass yet.'):'Complete the cash and PO inputs.'}</b>${x?(pass?'This only means the modeled cash floor survives. Demand, size curve, quality and lead time still need approval.':'Reduce units, improve terms, delay the PO, increase available cash, or change the protected floor only if your real operating needs justify it.'):'No decision is shown from missing inputs.'}</div>`
}

function shopify(){
  return `${head('Shopify CSV Dashboard','Import Shopify Orders or Transaction history CSV. Raw rows stay in your browser; Brand OS saves only aggregate summaries when signed in.','Shopify export-compatible')}<div class="sourceLine">${sourceBadge(lastImport?'SHOPIFY IMPORT':'NO DATA YET')}</div>
  <div class="drop"><input id="csvFile" type="file" accept=".csv,text/csv"><p><b>Choose Shopify CSV</b></p><p class="mini">Orders export: orders, exported order totals, units and SKU mix. Transaction history: successful captures/sales and refunds. An Orders export alone is not treated as a precise refund ledger.</p></div>
  ${lastImport?`${renderImport(lastImport)}<button id="clearImport" class="ghost mt">Clear imported snapshot</button>`:'<div class="empty mt"><b>No store data imported.</b><p>Brand OS will not show revenue, orders, AOV or refunds until you provide a source file.</p></div>'}`
}

function renderImport(x,compact=false){
  if(x.kind==='transactions') return `<div class="grid g4 mt">${metric('Captured sales',money(x.capturedSales),'Successful sale/capture rows')}${metric('Refunds',money(x.refunds),'Successful refund rows')}${metric('Net captured payments',money(x.netCapturedPayments),'Captured minus refunds')}${metric('Orders with transactions',x.orderCountWithTransactions,'Unique order/name keys')}</div>`;
  const date=x.startDate||x.endDate?`<div class="mini importRange">Export range: ${escapeHtml(x.startDate||'—')} → ${escapeHtml(x.endDate||'—')}</div>`:'';
  return `${date}<div class="grid g4 mt">${metric('Orders in export',x.orderCount,'Unique order names')}${metric('Non-canceled order total',money(x.nonCanceledOrderTotal ?? x.csvOrderTotal),'Order Total field, excluding rows marked canceled')}${metric('Units in line items',x.units,'Line-item quantities')}${metric('Avg exported order total',money(x.averageOrderTotal),'CSV order total ÷ all exported orders')}</div>${compact?'':`<div class="grid g3 mt">${metric('Canceled orders',x.canceledOrders ?? 0)}${metric('Discount amount',money(x.csvDiscountAmount),'Exported order-level discount field')}${metric('Unique customer emails',x.uniqueCustomerEmails)}</div><div class="warning mt"><b>Not Shopify Analytics net sales.</b>This Orders CSV snapshot is an operational export. Returns and sales reversals can differ from Shopify Analytics. Use Transaction history for captured/refunded payment cash and Shopify Analytics for official net-sales reporting.</div><div class="table mt"><table><thead><tr><th>Top SKU / item</th><th>Units</th><th>Line-item value</th></tr></thead><tbody>${x.topSkus.map(s=>`<tr><td>${escapeHtml(s.sku)}</td><td>${s.units}</td><td>${money(s.value)}</td></tr>`).join('')}</tbody></table></div>`}`
}
function brandsView(){if(!session)return `${head('Brands & SKUs','Cloud saving needs an account. Calculators still work locally.','Secure cloud storage')}<div class="card"><p>Sign in to save brands and SKUs. Account traffic is proxied through the Brand OS server so the browser does not depend on a third-party CDN connection.</p><button class="primary" id="inlineSignIn">Sign in</button></div>`;return `${head('Brands & SKUs','Save basic product economics under your account.','Owner-scoped cloud rows')}<div class="card"><div class="split"><input id="brandName" placeholder="Brand name" style="flex:1;padding:11px;border:1px solid #ccc;border-radius:8px"><button id="addBrand" class="primary">Add brand</button></div></div><div class="grid g2 mt">${brands.map(b=>`<div class="card"><div class="skuBar"><div><b>${escapeHtml(b.name)}</b><div class="mini">${escapeHtml(b.currency)}</div></div></div><hr style="border:0;border-top:1px solid #eee"><div class="mini">${skus.filter(s=>s.brand_id===b.id).length} saved SKUs</div><div class="split" style="margin-top:10px"><input id="sku-${b.id}" placeholder="SKU" style="width:90px;padding:8px"><input id="name-${b.id}" placeholder="Product" style="flex:1;padding:8px"><button data-addsku="${b.id}" class="outline">Add</button></div>${skus.filter(s=>s.brand_id===b.id).map(s=>`<div class="row"><span>${escapeHtml(s.sku)} · ${escapeHtml(s.name)}</span><b>${money(s.retail_price)}</b></div>`).join('')}</div>`).join('')||'<div class="card">No brands yet.</div>'}</div>`}


function nextMoves(){
  const out=[];
  if(!readyProduct()) return [['Set up product economics','Enter price and landed cost first. Add the remaining order-level costs before trusting contribution.']];
  const es=effectiveState(), pc=readyCac()?postCacContribution(es):null, im=inventoryMath(state), cashx=readyCash()?cashCheckpoint(state):null, poc=readyCash()&&hasInput('proposedUnits')&&hasInput('depositPct')?purchaseOrderGate(state):null, mx=readyCacFloor()?maxFirstOrderCac(es):null;
  if(!readyCac()) out.push(['Finish the acquisition model','Set a post-CAC contribution floor and enter CAC directly or calculate it from spend ÷ new customers.']);
  else if(pc<=0) out.push(['Stop scaling acquisition','The modeled acquired order loses contribution. Fix price, variable cost, offer or CAC first.']);
  else if(effectiveCac()>mx) out.push(['Bring CAC back under the ceiling',`Modeled CAC ${money(effectiveCac())} is above the ${money(mx)} ceiling created by your own contribution floor.`]);

  if(readyCash()&&cashx.headroom<0) out.push(['Protect cash',`${money(Math.abs(cashx.headroom))} below the protected floor in the quick checkpoint.`]);
  if(poc&&poc.fullPoHeadroom<0) out.push(['Hold the proposed PO',`Full payment would put cash ${money(Math.abs(poc.fullPoHeadroom))} below the protected floor.`]);
  if(readyInv()&&im.inventoryPosition<=im.reorderPoint) out.push(['Review the next reorder',`${Math.ceil(im.inventoryPosition)} units positioned vs ${Math.ceil(im.reorderPoint)} review point. Confirm demand quality and cash before ordering.`]);

  if(readyCac()&&pc>0&&effectiveCac()<=mx&&out.length===0) out.push(['Protect the economics',`Modeled first-order contribution after acquisition is ${money(pc)}. Keep watching cost, discount depth and CAC rather than chasing revenue alone.`]);

  const n3=hasInput('monthlyOrders')&&state.monthlyOrders>0&&hasInput('inhouseFulfillment')&&hasInput('thirdPartyVariable')&&hasInput('thirdPartyMonthly')?normalized3pl(state):Infinity;
  if(Number.isFinite(n3)&&n3<state.inhouseFulfillment) out.push(['Review the 3PL quote in detail','The cost-only model favors the 3PL at this volume; service levels and transition risk still need review.']);
  if(lastImport?.kind==='orders'&&lastImport.orderCount>0) out.push(['Review the store pulse',`${lastImport.orderCount} orders are loaded from your latest Shopify Orders CSV. Compare this period against another period before calling a trend.`]);
  return out
}
function advisor(){const out=nextMoves();return `${head('Next Move Advisor','Rule-based operating prompts from your inputs. These are not forecasts and they do not replace judgment.','Motion Supply operating logic')}<div class="grid g2">${out.map((x,i)=>`<div class="card"><span class="kicker">MOVE ${i+1}</span><h3>${x[0]}</h3><p>${x[1]}</p></div>`).join('')}</div>`}

function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function render(){ $('#title').textContent=views[current];const map={dashboard,profit,cac,funnel,discount,inventory,wholesale,launch,fulfillment,cash,po,shopify,brands:brandsView,advisor};$('#app').innerHTML=map[current]();bind();updateAccount() }

function bind(){
  document.querySelectorAll('[data-key]').forEach(el=>el.onchange=e=>{
    const key=e.target.dataset.key,raw=e.target.value;
    if(raw===''){touched.delete(key);state[key]=0}else{touched.add(key);state[key]=Number(raw)}
    mode=mode==='demo'||mode==='demo-edited'?'demo-edited':'fresh';save();render()
  });
  document.querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>jumpTo(el.dataset.jump));
  const f=$('#csvFile');if(f)f.onchange=handleCsv;
  const c=$('#clearImport');if(c)c.onclick=()=>{lastImport=null;save();render()};
  const s=$('#inlineSignIn');if(s)s.onclick=showAuth;
  const ab=$('#addBrand');if(ab)ab.onclick=addBrand;
  document.querySelectorAll('[data-addsku]').forEach(b=>b.onclick=()=>addSku(b.dataset.addsku))
}
function jumpTo(view){current=view;document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('#side').classList.remove('open');render();scrollTo(0,0)}
async function handleCsv(e){
  const file=e.target.files[0];if(!file)return;
  if(session&&!entitlement.active&&config.billingConfigured){alert('Shopify CSV dashboard is a Pro feature for signed-in users.');return}
  try{
    const parsed=summarizeShopifyCsv(await file.text());
    const clean={...parsed};delete clean.orders;
    lastImport=clean;save();render();
    if(session)await api('/api/import-summaries','POST',{file_kind:lastImport.kind,start_date:lastImport.startDate||null,end_date:lastImport.endDate||null,summary:lastImport},true)
  }catch(err){alert(err.message)}
}
function showAuth(){if(!config.authConfigured)return alert('Account service is not fully configured on this deployment yet.');if(session)return showAccount();showModal(`<h2>Sign in / create account</h2><div class="authform"><input id="email" type="email" placeholder="Email"><input id="password" type="password" placeholder="Password (6+ characters)"><div id="authMsg" class="mini"></div><div class="split"><button id="signin" class="primary">Sign in</button><button id="signup" class="outline">Create account</button></div></div>`);$('#signin').onclick=()=>auth('signin');$('#signup').onclick=()=>auth('signup')}
async function auth(kind){const email=$('#email').value.trim(),password=$('#password').value,msg=$('#authMsg');msg.textContent='Working…';try{const x=await api(`/api/auth/${kind}`,'POST',{email,password});if(x.confirmationRequired){msg.textContent='Account created. Check your email to confirm, then sign in.';return}storeSession(x.session);hideModal();await refreshAccount();render()}catch(e){msg.textContent=e.message}}
function showAccount(){showModal(`<h2>Account</h2><p>${escapeHtml(session?.user?.email||'Signed in')}</p><p>Plan: <b>${entitlement.plan.toUpperCase()}</b></p><div class="split"><button id="signout" class="outline">Sign out</button>${config.billingConfigured?`<button id="acctBilling" class="primary">${entitlement.active?'Manage billing':'Upgrade to Pro'}</button>`:''}</div>`);$('#signout').onclick=()=>{storeSession(null);brands=[];skus=[];hideModal();refreshAccount();render()};const b=$('#acctBilling');if(b)b.onclick=startBilling}
async function startBilling(){try{const endpoint=entitlement.active?'/api/create-portal-session':'/api/create-checkout-session';const x=await api(endpoint,'POST',{},true);location.href=x.url}catch(e){alert(e.message)}}
function showModal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}function hideModal(){$('#modal').classList.add('hidden')}
$('#nav').onclick=e=>{const b=e.target.closest('button[data-view]');if(b)jumpTo(b.dataset.view)};$('#menuBtn').onclick=()=>$('#side').classList.toggle('open');$('#demoBtn').onclick=()=>{state=clone(FOUNDRY_EIGHT);mode='demo';touched=new Set(Object.keys(FOUNDRY_EIGHT));save();render()};$('#freshBtn').onclick=()=>{if(confirm('Clear the local calculator model and start fresh?')){state=clone(STARTER_STATE);mode='fresh';touched=new Set();lastImport=null;save();render()}};$('#authBtn').onclick=showAuth;$('#billingBtn').onclick=startBilling;$('#closeModal').onclick=hideModal;$('#modal').onclick=e=>{if(e.target.id==='modal')hideModal()};
init();
