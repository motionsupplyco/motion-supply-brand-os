import {generateBrandNames,domainCandidates,socialHandleCandidates} from './brand-engine-core.js';
import {trackBrandEngine} from './brand-engine-analytics.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>\'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const loadSession=()=>{try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}};
let currentNames=[];

function toast(message,tone='neutral'){
  const el=$('#engineToast');if(!el)return;el.textContent=message;el.className=`engineToast ${tone} show`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600);
}
function generate({track=true}={}){
  const seedWords=$('#seedWords')?.value||'';
  const vibe=$('#vibe')?.value||'street';
  const count=Number($('#nameCount')?.value)||12;
  currentNames=generateBrandNames({seedWords,vibe,count});
  renderNames();
  if(track)trackBrandEngine('brand_engine_names_generated',{vibe,count:currentNames.length,entrypoint:'standalone'});
}
function profileHtml(profile){
  const chips=[`${profile.words} word${profile.words===1?'':'s'}`,`${profile.characters} characters`,profile.easyHandle?'handle-friendly':'may need shorter handle'].map(text=>`<span class="chip">${esc(text)}</span>`).join('');
  const notes=(profile.notes||[]).map(note=>`<li>${esc(note)}</li>`).join('');
  return `<div class="nameMeta">${chips}</div><ul class="nameNotes">${notes}</ul>`;
}
function domainStatusHtml(domain){return `<div class="domainItem" data-domain-item="${esc(domain)}"><span class="domainName">${esc(domain)}</span><span class="domainStatus unknown">NOT CHECKED</span></div>`}
function handleHtml(handle){
  const ig=`https://www.instagram.com/${encodeURIComponent(handle)}/`;
  const tt=`https://www.tiktok.com/@${encodeURIComponent(handle)}`;
  return `<span class="handleLink">@${esc(handle)} <a href="${ig}" target="_blank" rel="noreferrer">IG ↗</a><a href="${tt}" target="_blank" rel="noreferrer">TikTok ↗</a></span>`;
}
function nameCard(item,index){
  const domains=item.domains?.length?item.domains:domainCandidates(item.name);
  const handles=item.handles?.length?item.handles:socialHandleCandidates(item.name);
  return `<article class="nameCard" data-name-index="${index}">
    <div class="nameCardTop"><div><span class="kicker">DIRECTION ${String(index+1).padStart(2,'0')}</span><h3>${esc(item.name)}</h3>${profileHtml(item.profile)}</div></div>
    <div class="candidateBlock"><div class="candidateTitle"><b>DOMAIN REGISTRATION SIGNAL</b><button type="button" data-check-domains="${index}">Check 3 domains</button></div><div class="domainList">${domains.map(domainStatusHtml).join('')}</div></div>
    <div class="candidateBlock"><div class="candidateTitle"><b>SOCIAL HANDLE VERIFICATION</b><span class="chip">VERIFY MANUALLY</span></div><div class="handles">${handles.slice(0,4).map(handleHtml).join('')}</div></div>
    <div class="cardActions"><button class="primary" type="button" data-use-name="${index}">Initialize in Brand OS</button><button class="outline" type="button" data-copy-name="${index}">Copy name</button></div>
  </article>`;
}
function renderNames(){
  const grid=$('#nameGrid'),section=$('#resultsSection');if(!grid||!section)return;
  grid.innerHTML=currentNames.map(nameCard).join('');section.hidden=false;section.scrollIntoView({behavior:'smooth',block:'start'});
}
async function checkDomains(index){
  const item=currentNames[index];if(!item)return;
  const card=$(`[data-name-index="${index}"]`);if(!card)return;
  const button=card.querySelector('[data-check-domains]');if(button){button.disabled=true;button.textContent='Checking…'}
  try{
    const response=await fetch('/api/brand-engine/domain-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domains:item.domains.slice(0,3)})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Domain check failed.');
    const results=payload.results||[];
    for(const result of results){
      const row=card.querySelector(`[data-domain-item="${CSS.escape(result.domain)}"]`);if(!row)continue;
      const status=row.querySelector('.domainStatus');
      if(status){status.className=`domainStatus ${result.status}`;status.textContent=result.status==='registered'?'REGISTERED':result.status==='not_found'?'NO RDAP RECORD':'UNKNOWN'}
      const old=row.querySelector('.domainReason');if(old)old.remove();
      const reason=document.createElement('div');reason.className='domainReason';reason.textContent=result.reason||'';row.appendChild(reason);
    }
    trackBrandEngine('brand_engine_domain_checked',{
      domain_count:results.length,
      registered_count:results.filter(result=>result.status==='registered').length,
      not_found_count:results.filter(result=>result.status==='not_found').length,
      unknown_count:results.filter(result=>result.status==='unknown').length,
      entrypoint:'standalone'
    });
  }catch(error){toast(error.message||'Domain status could not be checked.','bad')}
  finally{if(button){button.disabled=false;button.textContent='Check 3 domains'}}
}
async function initializeBrand(index){
  const item=currentNames[index];if(!item)return;
  localStorage.setItem('msbo_pending_brand_name',item.name);
  const session=loadSession();
  trackBrandEngine('brand_engine_handoff_started',{signed_in:Boolean(session?.access_token),entrypoint:'standalone'});
  if(!session?.access_token){toast('Name saved. Create or sign in to your Brand OS account to initialize it.','good');setTimeout(()=>{location.href=`/?brandEngineName=${encodeURIComponent(item.name)}`},700);return}
  try{
    const response=await fetch('/api/brands',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({name:item.name})});
    const payload=await response.json().catch(()=>({}));
    if(response.status===402){toast('Your free brand slot is already used. Open Brand OS to choose what to do next.','warn');setTimeout(()=>{location.href='/'},900);return}
    if(!response.ok)throw new Error(payload.error||'Brand could not be initialized.');
    localStorage.removeItem('msbo_pending_brand_name');
    trackBrandEngine('brand_engine_brand_initialized',{signed_in:true,entrypoint:'standalone'});
    toast(`${item.name} initialized in Brand OS ✓`,'good');setTimeout(()=>{location.href='/'},800);
  }catch(error){toast(error.message||'Brand could not be initialized.','bad')}
}

document.addEventListener('click',event=>{
  if(event.target.closest('#generateNames')||event.target.closest('#regenerate')){generate();return}
  const domainButton=event.target.closest('[data-check-domains]');if(domainButton){checkDomains(Number(domainButton.dataset.checkDomains));return}
  const useButton=event.target.closest('[data-use-name]');if(useButton){initializeBrand(Number(useButton.dataset.useName));return}
  const copyButton=event.target.closest('[data-copy-name]');if(copyButton){const item=currentNames[Number(copyButton.dataset.copyName)];if(item)navigator.clipboard?.writeText(item.name).then(()=>toast('Name copied ✓','good')).catch(()=>toast('Could not copy automatically.','warn'));return}
});

document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.closest('.engineForm')){event.preventDefault();generate()}});

trackBrandEngine('brand_engine_viewed',{entrypoint:'standalone'});
$('#seedWords').value='void archive motion';
generate({track:false});
