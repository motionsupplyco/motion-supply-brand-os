import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const APP='http://127.0.0.1:4173/';
const SHOTS='artifacts/device-qa';
await mkdir(SHOTS,{recursive:true});

const VIEWPORTS=[
  {name:'desktop-1440',width:1440,height:1100},
  {name:'desktop-1920',width:1920,height:1080},
  {name:'tablet-portrait',width:768,height:1024},
  {name:'tablet-landscape',width:1024,height:768},
  {name:'phone-portrait',width:390,height:844},
  {name:'phone-landscape',width:844,height:390},
  {name:'narrow-phone',width:320,height:568}
];

const ROUTES=[
  '[data-view="dashboard"]',
  '[data-view="advisor"]',
  '[data-view="profit"]',
  '[data-view="cac"]',
  '[data-view="discount"]',
  '[data-view="launch"]',
  '[data-view="funnel"]',
  '[data-view="shopify"]',
  '[data-view="inventory"]',
  '[data-view="cash"]',
  '[data-view="po"]',
  '[data-view="fulfillment"]',
  '[data-profit-view="profitguardrails"]',
  '[data-collection-view="collectionstress"]',
  '[data-production-view="preflight"]',
  '[data-factory-view="quotecompare"]',
  '[data-v2-view="cashforecast"]',
  '[data-v2-view="reorderintel"]',
  '[data-v2-view="operatingalerts"]',
  '[data-v2-view="integrations"]',
  '[data-view="wholesale"]',
  '[data-view="brands"]'
];

function collectPageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return errors;
}

async function openSidebarIfNeeded(page,viewport){
  if(viewport.width<=820){
    const side=page.locator('#side');
    if(!await side.evaluate(el=>el.classList.contains('open'))){
      await page.locator('#menuBtn').click();
      await expect(side).toHaveClass(/\bopen\b/);
    }
  }
}

async function clickRoute(page,viewport,selector){
  await openSidebarIfNeeded(page,viewport);
  const control=page.locator(selector).first();
  await expect(control).toBeVisible();
  await control.click();
  if(viewport.width<=820){
    await expect(page.locator('#side')).not.toHaveClass(/\bopen\b/);
    await expect(page.locator('body')).not.toHaveClass(/\bmenuOpen\b/);
  }
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#app')).not.toContainText('Could not load this workspace');
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
}

for(const viewport of VIEWPORTS){
  test(`${viewport.name} traverses founder workspaces without overflow or browser crashes`,async({page})=>{
    const errors=collectPageErrors(page);
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.goto(APP,{waitUntil:'domcontentloaded'});
    await expect(page.locator('#app')).toBeVisible();

    await openSidebarIfNeeded(page,viewport);
    await page.locator('#demoBtn').click();
    if(viewport.width<=820)await expect(page.locator('#side')).not.toHaveClass(/\bopen\b/);
    await expect(page.locator('#planPill')).toContainText(/DEMO/);

    for(const selector of ROUTES)await clickRoute(page,viewport,selector);

    await clickRoute(page,viewport,'[data-view="dashboard"]');
    await page.screenshot({path:`${SHOTS}/${viewport.name}-dashboard.png`,fullPage:false});
    await clickRoute(page,viewport,'[data-view="profit"]');
    await page.screenshot({path:`${SHOTS}/${viewport.name}-profit.png`,fullPage:false});
    await clickRoute(page,viewport,'[data-v2-view="cashforecast"]');
    await page.screenshot({path:`${SHOTS}/${viewport.name}-cash-forecast.png`,fullPage:false});

    expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
  });
}

test('mobile drawer remains dismissible across narrow phone and tablet widths',async({page})=>{
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:768,height:1024}]){
    await page.setViewportSize(viewport);
    await page.goto(APP,{waitUntil:'domcontentloaded'});
    const side=page.locator('#side');

    await page.locator('#menuBtn').click();
    await expect(side).toHaveClass(/\bopen\b/);
    await page.locator('#menuCloseBtn').click();
    await expect(side).not.toHaveClass(/\bopen\b/);

    await page.locator('#menuBtn').click();
    await expect(side).toHaveClass(/\bopen\b/);
    const backdrop=page.locator('#menuBackdrop');
    const backdropBox=await backdrop.boundingBox();
    expect(backdropBox).not.toBeNull();
    await page.mouse.click(backdropBox.x+backdropBox.width-10,backdropBox.y+10);
    await expect(side).not.toHaveClass(/\bopen\b/);

    await page.locator('#menuBtn').click();
    await expect(side).toHaveClass(/\bopen\b/);
    await page.keyboard.press('Escape');
    await expect(side).not.toHaveClass(/\bopen\b/);
    await expect(page.locator('body')).not.toHaveClass(/\bmenuOpen\b/);
  }
});
