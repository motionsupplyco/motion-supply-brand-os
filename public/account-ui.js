const $=s=>document.querySelector(s);
const escapeHtml=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function loadSession(){try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}}
function storeSession(s){if(s)localStorage.setItem('msbo_session',JSON.stringify(s));else localStorage.removeItem('msbo_session')}
function modal(html){const body=$('#modalBody'),root=$('#modal');if(!body||!root)return;body.innerHTML=html;root.classList.remove('hidden')}
function closeModal(){$('#modal')?.classList.add('hidden')}

async function request(url,method='GET',body,auth=false){
  let session=loadSession();
  const headers={'Content-Type':'application/json'};
  if(auth&&session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
  let res=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined});
  if(res.status===401&&auth&&session?.refresh_token){
    const refresh=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    if(refresh.ok){const data=await refresh.json();storeSession(data.session);session=data.session;headers.Authorization=`Bearer ${session.access_token}`;res=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined})}
  }
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);
  return data
}

function formatDate(value){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
function legalLinks(config){
  const links=[];
  const privacyUrl=config?.privacyUrl||'/privacy.html';
  const termsUrl=config?.termsUrl||'/terms.html';
  const supportUrl=config?.supportUrl||'/support.html';
  links.push(`<a href="${escapeHtml(privacyUrl)}" target="_blank" rel="noopener">Privacy</a>`);
  links.push(`<a href="${escapeHtml(termsUrl)}" target="_blank" rel="noopener">Terms</a>`);
  links.push(`<a href="${escapeHtml(supportUrl)}" target="_blank" rel="noopener">Support</a>`);
  return `<p class="mini mt">${links.join(' · ')}</p>`
}

async function showSignIn(){
  let config={};try{config=await fetch('/api/public-config').then(r=>r.json())}catch{}
  modal(`<h2>Sign in / create account</h2><div class="authform"><input id="acctEmail" type="email" autocomplete="email" placeholder="Email"><input id="acctPassword" type="password" autocomplete="current-password" placeholder="Password (8+ characters)"><div id="acctMsg" class="mini"></div><div class="split"><button id="acctSignin" class="primary">Sign in</button><button id="acctSignup" class="outline">Create account</button></div><button id="acctForgot" class="ghost mt">Forgot password?</button>${legalLinks(config)}</div>`);
  $('#acctSignin').onclick=()=>authenticate('signin');
  $('#acctSignup').onclick=()=>authenticate('signup');
  $('#acctForgot').onclick=forgotPassword;
}

async function authenticate(kind){
  const email=$('#acctEmail')?.value.trim()||'',password=$('#acctPassword')?.value||'',msg=$('#acctMsg');
  if(msg)msg.textContent='Working…';
  try{
    const data=await request(`/api/auth/${kind}`,'POST',{email,password});
    if(data.confirmationRequired){if(msg)msg.textContent='Account created. Check your email to confirm, then sign in.';return}
    storeSession(data.session);location.reload()
  }catch(e){if(msg)msg.textContent=e.message}
}

async function forgotPassword(){
  const email=$('#acctEmail')?.value.trim()||'';
  if(!email){const msg=$('#acctMsg');if(msg)msg.textContent='Enter your email first.';return}
  const msg=$('#acctMsg');if(msg)msg.textContent='Sending recovery email…';
  try{const data=await request('/api/auth/recover','POST',{email});if(msg)msg.textContent=data.message||'If that account exists, a recovery email has been sent.'}catch(e){if(msg)msg.textContent=e.message}
}

function showResetPassword(){
  modal(`<h2>Choose a new password</h2><p class="mini">Enter a new password for your Brand OS account.</p><div class="authform"><input id="acctNewPassword" type="password" autocomplete="new-password" placeholder="New password (8+ characters)"><input id="acctNewPassword2" type="password" autocomplete="new-password" placeholder="Confirm new password"><button id="acctSetPassword" class="primary">Update password</button><div id="acctResetMsg" class="mini"></div></div>`);
  $('#acctSetPassword').onclick=completePasswordReset;
}

async function completePasswordReset(){
  const password=$('#acctNewPassword')?.value||'',confirm=$('#acctNewPassword2')?.value||'',msg=$('#acctResetMsg');
  if(password.length<8){if(msg)msg.textContent='Use at least 8 characters.';return}
  if(password!==confirm){if(msg)msg.textContent='Passwords do not match.';return}
  if(msg)msg.textContent='Updating password…';
  try{
    await request('/api/auth/update-password','POST',{password},true);
    if(msg)msg.textContent='Password updated. You can continue using Brand OS.';
    history.replaceState({},document.title,location.pathname);
    setTimeout(()=>location.reload(),500);
  }catch(e){if(msg)msg.textContent=e.message}
}

function captureRecoverySession(){
  const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));
  const isRecovery=query.get('reset')==='1'||hash.get('type')==='recovery';
  if(!isRecovery)return false;
  const accessToken=hash.get('access_token'),refreshToken=hash.get('refresh_token');
  if(accessToken){
    const expiresIn=Number(hash.get('expires_in')||0);
    storeSession({access_token:accessToken,refresh_token:refreshToken||'',token_type:hash.get('token_type')||'bearer',expires_in:expiresIn,expires_at:expiresIn?Math.floor(Date.now()/1000)+expiresIn:null,user:null});
    history.replaceState({},document.title,`${location.pathname}?reset=1`);
  }
  if(!loadSession()?.access_token){
    modal(`<h2>Recovery link expired</h2><p class="mini">This recovery link is missing a valid session. Request a new password reset email.</p><button id="acctRecoveryClose" class="outline">Close</button>`);
    $('#acctRecoveryClose').onclick=closeModal;
    return true
  }
  showResetPassword();
  return true
}

async function showAccount(){
  const session=loadSession();if(!session)return showSignIn();
  let config={},account={},entitlement={};
  try{[config,account,entitlement]=await Promise.all([fetch('/api/public-config').then(r=>r.json()),request('/api/account','GET',null,true),request('/api/entitlement','GET',null,true)])}catch(e){modal(`<h2>Account</h2><p>${escapeHtml(e.message)}</p><button id="acctClose" class="outline">Close</button>`);$('#acctClose').onclick=closeModal;return}
  const sub=entitlement.subscription||null;
  const manageBilling=Boolean(account.active||account.billingManageable);
  const status=sub?.status?escapeHtml(sub.status.replaceAll('_',' ')):'none';
  const periodEnd=formatDate(sub?.currentPeriodEnd),trialEnd=formatDate(sub?.trialEnd);
  const cancelNote=sub?.cancelAtPeriodEnd&&periodEnd?`<div class="warning mt"><b>Cancellation scheduled.</b> Pro remains active through ${escapeHtml(periodEnd)}.</div>`:'';
  const paymentNote=sub?.invoiceStatus&&String(sub.invoiceStatus).includes('failed')?`<div class="warning mt"><b>Payment needs attention.</b> Open billing to update your payment method.</div>`:'';
  const trialNote=trialEnd?`<p class="mini">Trial ends: <b>${escapeHtml(trialEnd)}</b></p>`:'';
  modal(`<h2>Account</h2><p>${escapeHtml(account.user?.email||session.user?.email||'Signed in')}</p><p>Plan: <b>${escapeHtml(String(account.plan||'free').toUpperCase())}</b></p>${sub?`<p class="mini">Subscription status: <b>${status}</b>${periodEnd?` · Current period ends ${escapeHtml(periodEnd)}`:''}</p>`:''}${trialNote}${cancelNote}${paymentNote}<div class="split mt"><button id="acctSignout" class="outline">Sign out</button>${config.billingConfigured?`<button id="acctBillingOpen" class="primary">${manageBilling?'Manage billing':'Upgrade to Pro'}</button>`:''}</div>${legalLinks(config)}<hr style="border:0;border-top:1px solid #e5e5e5;margin:20px 0"><details><summary><b>Delete account</b></summary><p class="mini">This permanently deletes your Brand OS account and cancels an active subscription. This cannot be undone.</p><input id="acctDeleteConfirm" placeholder='Type DELETE to confirm' autocomplete="off"><button id="acctDelete" class="outline mt">Delete account permanently</button><div id="acctDeleteMsg" class="mini mt"></div></details>`);
  $('#acctSignout').onclick=()=>{storeSession(null);location.reload()};
  const billing=$('#acctBillingOpen');if(billing)billing.onclick=()=>openBilling(manageBilling);
  $('#acctDelete').onclick=deleteAccount;
}

async function openBilling(active){
  try{const data=await request(active?'/api/create-portal-session':'/api/create-checkout-session','POST',{},true);location.href=data.url}catch(e){alert(e.message)}
}

async function deleteAccount(){
  const confirm=$('#acctDeleteConfirm')?.value||'',msg=$('#acctDeleteMsg');
  if(confirm!=='DELETE'){if(msg)msg.textContent='Type DELETE exactly to confirm.';return}
  if(msg)msg.textContent='Deleting account…';
  try{await request('/api/account','DELETE',{confirm:'DELETE'},true);storeSession(null);location.reload()}catch(e){if(msg)msg.textContent=e.message}
}

// Capture these clicks before app.js so this production account surface owns the account UX.
document.addEventListener('click',e=>{
  if(e.target.closest('#authBtn')){e.preventDefault();e.stopImmediatePropagation();showAccount();return}
  if(e.target.closest('#inlineSignIn')){e.preventDefault();e.stopImmediatePropagation();showSignIn();return}
  if(e.target.closest('#upgradeNow')&&!loadSession()){e.preventDefault();e.stopImmediatePropagation();showSignIn();return}
},true);

function initRecovery(){captureRecoverySession()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initRecovery,{once:true});else initRecovery();
