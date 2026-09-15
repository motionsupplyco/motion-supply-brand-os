import {collectionScenario,collectionCashSchedule,breakEvenSellThroughPct} from './collection-stress.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number.isFinite(Number(value))?Number(value):0);
const money2=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(Number(value))?Number(value):0);
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const mode=()=>localStorage.getItem('msbo_mode')||'fresh';
const loadSession=()=>{try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}};
const STORE_KEY='msbo_collection_stress_v1';
let active=false;
let account=null;

function emptyState(){return {
  name:'',retailPrice:null,landedCost:null,factoryUnitCost:null,markdownPct:null,unitsPerOrder:null,
  processorPercent:null,processorFixed:null,packagingPerOrder:null,shippingSubsidyPerOrder:null,returnHandlingPerReturn:null,
  cacPerOrder:null,fixedLaunchCost:null,depositPct:null,balanceDueWeek:null,freightDutyWeek:null,launchWeek:null,
  variants:[{key:'S',label:'S',units:null},{key:'M',label:'M',units:null},{key:'L',label:'L',units:null},{key:'XL',label:'XL',units:null}],
  scenarios:{
    best:{name:'Best',sellThroughPct:null,fullPriceShareOfSoldPct:null,returnRatePct:null,restockableReturnPct:null},
    base:{name:'Base',sellThroughPct:null,fullPriceShareOfSoldPct:null,returnRatePct:null,restockableReturnPct:null},
    downside:{name:'Downside',sellThroughPct:null,fullPriceShareOfSoldPct:null,returnRatePct:null,restockableReturnPct:null}
  },
  baseVariantSellThrough:{}
}}
function demoState(){return {
  name:'Foundry Eight · Heavy Hoodie Drop',retailPrice:84,landedCost:24.70,factoryUnitCost:19,markdownPct:20,unitsPerOrder:1.25,
  processorPercent:2.9,processorFixed:.30,packagingPerOrder:1.20,shippingSubsidyPerOrder:4.50,returnHandlingPerReturn:4,
  cacPerOrder:18,fixedLaunchCost:2200,depositPct:50,balanceDueWeek:5,freightDutyWeek:5,launchWeek:2,
  variants:[{key:'S',label:'S',units:100},{key:'M',label:'M',units:150},{key:'L',label:'L',units:150},{key:'XL',label:'XL',units:75}],
  scenarios:{
    best:{name:'Best',sellThroughPct:90,fullPriceShareOfSoldPct:92,returnRatePct:7,restockableReturnPct:85},
    base:{name:'Base',sellThroughPct:78,fullPriceShareOfSoldPct:85,returnRatePct:10,restockableReturnPct:80},
    downside:{name:'Downside',sellThroughPct:55,fullPriceShareOfSoldPct:65,returnRatePct:14,restockableReturnPct:75}
  },
  baseVariantSellThrough:{S:82,M:86,L:78,XL:60}
}}
function loadModel(){
  if(mode().startsWith('demo'))return demoState();
  try{const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null');return saved&&typeof saved==='object'?{...emptyState(),...saved}:emptyState()}catch{return emptyState()}
}
function saveModel(model){if(!mode().startsWith('demo'))localStorage.setItem(STORE_KEY,JSON.stringify(model))}

async function api(url,{method='GET',body=null}={}){
  const session=loadSession();
  const headers={'Content-Type':'application/json'};
  if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  const response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.error||`Request failed (${response.status})`);error.status=response.status;error.code=payload.code||null;throw error}
  return payload
}
async function access(){
  if(mode().startsWith('demo'))return {pro:true,demo:true};
  if(!loadSession())return {pro:false,signedIn:false};
  if(!account)account=await api('/api/account');
  return {pro:Boolean(account.active),signedIn:true}
}
const badge=(label,tone='neutral')=>`<span class="v2Badge ${tone}">${esc(label)}</span>`;
const field=(key,label,value,{step='.01',placeholder='',min='0',max=''}={})=>`<label class="stressField"><span>${esc(label)}</span><input data-stress-key="${key}" type="number" step="${step}" min="${min}" ${max!==''?`max="${max}"`:''} value="${value===null||value===undefined?'':esc(value)}" placeholder="${esc(placeholder)}"></label>`;
const textField=(key,label,value,placeholder='')=>`<label class="stressField"><span>${esc(label)}</span><input data-stress-key="${key}" value="${esc(value||'')}" placeholder="${esc(placeholder)}"></label>`;

function proGate(){
  if(!loadSession())return `<div class="v2Hero"><div><span class="kicker">DROP PLANNING</span><h2>Collection Stress Tester</h2><p>Stress-test a clothing drop before you wire the factory.</p></div></div><div class="v2Gate"><span class="kicker">ACCOUNT REQUIRED</span><h3>Keep collection scenarios tied to your operating model.</h3><p>Sign in first, then use the Foundry Eight demo or your own collection assumptions.</p><button class="primary" data-stress-action="signin">Sign in</button></div>`;
  return `<div class="v2Hero"><div><span class="kicker">DROP PLANNING</span><h2>Collection Stress Tester</h2><p>Stress-test sell-through, markdowns, returns, inventory and factory cash before approving production.</p></div></div><div class="v2Gate"><span class="kicker">BRAND OS PRO</span><h3>Know whether the drop survives the downside case.</h3><p>Collection stress testing connects inventory economics to the cash operating layer.</p><button id="upgradeNow" class="primary" data-stress-action="upgrade">Upgrade to Pro</button></div>`
}

function collectionInput(model){
  const totalUnits=model.variants.reduce((sum,variant)=>sum+num(variant.units),0);
  return `<div class="stressPanel">
    <div class="stressPanelHead"><div><span class="kicker">01 · COLLECTION</span><h3>Build the production commitment</h3></div>${badge(`${totalUnits.toLocaleString()} UNITS`,'signal')}</div>
    <div class="stressGrid g4">
      ${textField('name','Collection / drop name',model.name,'Fall Heavyweight Drop')}
      ${field('retailPrice','Retail price',model.retailPrice,{placeholder:'84'})}
      ${field('landedCost','Landed cost / unit',model.landedCost,{placeholder:'24.70'})}
      ${field('factoryUnitCost','Factory unit cost',model.factoryUnitCost,{placeholder:'19.00'})}
      ${field('markdownPct','Markdown %',model.markdownPct,{step:'.1',max:'100',placeholder:'20'})}
      ${field('unitsPerOrder','Units / order',model.unitsPerOrder,{step:'.01',placeholder:'1.25'})}
      ${field('cacPerOrder','CAC / order',model.cacPerOrder,{placeholder:'18'})}
      ${field('fixedLaunchCost','Fixed launch spend',model.fixedLaunchCost,{placeholder:'2200'})}
    </div>
    <div class="stressSubhead"><b>SIZE / VARIANT CURVE</b><button class="outline" data-stress-action="add-variant">+ Add size</button></div>
    <div class="stressVariantRows">${model.variants.map((variant,index)=>`<div class="stressVariant" data-variant-index="${index}"><input data-variant-field="label" value="${esc(variant.label)}" placeholder="Size / SKU"><input data-variant-field="units" type="number" min="0" step="1" value="${variant.units===null||variant.units===undefined?'':esc(variant.units)}" placeholder="Units"><button class="ghost" data-stress-action="remove-variant" data-variant-index="${index}" ${model.variants.length<=1?'disabled':''}>×</button></div>`).join('')}</div>
  </div>`
}

function costInput(model){return `<div class="stressPanel">
  <div class="stressPanelHead"><div><span class="kicker">02 · ORDER ECONOMICS</span><h3>Count the cash that leaks out of every sale</h3></div></div>
  <div class="stressGrid g5">
    ${field('processorPercent','Processor %',model.processorPercent,{step:'.1',max:'100',placeholder:'2.9'})}
    ${field('processorFixed','Processor fixed / order',model.processorFixed,{placeholder:'.30'})}
    ${field('packagingPerOrder','Packaging / order',model.packagingPerOrder,{placeholder:'1.20'})}
    ${field('shippingSubsidyPerOrder','Shipping subsidy / order',model.shippingSubsidyPerOrder,{placeholder:'4.50'})}
    ${field('returnHandlingPerReturn','Return handling / return',model.returnHandlingPerReturn,{placeholder:'4'})}
  </div>
</div>`}

function scenarioInputs(model){
  const scenarioRow=(key,scenario)=>`<div class="stressScenarioRow" data-scenario="${key}"><b>${esc(scenario.name)}</b><label><span>Sell-through %</span><input data-scenario-field="sellThroughPct" type="number" min="0" max="100" step=".1" value="${scenario.sellThroughPct??''}"></label><label><span>Full-price share %</span><input data-scenario-field="fullPriceShareOfSoldPct" type="number" min="0" max="100" step=".1" value="${scenario.fullPriceShareOfSoldPct??''}"></label><label><span>Return rate %</span><input data-scenario-field="returnRatePct" type="number" min="0" max="100" step=".1" value="${scenario.returnRatePct??''}"></label><label><span>Restockable returns %</span><input data-scenario-field="restockableReturnPct" type="number" min="0" max="100" step=".1" value="${scenario.restockableReturnPct??''}"></label></div>`;
  return `<div class="stressPanel"><div class="stressPanelHead"><div><span class="kicker">03 · STRESS CASES</span><h3>Do not approve a PO from one optimistic forecast</h3></div></div><div class="stressScenarioStack">${scenarioRow('best',model.scenarios.best)}${scenarioRow('base',model.scenarios.base)}${scenarioRow('downside',model.scenarios.downside)}</div><p class="stressFoot">Sell-through is the share of starting units expected to sell. Full-price share is the share of sold units expected to sell before markdown. No hidden benchmark is applied.</p></div>`
}
function sizeRiskInputs(model){return `<div class="stressPanel"><div class="stressPanelHead"><div><span class="kicker">04 · BASE SIZE CURVE</span><h3>Catch the size that turns into dead stock</h3></div>${badge('OPTIONAL','neutral')}</div><div class="stressSizeGrid">${model.variants.map((variant,index)=>`<label><span>${esc(variant.label||`Variant ${index+1}`)}</span><input data-size-stress-key="${esc(variant.key)}" type="number" min="0" max="100" step=".1" placeholder="Use base %" value="${model.baseVariantSellThrough?.[variant.key]??''}"></label>`).join('')}</div><p class="stressFoot">Leave a size blank to use the Base scenario's overall sell-through. Add a size-specific percentage only when you have a reason to model a different curve.</p></div>`}
function timingInputs(model){return `<div class="stressPanel"><div class="stressPanelHead"><div><span class="kicker">05 · CASH TIMING</span><h3>Model when the money actually leaves</h3></div></div><div class="stressGrid g4">${field('depositPct','Factory deposit %',model.depositPct,{step:'1',max:'100',placeholder:'50'})}${field('balanceDueWeek','Balance due week',model.balanceDueWeek,{step:'1',min:'1',max:'13',placeholder:'5'})}${field('freightDutyWeek','Freight / duty week',model.freightDutyWeek,{step:'1',min:'1',max:'13',placeholder:'5'})}${field('launchWeek','Launch spend week',model.launchWeek,{step:'1',min:'1',max:'13',placeholder:'2'})}</div></div>`}

function collectModel(){
  const model=loadModel();
  $$('[data-stress-key]').forEach(input=>{model[input.dataset.stressKey]=input.type==='number'?(input.value===''?null:num(input.value)):input.value.trim()});
  model.variants=$$('[data-variant-index]').map((row,index)=>{
    const label=row.querySelector('[data-variant-field="label"]')?.value.trim()||`Variant ${index+1}`;
    const unitsRaw=row.querySelector('[data-variant-field="units"]')?.value;
    return {key:label||`variant-${index+1}`,label,units:unitsRaw===''?null:num(unitsRaw)}
  });
  for(const row of $$('[data-scenario]')){
    const key=row.dataset.scenario,scenario={...(model.scenarios?.[key]||{}),name:key[0].toUpperCase()+key.slice(1)};
    row.querySelectorAll('[data-scenario-field]').forEach(input=>{scenario[input.dataset.scenarioField]=input.value===''?null:num(input.value)});
    model.scenarios[key]=scenario;
  }
  model.baseVariantSellThrough={};
  $$('[data-size-stress-key]').forEach(input=>{if(input.value!=='')model.baseVariantSellThrough[input.dataset.sizeStressKey]=num(input.value)});
  saveModel(model);return model
}
function collectionForMath(model){return {...model,variants:model.variants.map(variant=>({...variant,landedCost:model.landedCost,factoryUnitCost:model.factoryUnitCost}))}}
function completeScenario(scenario){return ['sellThroughPct','fullPriceShareOfSoldPct','returnRatePct','restockableReturnPct'].every(key=>scenario?.[key]!==null&&scenario?.[key]!==undefined&&scenario?.[key]!=='')}
function ready(model){return num(model.retailPrice)>0&&num(model.landedCost)>=0&&model.variants.some(variant=>num(variant.units)>0)&&completeScenario(model.scenarios.base)}

function scenarioCard(result,tone){
  const cashTone=result.collectionCashRecovery>=0?'good':'bad';
  return `<article class="stressResult ${tone}"><div class="stressResultHead"><div><span class="kicker">${esc(result.name.toUpperCase())}</span><h3>${result.overallSellThroughPct.toFixed(1)}% sell-through</h3></div>${badge(result.collectionCashRecovery>=0?'CASH RECOVERED':'CASH NOT RECOVERED',cashTone)}</div><div class="stressResultGrid"><div><small>NET MERCH REVENUE</small><b>${money(result.netMerchandiseRevenue)}</b></div><div><small>AFTER CAC</small><b>${money(result.contributionAfterAcquisition)}</b></div><div><small>AFTER FIXED</small><b>${money(result.contributionAfterFixed)}</b></div><div><small>COLLECTION CASH RECOVERY</small><b class="${result.collectionCashRecovery<0?'negative':''}">${money(result.collectionCashRecovery)}</b></div><div><small>ENDING INVENTORY @ COST</small><b>${money(result.endingInventoryAtCost)}</b></div><div><small>EXPECTED RETURNS</small><b>${result.expectedReturnUnits.toFixed(1)} u</b></div></div></article>`
}
function results(model){
  if(!ready(model))return `<div class="stressEmpty"><span class="kicker">NO RESULT YET</span><h3>Build the Base case first.</h3><p>Add units, price, landed cost and all four Base scenario assumptions. Brand OS will not fill missing business assumptions for you.</p></div>`;
  const input=collectionForMath(model);
  const best=completeScenario(model.scenarios.best)?collectionScenario(input,model.scenarios.best):null;
  const base=collectionScenario(input,{...model.scenarios.base,variantSellThroughPct:Object.keys(model.baseVariantSellThrough||{}).length?model.baseVariantSellThrough:null});
  const downside=completeScenario(model.scenarios.downside)?collectionScenario(input,model.scenarios.downside):null;
  const threshold=breakEvenSellThroughPct(input,model.scenarios.base);
  const schedule=collectionCashSchedule(input,model.scenarios.base);
  const largestLeftover=[...base.variants].sort((a,b)=>b.endingInventoryAtCost-a.endingInventoryAtCost)[0];
  const downsideWarning=downside&&downside.collectionCashRecovery<0?`Downside case leaves ${money2(Math.abs(downside.collectionCashRecovery))} of collection cash unrecovered before valuing leftover inventory.`:'The downside case still recovers the modeled collection cash commitment.';
  return `<div class="stressDecision"><div class="stressDecisionIcon">${base.collectionCashRecovery>=0?'✓':'!'}</div><section><span class="kicker">BASE CASE DECISION</span><h3>${base.collectionCashRecovery>=0?'The drop recovers the modeled cash commitment.':'The drop does not recover the modeled cash commitment.'}</h3><p>${downsideWarning} ${largestLeftover?`${largestLeftover.label} holds the most ending inventory capital at about ${money2(largestLeftover.endingInventoryAtCost)}.`:''}</p></section></div>
  <div class="stressKpis"><div><small>PRODUCTION CASH</small><b>${money(base.productionCashCost)}</b></div><div><small>FACTORY DEPOSIT</small><b>${money(schedule.factoryDeposit)}</b><span>Week 1</span></div><div><small>FACTORY BALANCE</small><b>${money(schedule.factoryBalance)}</b><span>Week ${num(model.balanceDueWeek)||1}</span></div><div><small>BREAK-EVEN SELL-THROUGH</small><b>${threshold===null?'Not reachable':threshold.toFixed(1)+'%'}</b><span>cash-recovery threshold</span></div></div>
  <div class="stressResultStack">${best?scenarioCard(best,'best'):''}${scenarioCard(base,'base')}${downside?scenarioCard(downside,'downside'):''}</div>
  <div class="stressInventoryTable"><div class="stressPanelHead"><div><span class="kicker">BASE INVENTORY RISK</span><h3>What is still sitting after the modeled drop</h3></div></div><div class="table"><table><thead><tr><th>Size / SKU</th><th>Start</th><th>Sell-through</th><th>Expected returns</th><th>Ending sellable</th><th>Cash tied @ cost</th></tr></thead><tbody>${base.variants.map(variant=>`<tr><td><b>${esc(variant.label)}</b></td><td>${variant.startingUnits.toFixed(0)}</td><td>${variant.sellThroughPct.toFixed(1)}%</td><td>${variant.expectedReturnUnits.toFixed(1)}</td><td>${variant.endingSellableUnits.toFixed(1)}</td><td>${money2(variant.endingInventoryAtCost)}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="v2Decision"><div>i</div><section><b>Cash recovery is not accounting profit.</b><p>This view treats the full production buy as cash committed to the collection and separately shows ending inventory at cost. It is designed for a founder deciding whether the drop is safe to fund, not for tax reporting.</p></section></div>`
}

async function render(){
  active=true;$$('#nav button').forEach(button=>button.classList.remove('active'));document.querySelector('[data-collection-view="collectionstress"]')?.classList.add('active');
  const title=$('#title');if(title)title.textContent='Collection Stress Tester';
  const app=$('#app');if(!app)return;
  const permission=await access().catch(()=>({pro:false,signedIn:Boolean(loadSession())}));
  if(!permission.pro){app.innerHTML=proGate();return}
  const model=loadModel();
  app.innerHTML=`<div class="v2Hero"><div><span class="kicker">DROP PLANNING</span><h2>Collection Stress Tester</h2><p>Model the production buy before the deposit leaves your account. Stress sell-through, markdowns, returns, acquisition, size risk and supplier payment timing together.</p></div>${badge(mode().startsWith('demo')?'FOUNDRY EIGHT · DEMO':'PRO DROP MODEL','signal')}</div><div class="stressToolbar"><div><b>${mode().startsWith('demo')?'Demo assumptions are explicit.':'Blank means unknown — Brand OS will not invent it.'}</b><span>Use your own quote, size curve and selling assumptions before approving production.</span></div><div class="split"><button class="outline" data-stress-action="reset">Start blank</button><button class="outline" data-stress-action="demo">Load example drop</button><button class="primary" data-stress-action="run">Run stress test</button></div></div>${collectionInput(model)}${costInput(model)}${scenarioInputs(model)}${sizeRiskInputs(model)}${timingInputs(model)}<div id="stressResults">${results(model)}</div>`
}
function rerenderResults(){const model=collectModel();const target=$('#stressResults');if(target)target.innerHTML=results(model)}

function addVariant(){const model=collectModel();const index=model.variants.length+1;model.variants.push({key:`VAR-${index}`,label:`VAR ${index}`,units:null});saveModel(model);render()}
function removeVariant(index){const model=collectModel();if(model.variants.length<=1)return;model.variants.splice(index,1);saveModel(model);render()}
function loadExample(){localStorage.setItem(STORE_KEY,JSON.stringify(demoState()));const previous=localStorage.getItem('msbo_mode');if(!previous?.startsWith('demo'))localStorage.setItem('msbo_collection_example_only','1');render()}
function startBlank(){localStorage.setItem(STORE_KEY,JSON.stringify(emptyState()));render()}

document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-collection-view="collectionstress"]');
  if(trigger){event.preventDefault();event.stopPropagation();render();window.scrollTo(0,0);return}
  if(active&&event.target.closest('#nav button[data-view],#memoryNav,[data-v2-view]'))active=false;
  const action=event.target.closest('[data-stress-action]');if(!action)return;
  if(action.dataset.stressAction==='signin'){$('#authBtn')?.click();return}
  if(action.dataset.stressAction==='upgrade'){$('#billingBtn')?.click();return}
  if(action.dataset.stressAction==='run'){rerenderResults();return}
  if(action.dataset.stressAction==='add-variant'){addVariant();return}
  if(action.dataset.stressAction==='remove-variant'){removeVariant(Number(action.dataset.variantIndex));return}
  if(action.dataset.stressAction==='demo'){loadExample();return}
  if(action.dataset.stressAction==='reset'){startBlank();return}
});

document.addEventListener('change',event=>{if(active&&(event.target.matches('[data-stress-key],[data-variant-field],[data-scenario-field],[data-size-stress-key]')))collectModel()});
