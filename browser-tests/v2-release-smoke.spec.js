import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/';

function collectPageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return errors;
}

test('Foundry Eight demo opens the new founder workspaces without uncaught browser errors',async({page})=>{
  const errors=collectPageErrors(page);
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#app')).toBeVisible();
  await page.locator('#demoBtn').click();
  await expect(page.locator('#planPill')).toContainText(/DEMO/);

  const routes=[
    ['[data-profit-view="profitguardrails"]','Profit Guardrails'],
    ['[data-collection-view="collectionstress"]','Collection Stress'],
    ['[data-production-view="preflight"]','Production Preflight'],
    ['[data-factory-view="quotecompare"]','Factory Quote Compare'],
    ['[data-v2-view="cashforecast"]','13-Week Cash Forecast'],
    ['[data-v2-view="reorderintel"]','Reorder Intelligence'],
    ['[data-v2-view="operatingalerts"]','Operating Alerts']
  ];

  for(const [selector,heading] of routes){
    await page.locator(selector).click();
    await expect(page.locator('#app h2').filter({hasText:heading}).first()).toBeVisible();
  }

  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('custom V2 navigation closes the mobile drawer after selection',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.locator('#demoBtn').click();

  await page.locator('#menuBtn').click();
  await expect(page.locator('#side')).toHaveClass(/\bopen\b/);
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded','true');

  await page.locator('[data-v2-view="cashforecast"]').click();
  await expect(page.locator('#side')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('body')).not.toHaveClass(/\bmenuOpen\b/);
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#app h2').filter({hasText:'13-Week Cash Forecast'}).first()).toBeVisible();

  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});
