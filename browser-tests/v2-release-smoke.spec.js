import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const APP='http://127.0.0.1:4173/';
const SHOTS='artifacts/v2-browser';
await mkdir(SHOTS,{recursive:true});

function collectPageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return errors;
}
function slug(value){return String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
async function expectDrawerOffCanvas(page){
  await expect.poll(async()=>page.locator('#side').evaluate(el=>Math.round(el.getBoundingClientRect().right)),{timeout:2000}).toBeLessThanOrEqual(1);
}

test('Foundry Eight demo opens the new founder workspaces without uncaught browser errors',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:1440,height:1100});
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#brandEngineNavLink')).toHaveAttribute('href','/brand-engine?src=sidebar');
  await page.locator('#demoBtn').click();
  await expect(page.locator('#planPill')).toContainText(/DEMO/);

  const routes=[
    ['[data-profit-view="profitguardrails"]','Profit Guardrails'],
    ['[data-collection-view="collectionstress"]','Collection Stress Tester'],
    ['[data-production-view="preflight"]','Production Preflight'],
    ['[data-factory-view="quotecompare"]','Factory Quote Compare'],
    ['[data-v2-view="cashforecast"]','Cash Forecast'],
    ['[data-v2-view="reorderintel"]','Reorder Intelligence'],
    ['[data-v2-view="operatingalerts"]','Operating Alerts']
  ];

  for(const [selector,title] of routes){
    const nav=page.locator(selector);
    await nav.click();
    await expect(nav).toHaveClass(/\bactive\b/);
    await expect(page.locator('#title')).toHaveText(title);
    await expect(page.locator('#app .v2Hero').first()).toBeVisible();
    await expect(page.locator('#app')).not.toContainText('Could not load this workspace');
    await page.screenshot({path:`${SHOTS}/desktop-${slug(title)}.png`,fullPage:false});
  }

  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('mobile sidebar utilities and custom V2 navigation close the drawer after selection',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto(APP,{waitUntil:'domcontentloaded'});

  await page.locator('#menuBtn').click();
  await expect(page.locator('#side')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#brandEngineNavLink')).toBeVisible();
  await expect(page.locator('#brandEngineNavLink')).toHaveAttribute('href','/brand-engine?src=sidebar');
  await page.locator('#demoBtn').click();
  await expect(page.locator('#side')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded','false');
  await expectDrawerOffCanvas(page);
  await expect(page.locator('#planPill')).toContainText(/DEMO/);

  await page.locator('#menuBtn').click();
  await expect(page.locator('#side')).toHaveClass(/\bopen\b/);
  await page.locator('[data-v2-view="cashforecast"]').click();
  await expect(page.locator('#side')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('body')).not.toHaveClass(/\bmenuOpen\b/);
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded','false');
  await expectDrawerOffCanvas(page);
  await expect(page.locator('#title')).toHaveText('Cash Forecast');
  await expect(page.locator('#app .v2Hero').first()).toBeVisible();
  await page.screenshot({path:`${SHOTS}/mobile-cash-forecast.png`,fullPage:false});

  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('Brand Engine generates founder directions with official pre-screen steps and truthful domain evidence',async({page})=>{
  const errors=collectPageErrors(page),events=[];
  await page.setViewportSize({width:1280,height:1000});
  await page.route('**/api/brand-engine/event',async route=>{events.push(JSON.parse(route.request().postData()||'{}'));await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})});
  await page.route('**/api/brand-engine/domain-check',async route=>{
    const request=route.request();const body=JSON.parse(request.postData()||'{}');const domains=body.domains||[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      results:domains.map((domain,index)=>({domain,status:index===0?'registered':index===1?'not_found':'unknown',registered:index===0?true:index===1?false:null,reason:index===0?'Authoritative RDAP record exists.':index===1?'Authoritative RDAP returned 404; verify at a registrar.':'Provider status unknown.'})),
      disclaimer:'RDAP reports registration records, not purchase guarantees.'
    })});
  });
  await page.goto(`${APP}brand-engine.html`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('h1')).toContainText('Name the brand.');
  await page.locator('#seedWords').fill('ghost archive');
  await page.locator('#vibe').selectOption('street');
  await page.locator('#generateNames').click();
  await expect(page.locator('.nameCard')).toHaveCount(12);
  const first=page.locator('.nameCard').first();
  const initialFirstName=(await first.locator('h3').textContent())?.trim();
  expect(initialFirstName).toBeTruthy();
  await expect(first.locator('.trademarkBlock')).toContainText('USPTO FEDERAL PRE-SCREEN');
  await expect(first.locator('.trademarkBlock')).toContainText('SCREENING ONLY');
  await expect(first.locator('.trademarkQuery').first().locator('code')).toContainText('CM:"');
  await expect(first.locator('.trademarkActions a')).toHaveAttribute('href','https://tmsearch.uspto.gov/');
  await expect(first.locator('.trademarkDisclaimer')).toContainText(/not a clearance opinion/i);
  await first.locator('[data-check-domains]').click();
  await expect(first.locator('.domainStatus.registered')).toHaveText('REGISTERED');
  await expect(first.locator('.domainStatus.not_found')).toHaveText('NO RDAP RECORD');
  await expect(first).not.toContainText(/AVAILABLE|TRADEMARK CLEAR|CLEARANCE SCORE/i);
  await page.locator('#regenerate').click();
  await expect(page.locator('.nameCard')).toHaveCount(12);
  const regeneratedFirstName=(await page.locator('.nameCard').first().locator('h3').textContent())?.trim();
  expect(regeneratedFirstName).toBeTruthy();
  expect(regeneratedFirstName).not.toBe(initialFirstName);
  await expect.poll(()=>events.filter(event=>event.event_name==='brand_engine_names_generated').length).toBe(2);
  await expect.poll(()=>events.filter(event=>event.event_name==='brand_engine_domain_checked').length).toBe(1);
  const analyticsText=JSON.stringify(events);
  expect(analyticsText).not.toMatch(/ghost archive|Ghost Dept|\.com|seed_words|brand_name|handles/i);
  expect(events.find(event=>event.event_name==='brand_engine_viewed')?.properties?.entrypoint).toBe('standalone');
  await page.screenshot({path:`${SHOTS}/brand-engine-desktop.png`,fullPage:false});
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('Brand Engine stays usable at 390×844 with wrapped USPTO queries and no horizontal overflow',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/brand-engine/event',async route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.goto(`${APP}brand-engine.html`,{waitUntil:'domcontentloaded'});
  await page.locator('#seedWords').fill('ghost archive');
  await page.locator('#vibe').selectOption('street');
  await page.locator('#generateNames').click();
  await expect(page.locator('.nameCard')).toHaveCount(12);
  const first=page.locator('.nameCard').first();
  await first.scrollIntoViewIfNeeded();
  await expect(first).toBeVisible();
  await expect(first.locator('.trademarkBlock')).toBeVisible();
  await expect(first.locator('.trademarkQuery')).toHaveCount(2);
  await expect(first.locator('.trademarkActions a')).toBeVisible();
  await expect(first.locator('[data-use-name]')).toBeVisible();
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),{timeout:2000}).toBeLessThanOrEqual(1);
  await expect(first).not.toContainText(/AVAILABLE|TRADEMARK CLEAR|CLEARANCE SCORE/i);
  await page.screenshot({path:`${SHOTS}/brand-engine-mobile.png`,fullPage:false});
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('unsigned Brand Engine handoff preserves the chosen name without creating a brand',async({page})=>{
  const errors=collectPageErrors(page);let brandPosts=0;
  await page.route('**/api/brand-engine/event',async route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.route('**/api/brands',async route=>{
    if(route.request().method()==='POST')brandPosts++;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({brands:[]})});
  });
  await page.goto(`${APP}brand-engine.html`,{waitUntil:'domcontentloaded'});
  const first=page.locator('.nameCard').first();
  const chosen=(await first.locator('h3').textContent())?.trim();
  expect(chosen).toBeTruthy();
  await first.locator('[data-use-name]').click();
  await expect(page.locator('#brandEngineHandoff')).toBeVisible({timeout:5000});
  await expect(page.locator('#brandEngineHandoff')).toContainText(`You picked ${chosen}.`);
  await expect(page.locator('#brandEngineAuth')).toBeVisible();
  expect(brandPosts,'unsigned handoff must not create a brand').toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('msbo_pending_brand_name'))).toBe(chosen);
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('Brand Engine handoff never creates a brand until the founder explicitly presses Initialize',async({page})=>{
  const errors=collectPageErrors(page),events=[];let brandPosts=0;
  await page.addInitScript(()=>{
    localStorage.setItem('msbo_pending_brand_name','Ghost Dept');
    localStorage.setItem('msbo_session',JSON.stringify({access_token:'browser-smoke-token',refresh_token:''}));
  });
  await page.route('**/api/brand-engine/event',async route=>{events.push(JSON.parse(route.request().postData()||'{}'));await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})});
  await page.route('**/api/brands',async route=>{
    if(route.request().method()==='POST')brandPosts++;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({brand:{id:'00000000-0000-4000-8000-000000000001',name:'Ghost Dept'}})});
  });
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#brandEngineHandoff')).toBeVisible();
  await expect(page.locator('#brandEngineInitialize')).toContainText('Initialize Ghost Dept');
  expect(brandPosts,'loading a pending handoff must not create a brand').toBe(0);
  await page.waitForTimeout(250);
  expect(brandPosts,'waiting after login must not auto-create a brand').toBe(0);
  await page.locator('#brandEngineInitialize').click();
  await expect.poll(()=>brandPosts).toBe(1);
  await expect(page.locator('#brandEngineHandoffStatus')).toContainText('now saved in Brand OS');
  await expect.poll(()=>events.filter(event=>event.event_name==='brand_engine_brand_initialized').length).toBe(1);
  expect(JSON.stringify(events)).not.toContain('Ghost Dept');
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('Brand Engine retries explicit initialization after refreshing an expired access token',async({page})=>{
  const errors=collectPageErrors(page);let brandAttempts=0,refreshAttempts=0;const authHeaders=[];
  await page.addInitScript(()=>localStorage.setItem('msbo_session',JSON.stringify({access_token:'stale-token',refresh_token:'refresh-token'})));
  await page.route('**/api/brand-engine/event',async route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.route('**/api/auth/refresh',async route=>{
    refreshAttempts++;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({session:{access_token:'fresh-token',refresh_token:'rotated-refresh'}})});
  });
  await page.route('**/api/brands',async route=>{
    if(route.request().method()!=='POST')return route.fulfill({status:200,contentType:'application/json',body:'{"brands":[]}'});
    brandAttempts++;authHeaders.push(route.request().headers()['authorization']||'');
    if(brandAttempts===1)return route.fulfill({status:401,contentType:'application/json',body:'{"error":"Unauthorized"}'});
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({brand:{id:'00000000-0000-4000-8000-000000000002',name:'Refreshed Brand'}})});
  });
  await page.goto(`${APP}brand-engine.html`,{waitUntil:'domcontentloaded'});
  const first=page.locator('.nameCard').first();
  await first.locator('[data-use-name]').click();
  await expect.poll(()=>refreshAttempts).toBe(1);
  await expect.poll(()=>brandAttempts).toBe(2);
  expect(authHeaders).toEqual(['Bearer stale-token','Bearer fresh-token']);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('msbo_session')||'null'));
  expect(stored?.access_token).toBe('fresh-token');
  expect(stored?.refresh_token).toBe('rotated-refresh');
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('Shopify CSV import rejects malformed input without saving it and accepts a valid export-shaped file',async({page})=>{
  const errors=collectPageErrors(page);
  const dialogs=[];
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept()});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.locator('#demoBtn').click();
  await page.locator('[data-view="shopify"]').click();
  await expect(page.locator('#title')).toHaveText('Shopify CSV Dashboard');
  await expect(page.locator('#app')).toContainText('No store data imported.');

  await page.locator('#csvFile').setInputFiles({
    name:'malformed-orders.csv',
    mimeType:'text/csv',
    buffer:Buffer.from('Name,Total,Lineitem quantity,Lineitem price\n#1,"never closes,1,10')
  });
  await expect.poll(()=>dialogs.some(message=>/Invalid CSV: an unterminated quoted field/i.test(message))).toBe(true);
  await expect(page.locator('#clearImport')).toHaveCount(0);
  await expect(page.locator('#app')).toContainText('No store data imported.');

  await page.locator('#csvFile').setInputFiles({
    name:'valid-orders.csv',
    mimeType:'text/csv',
    buffer:Buffer.from('\uFEFFName,Email,Financial Status,Fulfillment Status,Subtotal,Shipping,Taxes,Total,Discount Amount,Created at,Lineitem quantity,Lineitem name,Lineitem price,Lineitem SKU,Canceled at\r\n#5001,test@example.com,paid,fulfilled,50,0,0,50,0,2026-09-16 10:00:00 -0400,1,"Heavyweight Tee, Black",50,TEE-BLK,\r\n')
  });
  await expect(page.locator('#clearImport')).toBeVisible();
  await expect(page.locator('#app')).toContainText('1');
  await expect(page.locator('#app')).toContainText('$50.00');
  await page.screenshot({path:`${SHOTS}/desktop-shopify-csv-import.png`,fullPage:false});

  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('keyboard-only founder flow has skip navigation, labeled fields and operable quick actions',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(APP,{waitUntil:'domcontentloaded'});

  const skip=page.locator('.skipLink');
  await expect(skip).toHaveAttribute('href','#mainContent');
  await skip.focus();
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#mainContent')).toBeFocused();

  await page.locator('#demoBtn').click();
  const dashboardNav=page.locator('[data-view="dashboard"]');
  await expect(dashboardNav).toHaveAttribute('aria-current','page');

  const quick=page.locator('.actioncard[data-jump="profit"]');
  await expect(quick).toHaveAttribute('role','button');
  await expect(quick).toHaveAttribute('tabindex','0');
  await quick.focus();
  await expect(quick).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#title')).toHaveText('Profit & Pricing');
  await expect(page.locator('[data-view="profit"]')).toHaveAttribute('aria-current','page');

  const price=page.locator('input[data-key="price"]');
  const priceId=await price.getAttribute('id');
  expect(priceId).toBeTruthy();
  await expect(page.locator(`label[for="${priceId}"]`)).toContainText(/price/i);

  await page.locator('[data-view="shopify"]').click();
  await expect(page.locator('#csvFile')).toHaveAttribute('aria-label','Choose Shopify CSV file');
  await page.screenshot({path:`${SHOTS}/desktop-keyboard-accessibility.png`,fullPage:false});

  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});
