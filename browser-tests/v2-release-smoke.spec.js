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
