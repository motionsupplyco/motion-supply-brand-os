import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function replaceOnce(text, from, to, label){
  if(!text.includes(from)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(from,to);
}
function appendOnce(text, marker, addition){
  return text.includes(marker)?text:`${text.trimEnd()}\n\n${addition}\n`;
}

// Restore the known-good app immediately before the accidental c078 broad rewrite.
let app=execFileSync('git',['show','e4507c2e41a037bedb54c842524188de92643044:public/app.js'],{encoding:'utf8'});

app=replaceOnce(app,
"async function api(url,method='GET',body,withAuth=false){",
"async function api(url,method='GET',body,withAuth=false,signal=null){",
'api supports abort signal');
app=replaceOnce(app,
"try{r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined})}catch{throw new Error('Brand OS could not reach its server. Refresh the page and check the deployment status.')}",
"try{r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,signal})}catch(e){if(e?.name==='AbortError')throw e;throw new Error('Brand OS could not reach its server. Refresh the page and check the deployment status.')}",
'api initial fetch abort handling');
app=replaceOnce(app,
"r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined})",
"r=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,signal})",
'api retry fetch abort handling');
app=replaceOnce(app,
"<div class=\"skuBar\"><div><b>${escapeHtml(b.name)}</b><div class=\"mini\">${escapeHtml(b.currency)}</div></div></div>",
"<div class=\"skuBar\"><div><b>${escapeHtml(b.name)}</b><div class=\"mini\">${escapeHtml(b.currency)}</div></div><button class=\"ghost\" data-deletebrand=\"${b.id}\" type=\"button\">Delete brand</button></div>",
'brand delete button');
app=replaceOnce(app,
"async function addSku(brandId){",
`async function deleteBrand(brandId){
  const brand=brands.find(b=>String(b.id)===String(brandId));
  if(!brand)return;
  const skuCount=skus.filter(s=>String(s.brand_id)===String(brandId)).length;
  const warning=skuCount?\`Delete \${brand.name} and its \${skuCount} saved SKU\${skuCount===1?'':'s'}? This cannot be undone.\`:\`Delete \${brand.name}? This cannot be undone.\`;
  if(!confirm(warning))return;
  const btn=document.querySelector(\`[data-deletebrand="\${CSS.escape(String(brandId))}"]\`);
  if(btn?.disabled)return;
  const oldText=btn?.textContent||'Delete brand';
  if(btn){btn.disabled=true;btn.textContent='Deleting…'}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    await api(\`/api/brands/\${encodeURIComponent(brandId)}\`,'DELETE',null,true,controller.signal);
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

async function addSku(brandId){`,
'delete brand behavior');
app=replaceOnce(app,
"const s=$('#inlineSignIn');if(s)s.onclick=showAuth;\n  const ab=$('#addBrand');",
"const s=$('#inlineSignIn');if(s)s.onclick=showAuth;\n  document.querySelectorAll('[data-deletebrand]').forEach(el=>el.onclick=()=>deleteBrand(el.dataset.deletebrand));\n  const ab=$('#addBrand');",
'brand delete binding');
app=replaceOnce(app,
"function jumpTo(view){track('tool_opened',{view});if(isProLocked(view)){const k=`pro_page_viewed_${view}`;if(!tracked[k]){tracked[k]=true;localStorage.setItem('msbo_tracked_events',JSON.stringify(tracked));track('pro_page_viewed',{view})}}current=view;document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('#side')?.classList.remove('open');render();scrollTo(0,0)}",
`function closeMenu({restoreFocus=true}={}){const side=$('#side'),trigger=$('#menuBtn'),wasOpen=Boolean(side?.classList.contains('open')||document.body.classList.contains('menuOpen'));side?.classList.remove('open');document.body.classList.remove('menuOpen');trigger?.setAttribute('aria-expanded','false');if(wasOpen&&restoreFocus)requestAnimationFrame(()=>trigger?.focus())}
function openMenu(){const side=$('#side'),trigger=$('#menuBtn');side?.classList.add('open');document.body.classList.add('menuOpen');trigger?.setAttribute('aria-expanded','true');requestAnimationFrame(()=>($('#menuCloseBtn')||document.querySelector('#nav button'))?.focus())}
function toggleMenu(){if($('#side')?.classList.contains('open'))closeMenu();else openMenu()}
window.msboCloseMenu=closeMenu;
function jumpTo(view){track('tool_opened',{view});if(isProLocked(view)){const k=\`pro_page_viewed_\${view}\`;if(!tracked[k]){tracked[k]=true;localStorage.setItem('msbo_tracked_events',JSON.stringify(tracked));track('pro_page_viewed',{view})}}current=view;document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===view));closeMenu();render();scrollTo(0,0)}`,
'mobile menu state machine');
app=replaceOnce(app,
"function showModal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}function hideModal(){$('#modal').classList.add('hidden')}",
"function showModal(html){closeMenu({restoreFocus:false});$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}function hideModal(){$('#modal').classList.add('hidden')}",
'modal closes nav');
app=replaceOnce(app,
"if(e.target.closest('#menuBtn')){$('#side')?.classList.toggle('open');return}",
"if(e.target.closest('#menuBtn')){toggleMenu();return}\n  if(e.target.closest('#menuCloseBtn')||e.target.closest('#menuBackdrop')){closeMenu();return}",
'menu close controls');
app=replaceOnce(app,
"});\n\ninit();",
"});\ndocument.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#modal')?.classList.contains('hidden'))hideModal();closeMenu()}});\n\ninit();",
'Escape menu close');
fs.writeFileSync('public/app.js',app);

let server=fs.readFileSync('server.js','utf8');
server=replaceOnce(server,
"const userClient=createClient(process.env.SUPABASE_URL,supabasePublicKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});const{data:userData,error:userError}=await userClient.auth.getUser();if(userError||!userData?.user)return res.status(401).json({error:'Recovery session is invalid or expired.',code:'RECOVERY_SESSION_INVALID'});const{error}=await userClient.auth.updateUser({password});",
"const{data:userData,error:userError}=await admin.auth.getUser(token);if(userError||!userData?.user)return res.status(401).json({error:'Recovery session is invalid or expired.',code:'RECOVERY_SESSION_INVALID'});const{error}=await admin.auth.admin.updateUserById(userData.user.id,{password});",
'password reset authenticated admin update');
const brandPost="app.post('/api/brands',async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const access=await accessForUser(user.id);if(!access.active){const usage=await usageForUser(user.id);if(usage.brands>=FREE_LIMITS.brands)return res.status(402).json({error:'Free accounts can save 1 brand. Upgrade to Pro for unlimited brands.',code:'PRO_LIMIT_REACHED'})}const name=String(req.body?.name||'').trim().slice(0,120);if(!name)return res.status(400).json({error:'Brand name is required.'});const{data,error}=await admin.from('brands').insert({owner_id:user.id,name,currency:'USD'}).select().single();if(error)return res.status(400).json({error:error.message});res.json({brand:data})});";
server=replaceOnce(server,brandPost,`${brandPost}\napp.delete('/api/brands/:id',sensitiveLimit,async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const id=String(req.params.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Invalid brand.'});const{data:brand,error:lookupError}=await admin.from('brands').select('id,name').eq('id',id).eq('owner_id',user.id).maybeSingle();if(lookupError)return res.status(400).json({error:'Brand could not be loaded.'});if(!brand)return res.status(404).json({error:'Brand not found.'});const{error}=await admin.from('brands').delete().eq('id',id).eq('owner_id',user.id);if(error)return res.status(400).json({error:'Brand could not be deleted.'});res.json({ok:true})});`,'brand delete backend');
fs.writeFileSync('server.js',server);

let memory=fs.readFileSync('public/business-memory-ui.js','utf8');
memory=replaceOnce(memory,"  $('#side')?.classList.remove('open');","  window.msboCloseMenu?.();",'Business Memory closes menu completely');
fs.writeFileSync('public/business-memory-ui.js',memory);

let account=fs.readFileSync('public/account-ui.js','utf8');
account=replaceOnce(account,"function modal(html){const body=$('#modalBody'),root=$('#modal');if(!body||!root)return;body.innerHTML=html;root.classList.remove('hidden')}","function modal(html){window.msboCloseMenu?.({restoreFocus:false});const body=$('#modalBody'),root=$('#modal');if(!body||!root)return;body.innerHTML=html;root.classList.remove('hidden')}",'account modal closes menu');
fs.writeFileSync('public/account-ui.js',account);

let help=fs.readFileSync('public/help.js','utf8');
help=replaceOnce(help,"function openHelp(){let root=document.querySelector('#helpRoot');","function openHelp(){window.msboCloseMenu?.({restoreFocus:false});let root=document.querySelector('#helpRoot');",'help closes menu');
fs.writeFileSync('public/help.js',help);

let serverTest=fs.readFileSync('tests/server-contract.test.js','utf8');
serverTest=replaceOnce(serverTest,
"  assert.match(updateRoute,/Authorization:`Bearer \\$\\{token\\}`/);\n  assert.match(updateRoute,/userClient\\.auth\\.getUser\\(\\)/);\n  assert.match(updateRoute,/userClient\\.auth\\.updateUser\\(\\{password\\}\\)/);\n  assert.doesNotMatch(updateRoute,/admin\\.auth\\.admin\\.updateUserById/);",
"  assert.match(updateRoute,/admin\\.auth\\.getUser\\(token\\)/);\n  assert.match(updateRoute,/admin\\.auth\\.admin\\.updateUserById\\(userData\\.user\\.id,\\{password\\}\\)/);\n  assert.doesNotMatch(updateRoute,/userClient\\.auth\\.updateUser/);",
'password test matches fixed implementation');
fs.writeFileSync('tests/server-contract.test.js',serverTest);

let recovery=fs.readFileSync('tests/recovery-contract.test.js','utf8');
recovery=appendOnce(recovery,"password update validates the bearer token before changing only that user",`test('password update validates the bearer token before changing only that user',()=>{\n  const start=server.indexOf("app.post('/api/auth/update-password'");\n  const end=server.indexOf("app.get('/api/account'",start);\n  const route=server.slice(start,end);\n  assert.match(route,/admin\\.auth\\.getUser\\(token\\)/);\n  assert.match(route,/admin\\.auth\\.admin\\.updateUserById\\(userData\\.user\\.id,\\{password\\}\\)/);\n  assert.doesNotMatch(route,/userClient\\.auth\\.updateUser/);\n});`);
fs.writeFileSync('tests/recovery-contract.test.js',recovery);

let routes=fs.readFileSync('tests/route-regression-contract.test.js','utf8');
routes=replaceOnce(routes,"  \"app.post('/api/brands'\",","  \"app.post('/api/brands'\",\n  \"app.delete('/api/brands/:id'\",",'delete route required');
routes=appendOnce(routes,"brand deletion is authenticated owner-scoped",`test('brand deletion is authenticated owner-scoped',()=>{\n  const start=server.indexOf("app.delete('/api/brands/:id'");\n  const end=server.indexOf("app.get('/api/skus'",start);\n  const route=server.slice(start,end);\n  assert.ok(route,'brand delete route must exist');\n  assert.match(route,/userFromRequest\\(req\\)/);\n  assert.match(route,/\\.eq\\('id',id\\)\\.eq\\('owner_id',user\\.id\\)/);\n  assert.match(route,/from\\('brands'\\)\\.delete\\(\\)\\.eq\\('id',id\\)\\.eq\\('owner_id',user\\.id\\)/);\n});`);
fs.writeFileSync('tests/route-regression-contract.test.js',routes);

const navTest=`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nconst app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');\nconst memory=await readFile(new URL('../public/business-memory-ui.js',import.meta.url),'utf8');\nconst html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');\ntest('mobile menu has independent dismissal and accessibility state wiring',()=>{\n  assert.match(html,/id="menuCloseBtn"/);\n  assert.match(html,/id="menuBackdrop"/);\n  assert.match(app,/function openMenu\\(\\)/);\n  assert.match(app,/menuCloseBtn/);\n  assert.match(app,/menuBackdrop/);\n  assert.match(app,/e\\.key==='Escape'/);\n  assert.match(app,/document\\.body\\.classList\\.add\\('menuOpen'\\)/);\n  assert.match(app,/document\\.body\\.classList\\.remove\\('menuOpen'\\)/);\n  assert.match(app,/menuCloseBtn'\\)\\|\\|document\\.querySelector\\('#nav button'\\)/);\n  assert.match(app,/trigger\\?\\.focus\\(\\)/);\n});\ntest('Business Memory uses the complete menu close path',()=>{assert.match(memory,/window\\.msboCloseMenu\\?\\.\\(\\)/);});\n`;
fs.writeFileSync('tests/mobile-nav-contract.test.js',navTest);
