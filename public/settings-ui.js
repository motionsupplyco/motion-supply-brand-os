const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function loadSession(){try{return JSON.parse(localStorage.getItem('msbo_session')||'null')}catch{return null}}
function isStandalone(){return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true}

function markSettingsActive(){
  $$('#nav button').forEach(button=>button.classList.toggle('active',button.id==='settingsNav'));
}

function legalLink(path,label){return `<a class="settingsLink" href="${path}" target="_blank" rel="noopener">${label}<span aria-hidden="true">↗</span></a>`}

function renderSettings(){
  window.msboCloseMenu?.({restoreFocus:false});
  const app=$('#app'),title=$('#title');
  if(!app||!title)return;
  title.textContent='Settings';
  markSettingsActive();

  const session=loadSession();
  const version=localStorage.getItem('msbo_version')||'—';
  const hasImport=Boolean(localStorage.getItem('msbo_last_import'));
  const mode=localStorage.getItem('msbo_mode')||'fresh';
  const installCopy=isStandalone()
    ?'<b>Installed.</b><span>Brand OS is currently running as a standalone app.</span>'
    :'<b>Add Brand OS to your Home Screen</b><span>On iPhone Safari: tap Share, then Add to Home Screen. It opens with its own app icon and standalone window.</span>';

  app.innerHTML=`
    <div class="settingsWrap" data-settings-root>
      <div class="toolhead settingsHead">
        <div>
          <span class="kicker">APP CONTROL CENTER</span>
          <h2>Settings</h2>
          <p class="muted">Manage your account, workspace data, app access, and support from one place.</p>
        </div>
        <span class="source">v${escapeHtml(version)}</span>
      </div>

      <div class="settingsGrid">
        <section class="card settingsCard">
          <span class="kicker">ACCOUNT & PLAN</span>
          <h3>${session?'Your Brand OS account':'Sign in to sync your workspace'}</h3>
          <p class="mini">${session?escapeHtml(session.user?.email||'Signed in account'):'Local calculator inputs stay in this browser until you sign in.'}</p>
          <div class="settingsActions">
            <button id="settingsAccount" class="primary" type="button">${session?'Manage account':'Sign in / create account'}</button>
            <button id="settingsBilling" class="outline" type="button">Billing & plan</button>
          </div>
        </section>

        <section class="card settingsCard">
          <span class="kicker">WORKSPACE & DATA</span>
          <h3>Control the model you are working in</h3>
          <div class="settingsStatus">
            <span>Current mode</span><b>${escapeHtml(mode.replaceAll('-',' '))}</b>
            <span>Shopify snapshot</span><b>${hasImport?'Loaded':'None loaded'}</b>
          </div>
          <div class="settingsActions">
            <button id="settingsFresh" class="outline" type="button">Start fresh model</button>
            <button id="settingsDemo" class="outline" type="button">Load demo model</button>
            <button id="settingsClearImport" class="ghost" type="button" ${hasImport?'':'disabled'}>Clear Shopify snapshot</button>
          </div>
          <p class="mini settingsNote">Starting fresh resets local calculator inputs in this browser. It does not delete your signed-in account.</p>
        </section>

        <section class="card settingsCard">
          <span class="kicker">APP ACCESS</span>
          <h3>Use Brand OS like an app</h3>
          <div class="settingsInstall">${installCopy}</div>
          <p class="mini settingsNote">Browser Back now follows your Brand OS workspace history before leaving the app.</p>
        </section>

        <section class="card settingsCard">
          <span class="kicker">HELP & LEGAL</span>
          <h3>Guidance when you need it</h3>
          <div class="settingsActions">
            <button id="settingsGuide" class="outline" type="button">Start Here · Beginner Guide</button>
          </div>
          <div class="settingsLinks">
            ${legalLink('/support.html','Support')}
            ${legalLink('/privacy.html','Privacy')}
            ${legalLink('/terms.html','Terms')}
          </div>
        </section>
      </div>
    </div>`;

  $('#settingsAccount')?.addEventListener('click',()=>$('#authBtn')?.click());
  $('#settingsBilling')?.addEventListener('click',()=>{
    const billing=$('#billingBtn');
    if(billing&&!billing.classList.contains('hidden'))billing.click();
    else $('#authBtn')?.click();
  });
  $('#settingsGuide')?.addEventListener('click',()=>$('#learnBtn')?.click());
  $('#settingsDemo')?.addEventListener('click',()=>{
    $('#demoBtn')?.click();
    $('#nav button[data-view="dashboard"]')?.click();
  });
  $('#settingsFresh')?.addEventListener('click',()=>{
    if(!confirm('Start a fresh local model? This resets calculator inputs in this browser.'))return;
    $('#freshBtn')?.click();
    $('#nav button[data-view="dashboard"]')?.click();
  });
  $('#settingsClearImport')?.addEventListener('click',()=>{
    if(!hasImport||!confirm('Clear the locally saved Shopify import snapshot from this browser?'))return;
    localStorage.removeItem('msbo_last_import');
    location.reload();
  });
  window.scrollTo(0,0);
}

function onSettingsClick(event){
  if(!event.target.closest('#settingsNav'))return;
  event.preventDefault();
  renderSettings();
}

document.addEventListener('click',onSettingsClick);
window.msboOpenSettings=renderSettings;
