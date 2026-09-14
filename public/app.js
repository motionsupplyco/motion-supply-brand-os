import { FOUNDRY_EIGHT, STARTER_STATE, preCacContribution, postCacContribution, maxFirstOrderCac, grossMarginPct, contributionMarginPct, breakEvenOrders, inventoryMath, wholesaleContribution, retailerGrossMarginPct, normalized3pl, crossoverOrders, cashCheckpoint, processorFee, realizedPrice, purchaseOrderGate, cacFromSpend, funnelMetrics } from './math.js';
import { summarizeShopifyCsv } from './shopify.js';

const VERSION='5.5'; const clone=x=>JSON.parse(JSON.stringify(x));
function safeStoredJson(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    if(!raw)return fallback;
    const parsed=JSON.parse(raw);
    return parsed ?? fallback;
  }catch{return fallback}
}
const storedState=safeStoredJson('msbo_state',{});
let state={...clone(STARTER_STATE),...(storedState&&typeof storedState==='object'?storedState:{})};
let mode=localStorage.getItem('msbo_mode')||'fresh';
const storedTouched=safeStoredJson('msbo_touched',[]);
let touched=new Set(Array.isArray(storedTouched)?storedTouched:[]);
let lastImport=safeStoredJson('msbo_last_import',null);
localStorage.setItem('msbo_version',VERSION);
let config={authConfigured:false,cloudConfigured:false,billingConfigured:false},session=loadSession(),entitlement={plan:'free',active:false,billingManageable:false,limits:{brands:1,skus:5},usage:{brands:0,skus:0}};
let current='dashboard',brands=[],skus=[];
const $=s=>document.querySelector(s); const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(+n)?+n:0); const pct=n=>`${(+n||0).toFixed(1)}%`;
const save=()=>{localStorage.setItem('msbo_state',JSON.stringify(state));localStorage.setItem('msbo_mode',mode);localStorage.setItem('msbo_version',VERSION);localStorage.setItem('msbo_touched',JSON.stringify([...touched]));if(lastImport)localStorage.setItem('msbo_last_import',JSON.stringify(lastImport));else localStorage.removeItem('msbo_last_import')};
const status=(kind,label)=>`<span class="status ${kind}">${label}</span>`;
const metric=(a,b,c='',kind='',info=null)=>`<div class="metric"><span class="metricAccent"></span><div class="metricTop"><small>${a}</small>${kind?status(kind,kind==='good'?'HEALTHY':kind==='warn'?'WATCH':'FIX'):''}</div><strong>${b}</strong><div class="metricNote">${c}</div>${info?`<details class="metricDetails"><summary>What does this mean?</summary><div class="mini mt">${info.definition?`<p><b>What it is:</b> ${info.definition}</p>`:''}${info.why?`<p><b>Why it matters:</b> ${info.why}</p>`:''}${info.math?`<p><b>How it is calculated:</b> ${info.math}</p>`:''}${info.action?`<p><b>What to do next:</b> ${info.action}</p>`:''}${info.source?`<p><b>Based on:</b> ${info.source}</p>`:''}</div></details>`:''}</div>`;
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
async function api(url,method='GET',body,withAuth=false,signal=null){
  const headers={'Content-Type':'application/json'};if(withAuth&&session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  let r;
  try{r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,signal})}catch(e){if(e?.name==='AbortError')throw e;throw new Error('Brand OS could not reach its server. Refresh the page and check the deployment status.')}
  if(r.status===401&&withAuth&&session?.refresh_token){
    let rr;try{rr=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})})}catch{throw new Error('Could not refresh your session.')}
    if(rr.ok){const j=await rr.json();storeSession(j.session);headers.Authorization=`Bearer ${session.access_token}`;r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,signal})}
  }
  const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||`Request failed (${r.status})`);e.status=r.status;e.code=j.code||null;throw e}return j
}
async function init(){config=await fetch('/api/public-config').then(r=>r.json()).catch(()=>config);await refreshAccount();track('landing_page_viewed');render()}
async function refreshAccount(){if(!session){entitlement={plan:config.authConfigured?'free':'local',active:false,billingManageable:false,limits:{brands:1,skus:5},usage:{brands:0,skus:0}};brands=[];skus=[];updateAccount();return}let acct;try{acct=await api('/api/account','GET',null,true)}catch(e){if(e.status===401){storeSession(null);brands=[];skus=[];entitlement={plan:'free',active:false,billingManageable:false,limits:{brands:1,skus:5},usage:{brands:0,skus:0}}}else console.error('refresh-account',e);updateAccount();return}entitlement={plan:acct.plan,active:acct.active,billingManageable:Boolean(acct.billingManageable),limits:acct.limits||{brands:1,skus:5},usage:acct.usage||{brands:0,skus:0}};try{await loadCloud()}catch(e){console.error('load-cloud',e)}updateAccount()}
function updateAccount(){if(!$('#planPill'))return;$('#planPill').textContent=session?entitlement.plan.toUpperCase():(mode==='demo'?'DEMO':mode==='demo-edited'?'DEMO*':'LOCAL');$('#authBtn').textContent=session?'Account':'Sign in';$('#billingBtn').classList.toggle('hidden',!session||!config.billingConfigured);$('#billingBtn').textContent=(entitlement.active||entitlement.billingManageable)?'Billing':'Upgrade'}
async function loadCloud(){const [b,s]=await Promise.all([api('/api/brands','GET',null,true),api('/api/skus','GET',null,true)]);brands=b.brands||[];skus=s.skus||[]}


const analyticsId=localStorage.getItem('msbo_anon_id')||crypto.randomUUID();localStorage.setItem('msbo_anon_id',analyticsId);
const tracked=safeStoredJson('msbo_tracked_events',{});
async function track(name,properties={}){try{await fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json',...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify({event_name:name,anonymous_id:analyticsId,properties})})}catch{}}
function trackOnce(name,properties={}){if(tracked[name])return;tracked[name]=true;localStorage.setItem('msbo_tracked_events',JSON.stringify(tracked));track(name,properties)}

const views={dashboard:'Business Health',profit:'Profit & Pricing',cac:'Customer Acquisition Cost',funnel:'Store Funnel',discount:'Discount Ceiling',inventory:'Inventory & Reorder',wholesale:'Wholesale Economics',launch:'Launch & Break-Even',fulfillment:'3PL Decision',cash:'Cash Checkpoint',po:'PO Cash Gate',shopify:'Shopify CSV Dashboard',brands:'Brands & SKUs',advisor:'Next Move Advisor'};

// Free proves the core model. Pro unlocks the recurring operating layer.
const PRO_VIEWS=new Set(['discount','inventory','wholesale','launch','fulfillment','cash','po','shopify']);
const isPro=()=>Boolean(entitlement?.active);
const isProLocked=view=>Boolean(config.billingConfigured&&!isPro()&&mode!=='demo'&&mode!=='demo-edited'&&PRO_VIEWS.has(view));
function proGate(view){
  const reasons={
    discount:['Discount Ceiling','Know how deep you can discount without crossing the contribution floor you set.'],
    inventory:['Inventory & Reorder','Turn demand and supplier lead time into a reorder review trigger instead of guessing.'],
    wholesale:['Wholesale Economics','Check whether a wholesale deal leaves enough unit contribution before you accept it.'],
    launch:['Launch & Break-Even','See how many contribution-positive orders are required to recover fixed launch costs.'],
    fulfillment:['3PL Decision','Normalize fulfillment costs so monthly minimums do not hide the real per-order cost.'],
    cash:['Cash Checkpoint','Stress-test near-term liquidity against the cash floor you choose to protect.'],
    po:['PO Cash Gate','Test an inventory commitment against protected operating cash before approving the PO.'],
    shopify:['Shopify Data','Bring store data into Brand OS without pretending an export is the same as accounting profit.']
  };
  const [title,why]=reasons[view]||['Brand OS Pro','Unlock the operating tools that turn your model into an ongoing decision system.'];
  return `${head(title,'This is part of the recurring operating layer in Brand OS Pro.','PRO')}<div class="card"><span class="kicker">WHY YOU NEED THIS</span><h3>${title}</h3><p>${why}</p><div class="advice mt"><b>Free shows you the core economics.</b> Pro adds the tools designed for repeated operating decisions: inventory, cash, offers, fulfillment, wholesale and store-data workflows.</div><button class="primary mt" id="upgradeNow">${session?'Upgrade to Pro':'Create an account to upgrade'}</button></div>`
}
async function upgradeFlow(){if(!session){showAuth();return}await startBilling()}


function onboarding(){
  const core=[
    ['Product economics',readyProduct(),'Add selling price + landed cost so Brand OS can model one real order.','profit'],
    ['Acquisition guardrail',readyCacFloor(),'Choose the contribution you want left after acquiring a customer.','cac'],
    ['Store funnel',readyFunnel(),'Add one consistent date range so drop-off can be measured without guessing at the cause.','funnel']
  ];
  const operating=[
    ['Inventory timing',readyInv(),'Use demand + supplier lead time to know when a reorder deserves review.','inventory'],
    ['Cash protection',readyCash(),'Choose the operating cash floor you do not want a PO or expense to cross.','cash']
  ];
  const items=isPro()||mode==='demo'||mode==='demo-edited'?[...core,...operating]:core;
  const done=items.filter(x=>x[1]).length;
  const payoff=done===items.length?'Your core model is ready. Brand OS can now interpret the numbers you supplied.':'Complete the steps below so Brand OS can explain what your numbers mean instead of showing empty KPIs.';
  return `<div class="onboard"><div><span class="kicker">SETUP ${done}/${items.length}</span><h2>Build the model Brand OS will use to guide decisions.</h2><p>${payoff}</p><div class="sourceLine">${sourceBadge()}</div></div><div class="setupList">${items.map(x=>`<button data-jump="${x[3]}" class="setupItem ${x[1]?'done':''}"><span>${x[1]?'✓':'○'}</span><div><b>${x[0]}</b><small>${x[2]}</small></div></button>`).join('')}${!isPro()&&config.billingConfigured?`<div class="setupItem"><span>PRO</span><div><b>Full operating model</b><small>Pro adds inventory, cash, PO, discount, wholesale, 3PL and store-data decision tools after the core setup.</small></div></div>`:''}</div></div>`
}

function dashboard(){
  if(!readyProduct()) return `${onboarding()}<div class="sectionbar"><h3>Start with decisions that cost money</h3><span>No fake KPIs</span></div><div class="healthgrid"><div class="healthcard"><b>Profit before revenue</b><p>Build one product's real order economics before you spend to acquire customers.</p></div><div class="healthcard"><b>Cash before inventory</b><p>Protect operating cash before approving a production order.</p></div><div class="healthcard"><b>Demand before reorder</b><p>Use actual sales pace and lead time; comments and waitlists are signals, not guaranteed demand.</p></div></div>`;
  const es=effectiveState(), c=preCacContribution(es), pc=readyCac()?postCacContribution(es):null, im=inventoryMath(state), maxcac=readyCacFloor()?maxFirstOrderCac(es):null;
  const be=readyCac()&&hasInput('fixedLaunchCost')?breakEvenOrders(es):Infinity, cashx=readyCash()?cashCheckpoint(state):null, poc=readyCash()&&hasInput('proposedUnits')&&hasInput('depositPct')?purchaseOrderGate(state):null;
  const profitKind=readyCac()?(pc>=state.requiredPostCac?'good':pc>0?'warn':'bad'):'warn';
  const cacKind=readyCac()?(effectiveCac()<=maxcac?'good':effectiveCac()<=maxcac*1.15?'warn':'bad'):'warn';
  const invKind=readyInv()?(im.inventoryPosition>im.reorderPoint?'good':'warn'):'warn';
  const cashKind=readyCash()?(cashx.headroom>=0?'good':'bad'):'warn';
  const fullOperating=isPro()||mode==='demo'||mode==='demo-edited';
  const funnelx=funnelMetrics(state);
  const next=nextMoves()[0]||['Finish setup','Enter enough real inputs for Brand OS to make a decision.'];
  const importBlock=fullOperating&&lastImport?`<div class="sectionbar"><h3>Store pulse</h3><span>${sourceBadge('SHOPIFY IMPORT')}</span></div>${renderImport(lastImport,true)}`:'';
  return `${onboarding()}<div class="dashboardIntro"><div><span class="kicker">BUSINESS HEALTH</span><h2>See only the numbers you actually supplied.</h2><p>${mode==='demo'?'<b>Demo mode:</b> every number below is the Foundry Eight case, not your brand.':mode==='demo-edited'?'<b>Edited demo:</b> this model still contains Foundry Eight case inputs unless you replace them.':'Blank inputs stay blank. No benchmark or business result is invented for you.'}</p></div><div class="brandchip"><small>Current model</small><b>${mode==='demo'?'Foundry Eight demo':mode==='demo-edited'?'Edited Foundry Eight demo':brands[0]?.name?escapeHtml(brands[0].name):'Local model'}</b></div></div>
  <div class="grid g4">
    ${metric('Pre-CAC contribution',money(c),`${pct(contributionMarginPct(es))} contribution margin`,missingOrderCosts().length?'warn':'good',{definition:'Money remaining from one modeled order after the variable costs you entered, before customer acquisition.',why:'This is the pool that still has to support acquisition and the rest of the business.',math:'Selling price minus modeled order-level variable costs.',action:'Finish every variable-cost input before using this number to set CAC or discount decisions.',source:sourceBadge()})}
    ${metric('Max first-order CAC',maxcac===null?'Set floor':money(maxcac),readyCacFloor()?`Protects ${money(state.requiredPostCac)} after acquisition`:'Needs your contribution floor',readyCacFloor()?'good':'warn',{definition:'The most Brand OS says you can spend to acquire a first-order customer while still preserving your chosen post-CAC contribution floor.',why:'It gives your acquisition spending a business-specific ceiling instead of a borrowed benchmark.',math:'Pre-CAC contribution minus your required post-CAC contribution.',action:'Compare observed CAC with this ceiling before increasing acquisition spend.',source:'Your product economics + your chosen contribution floor'})}
    ${fullOperating?metric('Break-even orders',Number.isFinite(be)?be:'Needs CAC + launch cost',Number.isFinite(be)?`${money(state.fixedLaunchCost)} fixed launch cost`:'Not calculated from missing inputs',Number.isFinite(be)&&state.launchUnits>0&&state.launchUnits>=be?'good':'warn'):metric('Store conversion',readyFunnel()?pct(funnelx.conversionRate):'Set funnel',readyFunnel()?'Completed orders ÷ sessions':'Needs sessions + completed orders',readyFunnel()?'good':'warn',{definition:'The share of store sessions that became completed orders in the period you entered.',why:'It helps you compare your own store periods without pretending one universal conversion benchmark fits every brand.',math:'Completed orders ÷ store sessions.',action:'Compare the same source and date window over time; a change tells you where to investigate, not the cause.',source:'Your funnel inputs'})}
    ${fullOperating?metric('Reorder review point',readyInv()?Math.ceil(im.reorderPoint)+' units':'Set up inventory',readyInv()?`${im.weeksCover.toFixed(1)} weeks on-hand cover before inbound`:'Needs demand + lead time + on-hand',invKind,{definition:'A planning trigger for reviewing a reorder, not an automatic instruction to buy.',why:'Supplier lead time can make an apparently healthy stock level risky before inventory reaches zero.',math:'Lead-time demand plus any scenario reserve, compared with inventory position.',action:'Review demand quality, cash and supplier terms before converting this trigger into a PO.',source:'Your demand, lead time, on-hand, inbound and allocated units'}):metric('Contribution after CAC',readyCac()?money(pc):'Set CAC',readyCac()?`Required floor: ${money(state.requiredPostCac)}`:'Needs CAC + your contribution floor',profitKind,{definition:'Modeled order contribution after subtracting the acquisition cost you entered.',why:'This is the first-order economics checkpoint before you scale acquisition.',math:'Pre-CAC contribution minus observed or calculated CAC.',action:'If it falls below your own floor, fix price, variable costs, offer depth or CAC before scaling.',source:'Your product economics + CAC'})}
  </div>
  <div class="sectionbar"><h3>What needs attention</h3><span>Decision triggers, not vanity metrics</span></div>
  <div class="healthgrid">
    <div class="healthcard"><div class="healthhead"><b>Profitability</b>${readyCac()?status(profitKind,profitKind==='good'?'HEALTHY':profitKind==='warn'?'WATCH':'FIX'):status('warn','NEEDS CAC')}</div><p>${readyCac()?`Modeled contribution after acquisition is ${money(pc)}.`:`Product economics exist, but acquisition cost is not set yet.`}</p></div>
    ${fullOperating?`<div class="healthcard"><div class="healthhead"><b>Inventory</b>${readyInv()?status(invKind,invKind==='good'?'ABOVE REVIEW POINT':'REVIEW REORDER'):status('warn','SET UP')}</div><p>${readyInv()?`${Math.ceil(im.inventoryPosition)} units positioned against a ${Math.ceil(im.reorderPoint)}-unit review point.`:'No reorder decision until demand, lead time and on-hand are entered.'}</p></div><div class="healthcard"><div class="healthhead"><b>Cash</b>${readyCash()?status(cashKind,cashKind==='good'?'ABOVE FLOOR':'BELOW FLOOR'):status('warn','SET UP')}</div><p>${readyCash()?`Quick-check headroom is ${money(cashx.headroom)}${poc?`; proposed PO lowest modeled headroom is ${money(poc.minimumHeadroom)}`:''}.`:'No cash judgment until current cash and your protected floor are entered.'}</p></div>`:`<div class="healthcard"><div class="healthhead"><b>Acquisition</b>${readyCac()?status(cacKind,cacKind==='good'?'UNDER CEILING':cacKind==='warn'?'NEAR CEILING':'OVER CEILING'):status('warn','SET UP')}</div><p>${readyCac()?`CAC used by the model is ${money(effectiveCac())}; your ceiling is ${money(maxcac)}.`:'Set your contribution floor and CAC to create a brand-specific acquisition guardrail.'}</p></div><div class="healthcard"><div class="healthhead"><b>Funnel</b>${readyFunnel()?status('good','TRACKING'):status('warn','SET UP')}</div><p>${readyFunnel()?`${state.orders} completed orders from ${state.sessions} sessions in the period entered.`:'Use one consistent date range for sessions, carts, checkouts and orders.'}</p></div>`}
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
  const x=readyCash()&&hasInput('proposedUnits')&&hasInput('depositPct')?purchaseOrderGate(state):null,pass=x&&x.minimumHeadroom>=0;
  return `${head('PO Cash Gate','Model the deposit today and the remaining supplier payment over time before approving inventory.','Founder Edition Ch. 48 / 74')}<div class="sourceLine">${sourceBadge()}</div>
  <div class="grid g2"><div class="card"><div class="form">
  ${field('proposedUnits','Proposed units','','1')}${field('landedCost','Landed cost / unit')}${field('depositPct','Deposit %','Supplier deposit due now.','1')}${field('poBalanceDueWeeks','Balance due in how many weeks?','Timing context for the remaining supplier payment.','.1')}
  <div class="formDivider">BASE CASH WINDOW</div>
  ${field('cashStart','Starting cash')}${field('expectedInflows','Near-term inflows')}${field('wholesaleReceivable','Wholesale receivable')}${field('committedOutflows','Other committed outflows')}${field('supplierBalance','Existing supplier balances')}${field('payroll','Payroll')}${field('taxReserve','Tax reserve')}${field('processorHold','Processor hold')}${field('protectedFloor','Protected cash floor')}
  <div class="formDivider">BETWEEN DEPOSIT & BALANCE</div>
  ${field('poExpectedInflowsBeforeBalance','Additional expected inflows before balance','Only include cash not already counted above. These are estimates.')}${field('poExpectedOutflowsBeforeBalance','Additional outflows before balance','Only include obligations not already counted above.')}
  </div></div><div class="result"><small>PO DECISION</small><div class="big">${x?(pass?'PASS':'HOLD'):'—'}</div>
  ${row('Cash before proposed PO',x?money(x.baseCash):'—')}${row('PO total',x?money(x.poTotal):'—')}${row('Deposit due now',x?money(x.deposit):'—')}${row('Cash after deposit',x?money(x.afterDeposit):'—')}${row('Remaining supplier balance',x?money(x.remainingBalance):'—')}${row(`Cash before balance${x&&x.balanceDueWeeks?` (~${x.balanceDueWeeks} wk)`:''}`,x?money(x.cashBeforeBalance):'—')}${row('Cash after remaining balance',x?money(x.afterBalance):'—')}${row('Lowest modeled headroom vs floor',x?money(x.minimumHeadroom):'—')}</div></div>
  <div class="advice mt"><b>${x?(pass?'Cash gate passes across the modeled payment timeline.':'Cash gate does not pass across the modeled payment timeline.'):'Complete the cash and PO inputs.'}</b>${x?(pass?'Future inflows are estimates, not guaranteed cash. Confirm demand, supplier terms, taxes, payroll and timing before committing.':'Reduce units, improve supplier terms, delay the PO, increase available cash, or remove optimistic inflows that are not dependable.'):'No decision is shown from missing inputs.'}</div>`
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
function brandsView(){if(!session)return `${head('Brands & SKUs','Cloud saving needs an account. Calculators still work locally.','Secure cloud storage')}<div class="card"><p>Sign in to save brands and SKUs. Account traffic is proxied through the Brand OS server so the browser does not depend on a third-party CDN connection.</p><button class="primary" id="inlineSignIn">Sign in</button></div>`;const brandLimit=entitlement.limits?.brands,skuLimit=entitlement.limits?.skus,brandMaxed=!isPro()&&Number.isFinite(brandLimit)&&brands.length>=brandLimit,skuMaxed=!isPro()&&Number.isFinite(skuLimit)&&skus.length>=skuLimit;return `${head('Brands & SKUs','Save basic product economics under your account.','Owner-scoped cloud rows')}<div class="card"><div class="mini">${isPro()?'Pro: unlimited saved brands and SKUs.':`Free: ${brands.length}/${brandLimit??1} brand and ${skus.length}/${skuLimit??5} SKUs saved.`}</div>${brandMaxed?`<div class="advice mt"><b>Free brand limit reached.</b>Upgrade to Pro for unlimited brands and SKUs.</div>`:`<div class="split mt"><input id="brandName" placeholder="Brand name" style="flex:1;padding:11px;border:1px solid #ccc;border-radius:8px"><button id="addBrand" class="primary">Add brand</button></div>`}</div><div class="grid g2 mt">${brands.map(b=>`<div class="card"><div class="skuBar"><div><b>${escapeHtml(b.name)}</b><div class="mini">${escapeHtml(b.currency)}</div></div><button class="ghost" data-deletebrand="${b.id}" type="button">Delete brand</button></div><hr style="border:0;border-top:1px solid #eee"><div class="mini">${skus.filter(s=>s.brand_id===b.id).length} saved SKUs</div>${skuMaxed?`<div class="mini mt">Free SKU limit reached.</div>`:`<div class="split" style="margin-top:10px"><input id="sku-${b.id}" placeholder="SKU" style="width:90px;padding:8px"><input id="name-${b.id}" placeholder="Product" style="flex:1;padding:8px"><input id="price-${b.id}" type="number" min="0" step=".01" placeholder="Retail $" style="width:110px;padding:8px"><button data-addsku="${b.id}" class="outline">Add</button></div>`}${skus.filter(s=>s.brand_id===b.id).map(s=>`<div class="row"><span>${escapeHtml(s.sku)} · ${escapeHtml(s.name)}</span><b>${money(s.retail_price)}</b></div>`).join('')}</div>`).join('')||'<div class="card">No brands yet.</div>'}</div>`}


async function addBrand(){
  const input=$('#brandName');
  const btn=$('#addBrand');
  const name=input?.value.trim();
  if(!name){alert('Enter a brand name.');return}
  if(brands.some(b=>String(b.name||'').trim().toLowerCase()===name.toLowerCase())){alert('That brand already exists in your account.');return}
  if(btn?.disabled)return;
  if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{
    await api('/api/brands','POST',{name},true);
    await loadCloud();
    render();
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='Add brand'}
    alert(e.message)
  }
}

async function deleteBrand(brandId){
  closeMenu({restoreFocus:false});
  const brand=brands.find(b=>String(b.id)===String(brandId));
  if(!brand)return;
  const skuCount=skus.filter(s=>String(s.brand_id)===String(brandId)).length;
  const warning=skuCount?`Delete ${brand.name} and its ${skuCount} saved SKU${skuCount===1?'':'s'}? This cannot be undone.`:`Delete ${brand.name}? This cannot be undone.`;
  if(!confirm(warning))return;
  const btn=document.querySelector(`[data-deletebrand="${CSS.escape(String(brandId))}"]`);
  if(btn?.disabled)return;
  const oldText=btn?.textContent||'Delete brand';
  if(btn){btn.disabled=true;btn.textContent='Deleting…'}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    await api(`/api/brands/${encodeURIComponent(brandId)}`,'DELETE',null,true,controller.signal);
    await refreshAccount();
    render();
  }catch(e){
    const message=e?.name==='AbortError'?'Delete request timed out. Refresh before trying again; the server may have completed the request.':e.message;
    alert(message);
  }finally{
    clearTimeout(timer);
    if(btn?.isConnected){btn.disabled=false;btn.textContent=oldText}
  }
}

async function addSku(brandId){
  const sku=$(`#sku-${brandId}`)?.value.trim();
  const name=$(`#name-${brandId}`)?.value.trim();
  const priceRaw=$(`#price-${brandId}`)?.value;
  const retail_price=Number(priceRaw);
  const btn=document.querySelector(`[data-addsku="${brandId}"]`);
  if(!sku||!name){alert('Enter both the SKU and product name.');return}
  if(priceRaw===''||!Number.isFinite(retail_price)||retail_price<0){alert('Enter a valid retail price.');return}
  if(skus.some(s=>String(s.brand_id)===String(brandId)&&String(s.sku||'').trim().toLowerCase()===sku.toLowerCase())){alert('That SKU already exists under this brand.');return}
  if(btn?.disabled)return;
  if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{
    await api('/api/skus','POST',{brand_id:brandId,sku,name,retail_price},true);
    await loadCloud();
    render();
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='Add'}
    alert(e.message)
  }
}


function nextMoves(){
  const out=[];
  if(!readyProduct()) return [['Set up product economics','Enter price and landed cost first. Add the remaining order-level costs before trusting contribution.']];
  const es=effectiveState(), pc=readyCac()?postCacContribution(es):null, im=inventoryMath(state), cashx=readyCash()?cashCheckpoint(state):null, poc=readyCash()&&hasInput('proposedUnits')&&hasInput('depositPct')?purchaseOrderGate(state):null, mx=readyCacFloor()?maxFirstOrderCac(es):null;
  if(!readyCac()) out.push(['Finish the acquisition model','Set a post-CAC contribution floor and enter CAC directly or calculate it from spend ÷ new customers.']);
  else if(pc<=0) out.push(['Stop scaling acquisition','The modeled acquired order loses contribution. Fix price, variable cost, offer or CAC first.']);
  else if(effectiveCac()>mx+0.005) out.push(['Bring CAC back under the ceiling',`Modeled CAC ${money(effectiveCac())} is above the ${money(mx)} ceiling created by your own contribution floor.`]);

  const fullOperating=isPro()||mode==='demo'||mode==='demo-edited';
  if(fullOperating&&readyCash()&&cashx.headroom<0) out.push(['Protect cash',`${money(Math.abs(cashx.headroom))} below the protected floor in the quick checkpoint.`]);
  if(fullOperating&&poc&&poc.minimumHeadroom<0) out.push(['Hold the proposed PO',`The modeled payment timeline falls ${money(Math.abs(poc.minimumHeadroom))} below the protected cash floor at its lowest point.`]);
  if(fullOperating&&readyInv()&&im.inventoryPosition<=im.reorderPoint) out.push(['Review the next reorder',`${Math.ceil(im.inventoryPosition)} units positioned vs ${Math.ceil(im.reorderPoint)} review point. Confirm demand quality and cash before ordering.`]);

  if(readyCac()&&pc>0&&effectiveCac()<=mx+0.005&&out.length===0) out.push(['Protect the economics',`Modeled first-order contribution after acquisition is ${money(pc)}. Keep watching cost, discount depth and CAC rather than chasing revenue alone.`]);

  const n3=hasInput('monthlyOrders')&&state.monthlyOrders>0&&hasInput('inhouseFulfillment')&&hasInput('thirdPartyVariable')&&hasInput('thirdPartyMonthly')?normalized3pl(state):Infinity;
  if(fullOperating&&Number.isFinite(n3)&&n3<state.inhouseFulfillment) out.push(['Review the 3PL quote in detail','The cost-only model favors the 3PL at this volume; service levels and transition risk still need review.']);
  if(fullOperating&&lastImport?.kind==='orders'&&lastImport.orderCount>0) out.push(['Review the store pulse',`${lastImport.orderCount} orders are loaded from your latest Shopify Orders CSV. Compare this period against another period before calling a trend.`]);
  return out
}
function advisor(){const out=nextMoves(),fullOperating=isPro()||mode==='demo'||mode==='demo-edited';return `${head('Next Move Advisor','Rule-based operating prompts from your inputs. These are not forecasts and they do not replace judgment.','Motion Supply operating logic')}<div class="grid g2">${out.map((x,i)=>`<div class="card"><span class="kicker">MOVE ${i+1}</span><h3>${x[0]}</h3><p>${x[1]}</p></div>`).join('')}${!fullOperating&&config.billingConfigured?`<div class="card"><span class="kicker">PRO OPERATING LAYER</span><h3>Unlock inventory, cash and PO recommendations</h3><p>Free Advisor covers core product economics and acquisition. Pro adds operating recommendations from inventory, cash, fulfillment and store-data decisions.</p><button class="primary mt" id="upgradeNow">Upgrade to Pro</button></div>`:''}</div>`}

function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function render(){ const title=$('#title'),app=$('#app');if(title)title.textContent=views[current];if(!app)return;const map={dashboard,profit,cac,funnel,discount,inventory,wholesale,launch,fulfillment,cash,po,shopify,brands:brandsView,advisor};app.innerHTML=isProLocked(current)?proGate(current):map[current]();bind();updateAccount() }

function bind(){
  document.querySelectorAll('[data-key]').forEach(el=>el.onchange=e=>{
    const key=e.target.dataset.key,raw=e.target.value;
    if(raw===''){touched.delete(key);state[key]=0}else{touched.add(key);state[key]=Number(raw)}
    mode=mode==='demo'||mode==='demo-edited'?'demo-edited':'fresh';save();if(readyProduct())trackOnce('first_calculation_completed');render()
  });
  document.querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>jumpTo(el.dataset.jump));
  const f=$('#csvFile');if(f)f.onchange=handleCsv;
  const c=$('#clearImport');if(c)c.onclick=()=>{lastImport=null;save();render()};
  const s=$('#inlineSignIn');if(s)s.onclick=showAuth;
  document.querySelectorAll('[data-deletebrand]').forEach(el=>el.onclick=()=>deleteBrand(el.dataset.deletebrand));
  const ab=$('#addBrand');if(ab)ab.onclick=addBrand;const up=$('#upgradeNow');if(up)up.onclick=upgradeFlow;
  document.querySelectorAll('[data-addsku]').forEach(b=>b.onclick=()=>addSku(b.dataset.addsku))
}
function closeMenu({restoreFocus=true}={}){const side=$('#side'),trigger=$('#menuBtn'),wasOpen=Boolean(side?.classList.contains('open')||document.body.classList.contains('menuOpen'));side?.classList.remove('open');document.body.classList.remove('menuOpen');trigger?.setAttribute('aria-expanded','false');if(wasOpen&&restoreFocus)requestAnimationFrame(()=>trigger?.focus())}
function openMenu(){const side=$('#side'),trigger=$('#menuBtn');side?.classList.add('open');document.body.classList.add('menuOpen');trigger?.setAttribute('aria-expanded','true');requestAnimationFrame(()=>($('#menuCloseBtn')||document.querySelector('#nav button'))?.focus())}
function toggleMenu(){if($('#side')?.classList.contains('open'))closeMenu();else openMenu()}
window.msboCloseMenu=closeMenu;
function jumpTo(view){track('tool_opened',{view});if(isProLocked(view)){const k=`pro_page_viewed_${view}`;if(!tracked[k]){tracked[k]=true;localStorage.setItem('msbo_tracked_events',JSON.stringify(tracked));track('pro_page_viewed',{view})}}current=view;document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===view));closeMenu();render();scrollTo(0,0)}
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
function showAuth(){if(!config.authConfigured)return alert('Account service is not fully configured on this deployment yet.');if(session)return showAccount();showModal(`<h2>Sign in / create account</h2><div class="authform"><input id="email" type="email" placeholder="Email"><input id="password" type="password" placeholder="Password (8+ characters)"><div id="authMsg" class="mini"></div><div class="split"><button id="signin" class="primary">Sign in</button><button id="signup" class="outline">Create account</button></div></div>`);$('#signin').onclick=()=>auth('signin');$('#signup').onclick=()=>auth('signup')}
async function auth(kind){if(kind==='signup')track('signup_started');const email=$('#email').value.trim(),password=$('#password').value,msg=$('#authMsg');msg.textContent='Working…';try{const x=await api(`/api/auth/${kind}`,'POST',{email,password});if(x.confirmationRequired){msg.textContent='Account created. Check your email to confirm, then sign in.';return}storeSession(x.session);if(kind==='signup')track('signup_completed');hideModal();await refreshAccount();render()}catch(e){msg.textContent=e.message}}
function showAccount(){showModal(`<h2>Account</h2><p>${escapeHtml(session?.user?.email||'Signed in')}</p><p>Plan: <b>${entitlement.plan.toUpperCase()}</b></p><div class="split"><button id="signout" class="outline">Sign out</button>${config.billingConfigured?`<button id="acctBilling" class="primary">${(entitlement.active||entitlement.billingManageable)?'Manage billing':'Upgrade to Pro'}</button>`:''}</div>`);$('#signout').onclick=()=>{storeSession(null);brands=[];skus=[];hideModal();refreshAccount();render()};const b=$('#acctBilling');if(b)b.onclick=startBilling}
async function startBilling(){try{const manage=Boolean(entitlement.active||entitlement.billingManageable);if(!manage)track('checkout_started');const endpoint=manage?'/api/create-portal-session':'/api/create-checkout-session';const x=await api(endpoint,'POST',{},true);location.href=x.url}catch(e){alert(e.message)}}
function showModal(html){closeMenu({restoreFocus:false});$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}function hideModal(){$('#modal').classList.add('hidden')}
function loadFoundryDemo(){
  state=clone(FOUNDRY_EIGHT);
  mode='demo';
  touched=new Set(Object.keys(FOUNDRY_EIGHT));
  lastImport=null;
  current='dashboard';
  save();
  render();
  document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.view==='dashboard'));
  window.scrollTo(0,0);
}
function startFreshModel(){
  state=clone(STARTER_STATE);
  mode='fresh';
  touched=new Set();
  lastImport=null;
  current='dashboard';
  save();
  render();
  document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.view==='dashboard'));
  window.scrollTo(0,0);
  const btn=$('#freshBtn');
  if(btn){const old=btn.textContent;btn.textContent='Fresh model loaded ✓';setTimeout(()=>{if(btn.isConnected)btn.textContent=old},1200)}
}

// Global controls use event delegation so they keep working after every render/state switch.
document.addEventListener('click',e=>{
  const navBtn=e.target.closest('#nav button[data-view]');
  if(navBtn){jumpTo(navBtn.dataset.view);return}
  if(e.target.closest('#menuBtn')){toggleMenu();return}
  if(e.target.closest('#menuCloseBtn')||e.target.closest('#menuBackdrop')){closeMenu();return}
  if(e.target.closest('#demoBtn')){e.preventDefault();loadFoundryDemo();return}
  if(e.target.closest('#freshBtn')){e.preventDefault();startFreshModel();return}
  if(e.target.closest('#authBtn')){showAuth();return}
  if(e.target.closest('#billingBtn')){startBilling();return}
  if(e.target.closest('#closeModal')){hideModal();return}
  if(e.target.id==='modal'){hideModal();return}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#modal')?.classList.contains('hidden'))hideModal();closeMenu()}});

init();
