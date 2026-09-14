import fs from 'node:fs';

function replaceOnce(text, from, to, label){
  if(!text.includes(from)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(from,to);
}

let server=fs.readFileSync('server.js','utf8');
server=replaceOnce(server,
"const userClient=createClient(process.env.SUPABASE_URL,supabasePublicKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});const{data:userData,error:userError}=await userClient.auth.getUser();if(userError||!userData?.user)return res.status(401).json({error:'Recovery session is invalid or expired.',code:'RECOVERY_SESSION_INVALID'});const{error}=await userClient.auth.updateUser({password});if(error){console.error('update-password',error);return res.status(400).json({error:'Password could not be updated. Request a new recovery link.',code:'PASSWORD_UPDATE_FAILED'})}",
"const{data:userData,error:userError}=await admin.auth.getUser(token);if(userError||!userData?.user)return res.status(401).json({error:'Recovery session is invalid or expired.',code:'RECOVERY_SESSION_INVALID'});const{error}=await admin.auth.admin.updateUserById(userData.user.id,{password});if(error){console.error('update-password',error);return res.status(400).json({error:'Password could not be updated. Request a new recovery link.',code:'PASSWORD_UPDATE_FAILED'})}",
'password recovery admin update');
const brandPost="app.post('/api/brands',async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const access=await accessForUser(user.id);if(!access.active){const usage=await usageForUser(user.id);if(usage.brands>=FREE_LIMITS.brands)return res.status(402).json({error:'Free accounts can save 1 brand. Upgrade to Pro for unlimited brands.',code:'PRO_LIMIT_REACHED'})}const name=String(req.body?.name||'').trim().slice(0,120);if(!name)return res.status(400).json({error:'Brand name is required.'});const{data,error}=await admin.from('brands').insert({owner_id:user.id,name,currency:'USD'}).select().single();if(error)return res.status(400).json({error:error.message});res.json({brand:data})});";
server=replaceOnce(server,brandPost,brandPost+"\napp.delete('/api/brands/:id',sensitiveLimit,async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const id=String(req.params.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Invalid brand.'});const{data:brand}=await admin.from('brands').select('id,name').eq('id',id).eq('owner_id',user.id).maybeSingle();if(!brand)return res.status(404).json({error:'Brand not found.'});const{error}=await admin.from('brands').delete().eq('id',id).eq('owner_id',user.id);if(error)return res.status(400).json({error:'Brand could not be deleted.'});res.json({ok:true})});",'brand delete route');
fs.writeFileSync('server.js',server);

let app=fs.readFileSync('public/app.js','utf8');
app=replaceOnce(app,
"<div class=\"skuBar\"><div><b>${escapeHtml(b.name)}</b><div class=\"mini\">${escapeHtml(b.currency)}</div></div></div>",
"<div class=\"skuBar\"><div><b>${escapeHtml(b.name)}</b><div class=\"mini\">${escapeHtml(b.currency)}</div></div><button class=\"ghost\" data-deletebrand=\"${b.id}\" type=\"button\">Delete brand</button></div>",
'brand delete button');
app=replaceOnce(app,
"async function addSku(brandId){",
"async function deleteBrand(brandId){\n  const brand=brands.find(b=>String(b.id)===String(brandId));\n  if(!brand)return;\n  const skuCount=skus.filter(s=>String(s.brand_id)===String(brandId)).length;\n  const warning=skuCount?`Delete ${brand.name} and its ${skuCount} saved SKU${skuCount===1?'':'s'}? This cannot be undone.`:`Delete ${brand.name}? This cannot be undone.`;\n  if(!confirm(warning))return;\n  try{await api(`/api/brands/${encodeURIComponent(brandId)}`,'DELETE',null,true);await loadCloud();await refreshAccount();render()}catch(e){alert(e.message)}\n}\n\nasync function addSku(brandId){",
'deleteBrand function');
app=replaceOnce(app,
"const s=$('#inlineSignIn');if(s)s.onclick=showAuth;",
"const s=$('#inlineSignIn');if(s)s.onclick=showAuth;\n  document.querySelectorAll('[data-deletebrand]').forEach(el=>el.onclick=()=>deleteBrand(el.dataset.deletebrand));",
'brand delete binding');
fs.writeFileSync('public/app.js',app);

let recovery=fs.readFileSync('tests/recovery-contract.test.js','utf8');
recovery += "\n\ntest('password update validates recovery token then uses admin update for that user',()=>{\n  const src=fs.readFileSync(path.join(root,'server.js'),'utf8');\n  assert.match(src,/admin\\.auth\\.getUser\\(token\\)/);\n  assert.match(src,/admin\\.auth\\.admin\\.updateUserById\\(userData\\.user\\.id,\\{password\\}\\)/);\n});\n";
fs.writeFileSync('tests/recovery-contract.test.js',recovery);

let routes=fs.readFileSync('tests/route-regression-contract.test.js','utf8');
routes += "\n\ntest('signed-in owners can delete their own saved brands',()=>{\n  const src=fs.readFileSync(path.join(root,'server.js'),'utf8');\n  assert.match(src,/app\\.delete\\('\/api\/brands\/:id'/);\n  assert.match(src,/\\.eq\\('owner_id',user\\.id\\)/);\n  assert.match(src,/from\\('brands'\\)\\.delete\\(\\)/);\n});\n";
fs.writeFileSync('tests/route-regression-contract.test.js',routes);
