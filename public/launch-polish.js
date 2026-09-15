import { discountOutcome, maxSafeDiscountPct } from './discount-ceiling.js';

// Single frontend source of truth for displayed Pro pricing.
// Stripe remains the billing authority; this string is presentation only.
export const PRO_PRICE_MONTHLY=19;
export const PRO_PRICE_LABEL=`$${PRO_PRICE_MONTHLY}/month`;
const PRO_PRICE_BUTTON=`$${PRO_PRICE_MONTHLY}/mo`;

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(+n)?+n:0);
const pct=n=>`${Number(n).toFixed(1)}%`;

function setTextIfChanged(element,next){if(element&&element.textContent.trim()!==next)element.textContent=next}
function patchPricing(){
  const rules=[
    ['#billingBtn','Upgrade · '+PRO_PRICE_BUTTON,'header'],
    ['#upgradeNow','Upgrade to Pro · '+PRO_PRICE_BUTTON,'proGate'],
    ['#acctBillingOpen','Upgrade to Pro · '+PRO_PRICE_BUTTON,'account'],
    ['#memoryUpgrade','Upgrade to Pro · '+PRO_PRICE_BUTTON,'memory'],
    ['[data-v2-action="upgrade"]','Upgrade to Pro · '+PRO_PRICE_BUTTON,'v2Operating'],
    ['[data-profit-action="upgrade"]','Upgrade to Pro · '+PRO_PRICE_BUTTON,'profitGuardrails'],
    ['[data-stress-action="upgrade"]','Upgrade to Pro · '+PRO_PRICE_BUTTON,'collectionStress'],
    ['[data-preflight-action="upgrade"]','Upgrade to Pro · '+PRO_PRICE_BUTTON,'productionPreflight'],
    ['[data-quote-action="upgrade"]','Upgrade to Pro · '+PRO_PRICE_BUTTON,'factoryQuote']
  ];
  for(const [selector,label,noteKey] of rules){
    for(const button of $$(selector)){
      const text=button.textContent.trim();
      if(/manage billing|opening billing|opening checkout|saving|working/i.test(text))continue;
      if(selector==='#upgradeNow'&&/create an account|create account/i.test(text))setTextIfChanged(button,`Create account · Pro ${PRO_PRICE_BUTTON}`);
      else if(/upgrade/i.test(text))setTextIfChanged(button,label);

      if(selector!=='#billingBtn'&&button.textContent.includes(PRO_PRICE_BUTTON)){
        const next=button.nextElementSibling;
        if(!next?.matches('[data-pro-price-note]')){
          const note=document.createElement('p');
          note.className='mini mt';
          note.dataset.proPriceNote=noteKey;
          note.textContent=`Brand OS Pro — ${PRO_PRICE_LABEL} · Cancel anytime.`;
          button.insertAdjacentElement('afterend',note);
        }
      }
    }
  }
}

function safeStoredJson(key,fallback){
  try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}
}
function discountModel(){
  const state=safeStoredJson('msbo_state',{});
  const touched=new Set(safeStoredJson('msbo_touched',[]));
  const mode=localStorage.getItem('msbo_mode')||'fresh';
  const demo=mode==='demo'||mode==='demo-edited';
  const has=key=>demo||touched.has(key);
  const directCac=has('observedCac');
  const calculatedCac=has('adSpend')&&has('newCustomers')&&Number(state.newCustomers)>0?Math.max(0,Number(state.adSpend)||0)/Math.max(0,Number(state.newCustomers)||0):null;
  const effectiveCac=directCac?Math.max(0,Number(state.observedCac)||0):calculatedCac;
  const ready=has('price')&&Number(state.price)>0&&has('landedCost')&&has('requiredPostCac')&&effectiveCac!==null;
  return {ready,state:{...state,observedCac:effectiveCac??0},affiliatePct:Number(state.affiliatePct)||0};
}

function reportDiscountError(error){
  console.error('discount-ceiling-ui',error);
  try{
    const anonymousId=localStorage.getItem('msbo_anon_id')||null;
    fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_name:'discount_ceiling_error',anonymous_id:anonymousId,properties:{message:String(error?.message||error).slice(0,300)}})}).catch(()=>{});
  }catch{}
}

function patchDiscountCeiling(){
  if($('#title')?.textContent.trim()!=='Discount Ceiling')return;
  const app=$('#app');
  if(!app||$('#exactDiscountCeiling'))return;
  const model=discountModel();
  if(!model.ready)return;
  try{
    const max=maxSafeDiscountPct(model.state,model.affiliatePct);
    const anchor=app.querySelector('.sourceLine')||app.querySelector('.toolhead');
    if(!anchor)return;
    const card=document.createElement('div');
    card.id='exactDiscountCeiling';
    card.className='card mt';
    if(max===null){
      card.innerHTML=`<span class="kicker">EXACT CEILING</span><h3>No modeled safe discount right now</h3><p class="muted">At full price, the current cost + CAC stack does not preserve your required post-CAC contribution floor. Fix the economics before discounting.</p>`;
      anchor.insertAdjacentElement('afterend',card);
      return;
    }
    const rounded=Math.max(0,Math.min(100,max));
    card.innerHTML=`<span class="kicker">EXACT CEILING</span><div class="grid g2"><div><h3>Maximum modeled safe discount</h3><div style="font-family:SFMono-Regular,Consolas,monospace;font-size:40px;font-weight:700;letter-spacing:-.04em;margin:8px 0">${pct(rounded)}</div><p class="mini">At the costs, CAC, affiliate commission and contribution floor currently in your model. Give yourself room instead of operating exactly on the edge.</p></div><div><div class="field"><label for="plannedDiscountPct">Test your planned discount %</label><input id="plannedDiscountPct" type="number" min="0" max="100" step="0.1" value="${Math.min(15,rounded).toFixed(1)}"><small>Use the exact offer you plan to publish.</small></div><div id="plannedDiscountResult" class="advice mt"></div></div></div>`;
    anchor.insertAdjacentElement('afterend',card);
    const input=$('#plannedDiscountPct'),result=$('#plannedDiscountResult');
    const renderTest=()=>{
      const value=Math.min(100,Math.max(0,Number(input?.value)||0));
      const out=discountOutcome(model.state,value,model.affiliatePct);
      if(result)result.innerHTML=`<b>${out.pass?'PASS':'FAIL'} · ${pct(value)} off</b>Realized price ${money(out.realizedPrice)} · after-CAC contribution ${money(out.afterCac)} · required floor ${money(out.floor)}.`;
    };
    input?.addEventListener('input',renderTest);
    renderTest();
  }catch(error){reportDiscountError(error)}
}

let scheduled=false;
function enhance(){
  scheduled=false;
  patchPricing();
  patchDiscountCeiling();
}
function scheduleEnhance(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(enhance);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleEnhance,{once:true});else scheduleEnhance();
new MutationObserver(scheduleEnhance).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
