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

async function openClean(page,{width=1440,height=1000}={}){
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>localStorage.clear());
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#title')).toHaveText('Business Health');
}

async function expectDrawerOffCanvas(page){
  await expect.poll(async()=>page.locator('#side').evaluate(el=>Math.round(el.getBoundingClientRect().right)),{timeout:2000}).toBeLessThanOrEqual(1);
}

test('browser back walks through Brand OS workspaces before leaving the app',async({page})=>{
  const errors=collectPageErrors(page);
  await openClean(page);

  await page.locator('#nav button[data-view="profit"]').click();
  await expect(page.locator('#title')).toHaveText('Profit & Pricing');
  await page.locator('#nav button[data-view="cac"]').click();
  await expect(page.locator('#title')).toHaveText('Customer Acquisition Cost');

  await page.evaluate(()=>history.back());
  await expect(page.locator('#title')).toHaveText('Profit & Pricing');
  expect(new URL(page.url()).origin).toBe(new URL(APP).origin);

  await page.evaluate(()=>history.back());
  await expect(page.locator('#title')).toHaveText('Business Health');
  expect(new URL(page.url()).origin).toBe(new URL(APP).origin);

  await page.evaluate(()=>history.forward());
  await expect(page.locator('#title')).toHaveText('Profit & Pricing');
  expect(errors).toEqual([]);
});

test('Settings is a real workspace and participates in browser history',async({page})=>{
  const errors=collectPageErrors(page);
  await openClean(page);

  await page.locator('#settingsNav').click();
  await expect(page.locator('#title')).toHaveText('Settings');
  await expect(page.locator('[data-settings-root]')).toBeVisible();
  await expect(page.locator('#settingsNav')).toHaveClass(/\bactive\b/);
  await expect(page.locator('[data-settings-root]')).toContainText('ACCOUNT & PLAN');
  await expect(page.locator('[data-settings-root]')).toContainText('WORKSPACE & DATA');
  await expect(page.locator('[data-settings-root]')).toContainText('APP ACCESS');
  await expect(page.locator('[data-settings-root]')).toContainText('HELP & LEGAL');

  await page.locator('#nav button[data-view="profit"]').click();
  await expect(page.locator('#title')).toHaveText('Profit & Pricing');
  await page.evaluate(()=>history.back());
  await expect(page.locator('#title')).toHaveText('Settings');
  await expect(page.locator('[data-settings-root]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Settings stays app-like and overflow-free on a 390px iPhone layout',async({page})=>{
  const errors=collectPageErrors(page);
  await openClean(page,{width:390,height:844});

  await page.locator('#menuBtn').click();
  await expect(page.locator('#side')).toHaveClass(/\bopen\b/);
  await page.locator('#settingsNav').scrollIntoViewIfNeeded();
  await page.locator('#settingsNav').click();
  await expect(page.locator('#side')).not.toHaveClass(/\bopen\b/);
  await expectDrawerOffCanvas(page);
  await expect(page.locator('#title')).toHaveText('Settings');
  await expect(page.locator('[data-settings-root]')).toBeVisible();
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),{timeout:2000}).toBeLessThanOrEqual(1);
  await page.screenshot({path:`${SHOTS}/settings-mobile-390.png`,fullPage:true});
  expect(errors).toEqual([]);
});
