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

test('fresh Business Health shows the founder operating loop and routes without inventing state',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.clear());
  await page.goto(APP,{waitUntil:'domcontentloaded'});

  await expect(page.locator('#title')).toHaveText('Business Health');
  await expect(page.locator('#guidedOperatingLoop')).toBeVisible();
  await expect(page.locator('[data-guided-stage]')).toHaveCount(4);
  await expect(page.locator('#guidedOperatingLoop')).toContainText('Work the business in sequence, not tool by tool.');
  await expect(page.locator('#guidedOperatingLoop')).toContainText('It creates no score and no new business numbers');
  await expect(page.locator('[data-guided-stage="economics"]')).toContainText('Can each order support the business?');

  const before=await page.evaluate(()=>({state:localStorage.getItem('msbo_state'),touched:localStorage.getItem('msbo_touched')}));
  await page.locator('[data-guided-stage="economics"] [data-guided-route]').first().click();
  await expect(page.locator('#title')).toHaveText('Profit & Pricing');
  const after=await page.evaluate(()=>({state:localStorage.getItem('msbo_state'),touched:localStorage.getItem('msbo_touched')}));
  expect(after).toEqual(before);

  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('founder operating loop stays usable at 390×844 and hands off to Solve a Problem',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.clear());
  await page.goto(APP,{waitUntil:'domcontentloaded'});

  await expect(page.locator('#guidedOperatingLoop')).toBeVisible();
  await expect(page.locator('[data-guided-stage]')).toHaveCount(4);
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),{timeout:2000}).toBeLessThanOrEqual(1);
  await page.screenshot({path:`${SHOTS}/guided-dashboard-mobile.png`,fullPage:false});

  await page.locator('.guidedSolve').click();
  await expect(page.locator('#modal')).not.toHaveClass(/\bhidden\b/);
  await expect(page.locator('.problemNavigator')).toBeVisible();
  await expect(page.locator('[data-problem-id]')).toHaveCount(8);
  await page.locator('#closeModal').click();
  await expect(page.locator('#modal')).toHaveClass(/\bhidden\b/);

  await page.locator('[data-guided-stage="demand"] [data-guided-route]').first().click();
  await expect(page.locator('#title')).toHaveText('Store Funnel');
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});
