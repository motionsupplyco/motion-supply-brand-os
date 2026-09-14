const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const MEMORY_SECTIONS=[
  ['brand_positioning','Brand positioning','What should Brand OS remember about what the brand stands for, its aesthetic, category, promise, and what makes it different?'],
  ['target_customer','Target customer','Who are you actually selling to? Include age/life stage, style, buying behavior, price sensitivity, and what they care about.'],
  ['operating_priorities','Current priorities','What matters most right now—launching, clearing inventory, protecting cash, improving conversion, scaling ads, wholesale, or something else?'],
  ['supplier_production','Supplier & production context','Factory/supplier constraints, MOQs, lead times, deposits, quality issues, restock realities, or production rules Brand OS should remember.'],
  ['marketing_context','Marketing context','Channels, content style, creator strategy, paid acquisition context, offers, launch cadence, and what has or has not been working.'],
  ['financial_guardrails','Financial guardrails','Cash floor, margin rules, CAC limits, inventory risk tolerance, discount rules, or other money decisions you do not want the business to violate.']
];

function loadSession(){try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}}
function storeSession(s){if(s)localStorage.setItem('msbo_session',JSON.stringify(s));else localStorage.removeItem('msbo_session')}
async function request(url,method='GET',body){
  let session=loadSession();
  const headers={'Content-Type':'application/json',...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{})};
  let res=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined});
  if(res.status===401&&session?.refresh_token){
    const rr=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    if(rr.ok){const data=await rr.json();storeSession(data.session);session=data.session;headers.Authorization=`Bearer ${session.access_token}`;res=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined})}
  }
  const data=await res.json().catch(()=>({}));
  if(!res.ok){const e=new Error(data.error||`Request failed (${res.status})`);e.status=res.status;e.code=data.code;throw e}
  return data
}

async function renderBusinessMemory(initialScope=''){
  const app=$('#app'),title=$('#title');if(!app)return;
  if(title)title.textContent='Business Memory';
  document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.id==='memoryNav'));
  $('#side')?.classList.remove('open');
  if(!loadSession()){
    app.innerHTML='<div class="toolhead"><div><span class="kicker">PRO OPERATING LAYER</span><h2>Business Memory</h2><p class="muted">Give Brand OS durable context so recommendations do not start from zero every session.</p></div><span class="source">CLOUD</span></div><div class="card"><h3>Sign in first</h3><p>Business Memory is attached to your secure account and is not stored as anonymous browser data.</p><button id="memorySignIn" class="primary">Sign in</button></div>';
    $('#memorySignIn').onclick=()=>$('#authBtn')?.click();return;
  }
  app.innerHTML='<div class="card"><p>Loading Business Memory…</p></div>';
  try{
    const [memoryResult,brandResult]=await Promise.all([request('/api/business-memory'),request('/api/brands')]);
    const brands=brandResult.brands||[];
    const validScope=initialScope&&brands.some(b=>String(b.id)===String(initialScope))?String(initialScope):'';
    drawMemory(memoryResult.memory||[],brands,validScope);
  }catch(e){
    if(e.status===402){
      app.innerHTML='<div class="toolhead"><div><span class="kicker">PRO OPERATING LAYER</span><h2>Business Memory</h2><p class="muted">Persistent context for better operating decisions.</p></div><span class="source">PRO</span></div><div class="card"><h3>Business Memory is a Pro feature</h3><p>Free keeps the core calculators. Pro adds saved operating context so Brand OS can remember the business between sessions.</p><button id="memoryUpgrade" class="primary">Upgrade to Pro</button></div>';
      $('#memoryUpgrade').onclick=()=>$('#billingBtn')?.click();return;
    }
    app.innerHTML=`<div class="card"><h3>Business Memory could not load</h3><p>${esc(e.message)}</p><button id="memoryRetry" class="outline">Try again</button></div>`;
    $('#memoryRetry').onclick=()=>renderBusinessMemory(initialScope);
  }
}

function drawMemory(allMemory,brands,scope){
  const app=$('#app');
  const scoped=allMemory.filter(x=>scope?String(x.brand_id)===String(scope):!x.brand_id);
  const byKey=new Map(scoped.map(x=>[x.memory_key,x]));
  const scopeLabel=scope?brands.find(b=>String(b.id)===String(scope))?.name||'Selected brand':'All-brand / company context';
  app.innerHTML=`<div class="toolhead"><div><span class="kicker">OPERATING CONTEXT</span><h2>Business Memory</h2><p class="muted">Store facts and rules Brand OS should carry into future decisions. Keep this factual and update it when the business changes.</p></div><span class="source">PRO · CLOUD</span></div>
  <div class="card"><label><b>Memory scope</b></label><select id="memoryScope" style="width:100%;margin-top:8px;padding:11px;border:1px solid #ccc;border-radius:8px"><option value="">All-brand / company context</option>${brands.map(b=>`<option value="${esc(b.id)}" ${String(scope)===String(b.id)?'selected':''}>${esc(b.name)}</option>`).join('')}</select><p class="mini mt">Currently editing: <b>${esc(scopeLabel)}</b>. Brand-specific memory stays separate from company-wide context.</p></div>
  <div class="grid g2 mt">${MEMORY_SECTIONS.map(([key,label,help])=>{const row=byKey.get(key),text=row?.value?.text||'';return `<div class="card"><span class="kicker">MEMORY</span><h3>${esc(label)}</h3><p class="mini">${esc(help)}</p><textarea id="memory-${key}" rows="7" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #ccc;border-radius:8px;resize:vertical">${esc(text)}</textarea><div class="split mt"><button class="primary" data-memory-save="${key}">Save</button>${row?`<button class="outline" data-memory-clear="${esc(row.id)}">Clear</button>`:''}</div><div class="mini mt" id="memory-msg-${key}"></div></div>`}).join('')}</div>
  <div class="advice mt"><b>What this is for</b>Business Memory should hold durable context—not temporary dashboard numbers. Calculators should still use current inputs and imported data for math.</div>`;
  $('#memoryScope').onchange=e=>drawMemory(allMemory,brands,e.target.value);
  document.querySelectorAll('[data-memory-save]').forEach(btn=>btn.onclick=()=>saveMemory(btn.dataset.memorySave,scope));
  document.querySelectorAll('[data-memory-clear]').forEach(btn=>btn.onclick=()=>clearMemory(btn.dataset.memoryClear,scope));
}

async function saveMemory(key,scope){
  const text=$(`#memory-${key}`)?.value.trim()||'',msg=$(`#memory-msg-${key}`);
  if(!text){if(msg)msg.textContent='Add something useful before saving.';return}
  if(msg)msg.textContent='Saving…';
  try{await request(`/api/business-memory/${encodeURIComponent(key)}`,'PUT',{brand_id:scope||null,value:{text}});if(msg)msg.textContent='Saved ✓';setTimeout(()=>renderBusinessMemory(scope),500)}catch(e){if(msg)msg.textContent=e.message}
}

async function clearMemory(id,scope){
  try{await request(`/api/business-memory/${encodeURIComponent(id)}`,'DELETE');await renderBusinessMemory(scope)}catch(e){alert(e.message)}
}

document.addEventListener('click',e=>{
  if(e.target.closest('#memoryNav')){e.preventDefault();e.stopImmediatePropagation();renderBusinessMemory();window.scrollTo(0,0)}
},true);
