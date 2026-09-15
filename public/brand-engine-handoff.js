const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>\'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const PENDING_KEY='msbo_pending_brand_name';

function loadSession(){try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}}
function validName(value){const name=String(value??'').trim().replace(/\s+/g,' ').slice(0,120);return name.length>=2?name:null}
function pendingName(){return validName(localStorage.getItem(PENDING_KEY))}
function captureQueryName(){
  const params=new URLSearchParams(location.search);const name=validName(params.get('brandEngineName'));
  if(name)localStorage.setItem(PENDING_KEY,name);
  if(params.has('brandEngineName')){params.delete('brandEngineName');const query=params.toString();history.replaceState({},document.title,`${location.pathname}${query?`?${query}`:''}${location.hash||''}`)}
  return name;
}
async function authedRequest(url,method='GET',body){
  let session=loadSession();if(!session?.access_token)throw Object.assign(new Error('Sign in first.'),{code:'AUTH_REQUIRED'});
  const headers={'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`};
  let response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined});
  if(response.status===401&&session.refresh_token){
    const refresh=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    if(refresh.ok){const data=await refresh.json();session=data.session;localStorage.setItem('msbo_session',JSON.stringify(session));headers.Authorization=`Bearer ${session.access_token}`;response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined})}
  }
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload.error||`Request failed (${response.status})`);error.status=response.status;error.code=payload.code||null;throw error}
  return payload;
}
function removeHandoff({clear=true}={}){if(clear)localStorage.removeItem(PENDING_KEY);$('#brandEngineHandoff')?.remove()}
function openBrands(){const button=$('#nav button[data-view="brands"]');if(button)button.click();else location.href='/'}
function status(message,tone=''){const el=$('#brandEngineHandoffStatus');if(el){el.textContent=message;el.className=`brandEngineHandoffStatus ${tone}`.trim()}}

function handoffHtml(name,signedIn){
  return `<div class="brandEngineHandoffRow"><div class="brandEngineHandoffCopy"><span class="kicker">BRAND ENGINE HANDOFF</span><h2>${signedIn?`Ready to initialize ${esc(name)}?`:`You picked ${esc(name)}.`}</h2><p>${signedIn?'Creating the brand is still your decision. Press Initialize to use one of your saved-brand slots.':'Sign in or create your account first. Brand OS will keep the name waiting and will not create anything automatically.'}</p></div><div class="brandEngineHandoffActions">${signedIn?`<button class="primary" id="brandEngineInitialize" type="button">Initialize ${esc(name)}</button>`:`<button class="primary" id="brandEngineAuth" type="button">Sign in / create account</button>`}<button class="outline" id="brandEngineChange" type="button">Back to Brand Engine</button><button class="outline" id="brandEngineDismiss" type="button">Dismiss</button></div></div><div id="brandEngineHandoffStatus" class="brandEngineHandoffStatus" role="status" aria-live="polite"></div>`;
}
function render(){
  const name=pendingName();if(!name){removeHandoff({clear:false});return}
  const main=$('main'),app=$('#app');if(!main||!app)return;
  let panel=$('#brandEngineHandoff');if(!panel){panel=document.createElement('section');panel.id='brandEngineHandoff';panel.className='brandEngineHandoff';app.insertAdjacentElement('beforebegin',panel)}
  panel.innerHTML=handoffHtml(name,Boolean(loadSession()?.access_token));
}
async function initialize(){
  const name=pendingName();if(!name)return removeHandoff({clear:false});
  const button=$('#brandEngineInitialize');if(button){button.disabled=true;button.textContent='Initializing…'}
  status('Creating this saved brand only after your explicit confirmation…');
  try{
    const payload=await authedRequest('/api/brands','POST',{name});
    localStorage.removeItem(PENDING_KEY);
    if(button){button.disabled=true;button.textContent='Initialized ✓'}
    status(`${payload.brand?.name||name} is now saved in Brand OS.`, 'good');
    const actions=$('.brandEngineHandoffActions');if(actions&&!$('#brandEngineOpenBrands')){const open=document.createElement('button');open.id='brandEngineOpenBrands';open.className='outline';open.type='button';open.textContent='Open Brands & SKUs';open.addEventListener('click',openBrands);actions.appendChild(open)}
  }catch(error){
    if(button){button.disabled=false;button.textContent=`Initialize ${name}`}
    if(error.status===402||error.code==='PRO_LIMIT_REACHED')status('Your free saved-brand slot is already used. Open Brands & SKUs or upgrade before creating another brand.','bad');
    else if(error.code==='AUTH_REQUIRED'||error.status===401){status('Your session expired. Sign in again, then press Initialize.','bad');render()}
    else status(error.message||'Brand could not be initialized.','bad');
  }
}

document.addEventListener('click',event=>{
  if(event.target.closest('#brandEngineInitialize')){initialize();return}
  if(event.target.closest('#brandEngineAuth')){$('#authBtn')?.click();return}
  if(event.target.closest('#brandEngineChange')){location.href='/brand-engine';return}
  if(event.target.closest('#brandEngineDismiss')){removeHandoff();return}
});

captureQueryName();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
window.addEventListener('storage',event=>{if([PENDING_KEY,'msbo_session'].includes(event.key))render()});
