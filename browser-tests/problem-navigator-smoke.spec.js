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

async function expectDrawerOffCanvas(page){
  await expect.poll(async()=>page.locator('#side').evaluate(el=>Math.round(el.getBoundingClientRect().right)),{timeout:2000}).toBeLessThanOrEqual(1);
}

test('problem-first navigator preserves founder inputs, opens contextual education and routes into existing tools',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>{
    localStorage.setItem('msbo_state',JSON.stringify({price:84,landedCost:24.7,weeklyDemand:12}));
    localStorage.setItem('msbo_touched',JSON.stringify(['price','landedCost','weeklyDemand']));
  });
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  const before=await page.evaluate(()=>({state:localStorage.getItem('msbo_state'),touched:localStorage.getItem('msbo_touched')}));

  await page.locator('#problemNav').click();
  await expect(page.locator('#modal')).not.toHaveClass(/\bhidden\b/);
  await expect(page.locator('body')).toHaveClass(/\bproblemNavigatorOpen\b/);
  await expect(page.locator('#floatingHelp')).toBeHidden();
  await expect(page.locator('.problemNavigator')).toBeVisible();
  await expect(page.locator('[data-problem-id]')).toHaveCount(8);
  await expect(page.locator('[data-problem-id="margin"]')).toContainText("WHAT'S HAPPENING");
  await expect(page.locator('[data-problem-id="margin"]')).toContainText('WHY IT MATTERS');
  await expect(page.locator('[data-problem-id="margin"]')).toContainText('WHAT TO DO');
  await expect(page.locator('.problemTruth')).toContainText('Missing business data stays unknown');

  const afterOpen=await page.evaluate(()=>({state:localStorage.getItem('msbo_state'),touched:localStorage.getItem('msbo_touched')}));
  expect(afterOpen).toEqual(before);

  await page.locator('[data-problem-id="margin"] [data-problem-help-view]').click();
  await expect(page.locator('#modal')).toHaveClass(/\bhidden\b/);
  await expect(page.locator('body')).not.toHaveClass(/\bproblemNavigatorOpen\b/);
  await expect(page.locator('#helpRoot')).toHaveClass(/\bopen\b/);
  await expect(page.locator('[data-help-tool="profit"]')).toHaveClass(/helpContextTarget/);
  await expect(page.locator('[data-help-term="Contribution"]')).toHaveAttribute('open','');
  await expect(page.locator('[data-help-term="Contribution"]')).toHaveClass(/helpContextTarget/);
  await expect(page.locator('[data-help-term="Contribution"] summary')).toBeFocused();
  const afterHelp=await page.evaluate(()=>({state:localStorage.getItem('msbo_state'),touched:localStorage.getItem('msbo_touched')}));
  expect(afterHelp).toEqual(before);

  await page.locator('.helpClose').click();
  await expect(page.locator('#helpRoot')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#problemNav')).toBeFocused();
  await page.locator('#problemNav').click();
  await page.locator('[data-problem-action="fix-margin"]').click();
  await expect(page.locator('#modal')).toHaveClass(/\bhidden\b/);
  await expect(page.locator('body')).not.toHaveClass(/\bproblemNavigatorOpen\b/);
  await expect(page.locator('#title')).toHaveText('Profit Guardrails');
  await expect(page.locator('[data-profit-view="profitguardrails"]')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#app')).toContainText('Profit Guardrails');

  const afterRoute=await page.evaluate(()=>({state:localStorage.getItem('msbo_state'),touched:localStorage.getItem('msbo_touched')}));
  expect(afterRoute).toEqual(before);
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

test('problem-first navigator is usable on mobile and closes the drawer before opening',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto(APP,{waitUntil:'domcontentloaded'});

  await page.locator('#menuBtn').click();
  await expect(page.locator('#side')).toHaveClass(/\bopen\b/);
  await page.locator('#problemNav').click();
  await expect(page.locator('#side')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('body')).not.toHaveClass(/\bmenuOpen\b/);
  await expect(page.locator('body')).toHaveClass(/\bproblemNavigatorOpen\b/);
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded','false');
  await expectDrawerOffCanvas(page);
  await expect(page.locator('.problemNavigator')).toBeVisible();
  await expect(page.locator('.modalbox')).toHaveClass(/problemNavigatorModal/);
  await expect(page.locator('#floatingHelp')).toBeHidden();
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),{timeout:2000}).toBeLessThanOrEqual(1);
  await page.screenshot({path:`${SHOTS}/problem-navigator-mobile.png`,fullPage:false});

  await page.locator('#closeModal').click();
  await expect(page.locator('#modal')).toHaveClass(/\bhidden\b/);
  await expect(page.locator('body')).not.toHaveClass(/\bproblemNavigatorOpen\b/);
  await expect(page.locator('#floatingHelp')).toBeVisible();

  await page.locator('#menuBtn').click();
  await page.locator('#problemNav').click();
  await page.locator('[data-problem-id="cash"] [data-problem-help-view]').click();
  await expect(page.locator('#modal')).toHaveClass(/\bhidden\b/);
  await expect(page.locator('body')).not.toHaveClass(/\bproblemNavigatorOpen\b/);
  await expect(page.locator('#helpRoot')).toHaveClass(/\bopen\b/);
  await expect(page.locator('[data-help-term="Protected cash floor"]')).toHaveAttribute('open','');
  await page.locator('.helpClose').click();
  await expect(page.locator('#helpRoot')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('#menuBtn')).toBeFocused();

  await page.locator('#menuBtn').click();
  await page.locator('#problemNav').click();
  await page.locator('[data-problem-id="cash"] summary').click();
  await expect(page.locator('[data-problem-id="cash"] .problemExplain')).toHaveAttribute('open','');
  await page.locator('[data-problem-action="protect-cash"]').click();
  await expect(page.locator('#modal')).toHaveClass(/\bhidden\b/);
  await expect(page.locator('body')).not.toHaveClass(/\bproblemNavigatorOpen\b/);
  await expect(page.locator('#title')).toHaveText('Cash Forecast');
  await expect(page.locator('[data-v2-view="cashforecast"]')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#menuBtn')).toBeFocused();

  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});
