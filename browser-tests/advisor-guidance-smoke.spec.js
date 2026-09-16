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

async function seedProductEconomics(page){
  await page.addInitScript(()=>{
    localStorage.setItem('msbo_state',JSON.stringify({price:84,landedCost:24.7}));
    localStorage.setItem('msbo_touched',JSON.stringify(['price','landedCost']));
    localStorage.setItem('msbo_mode','fresh');
  });
}

test('Advisor recommendation opens contextual first-party help then routes without mutating founder state',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:1440,height:1000});
  await seedProductEconomics(page);
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  const before=await page.evaluate(()=>({state:localStorage.getItem('msbo_state'),touched:localStorage.getItem('msbo_touched'),mode:localStorage.getItem('msbo_mode')}));

  await page.locator('#nav button[data-view="advisor"]').click();
  await expect(page.locator('#title')).toHaveText('Next Move Advisor');
  const move=page.locator('.card').filter({has:page.getByRole('heading',{name:'Finish the acquisition model'})});
  await expect(move.locator('[data-advisor-guidance]')).toBeVisible();
  await expect(move.locator('[data-advisor-guidance]')).toContainText('DO THIS IN BRAND OS');
  await expect(move.locator('[data-advisor-primary]')).toHaveText('Open Customer Acquisition');
  await expect(move.locator('[data-advisor-resources]')).toContainText('OPTIONAL OUTSIDE READING');

  await move.locator('[data-advisor-help]').click();
  await expect(page.locator('#helpRoot')).toHaveClass(/\bopen\b/);
  await expect(page.locator('[data-help-tool="cac"]')).toHaveClass(/helpContextTarget/);
  await expect(page.locator('[data-help-term="CAC"]')).toHaveAttribute('open','');
  await page.locator('.helpClose').click();
  await expect(move.locator('[data-advisor-help]')).toBeFocused();

  await move.locator('[data-advisor-primary]').click();
  await expect(page.locator('#title')).toHaveText('Customer Acquisition Cost');
  await expect(page.locator('#title')).toBeFocused();
  const after=await page.evaluate(()=>({state:localStorage.getItem('msbo_state'),touched:localStorage.getItem('msbo_touched'),mode:localStorage.getItem('msbo_mode')}));
  expect(after).toEqual(before);
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('Advisor guidance remains usable and overflow-free on a narrow phone layout',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await seedProductEconomics(page);
  await page.goto(APP,{waitUntil:'domcontentloaded'});

  await page.locator('#menuBtn').click();
  await page.locator('#nav button[data-view="advisor"]').click();
  await expect(page.locator('#title')).toHaveText('Next Move Advisor');
  const move=page.locator('.card').filter({has:page.getByRole('heading',{name:'Finish the acquisition model'})});
  await expect(move.locator('[data-advisor-primary]')).toBeVisible();
  await expect(move.locator('[data-advisor-help]')).toBeVisible();
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),{timeout:2000}).toBeLessThanOrEqual(1);
  await page.screenshot({path:`${SHOTS}/advisor-guidance-mobile.png`,fullPage:false});

  await move.locator('[data-advisor-primary]').click();
  await expect(page.locator('#title')).toHaveText('Customer Acquisition Cost');
  await expect(page.locator('#title')).toBeFocused();
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});
