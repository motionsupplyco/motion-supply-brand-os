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

test('Profit & Pricing explains the decision and opens contextual first-party help without changing founder inputs',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>{
    localStorage.setItem('msbo_state',JSON.stringify({price:84,landedCost:24.7}));
    localStorage.setItem('msbo_touched',JSON.stringify(['price','landedCost']));
  });
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  const before=await page.evaluate(()=>({state:localStorage.getItem('msbo_state'),touched:localStorage.getItem('msbo_touched')}));

  await page.locator('#nav button[data-view="profit"]').click();
  await expect(page.locator('#title')).toHaveText('Profit & Pricing');
  await expect(page.locator('#workspaceDecisionContext')).toBeVisible();
  await expect(page.locator('#workspaceDecisionContext')).toContainText('Can one modeled order create enough contribution before acquisition?');
  await expect(page.locator('#workspaceDecisionContext')).toContainText('EVIDENCE NEEDED');
  await expect(page.locator('#workspaceDecisionContext')).toContainText('NEXT HANDOFF');

  await page.locator('#workspaceDecisionHelp').click();
  await expect(page.locator('#helpRoot')).toHaveClass(/\bopen\b/);
  await expect(page.locator('[data-help-tool="profit"]')).toHaveClass(/helpContextTarget/);
  await expect(page.locator('[data-help-term="Contribution"]')).toHaveAttribute('open','');
  await page.locator('.helpClose').click();
  await expect(page.locator('#helpRoot')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#workspaceDecisionHelp')).toBeFocused();

  const after=await page.evaluate(()=>({state:localStorage.getItem('msbo_state'),touched:localStorage.getItem('msbo_touched')}));
  expect(after).toEqual(before);
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('Inventory decision context is readable at 390×844 and keeps contextual help usable',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto(APP,{waitUntil:'domcontentloaded'});

  await page.locator('#menuBtn').click();
  await page.locator('#nav button[data-view="inventory"]').click();
  await expect(page.locator('#title')).toHaveText('Inventory & Reorder');
  await expect(page.locator('#workspaceDecisionContext')).toBeVisible();
  await expect(page.locator('#workspaceDecisionContext')).toContainText('When does current inventory deserve a reorder review?');
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),{timeout:2000}).toBeLessThanOrEqual(1);
  await page.screenshot({path:`${SHOTS}/workspace-decision-context-mobile.png`,fullPage:false});

  await page.locator('#workspaceDecisionHelp').click();
  await expect(page.locator('#helpRoot')).toHaveClass(/\bopen\b/);
  await expect(page.locator('[data-help-term="Reorder point"]')).toHaveAttribute('open','');
  await page.locator('.helpClose').click();
  await expect(page.locator('#workspaceDecisionHelp')).toBeFocused();
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});
