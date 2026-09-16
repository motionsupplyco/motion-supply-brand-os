import {test,expect} from '@playwright/test';

const APP='http://127.0.0.1:4173/';

function collectPageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return errors;
}

function seconds(value){
  return String(value||'').split(',').map(part=>part.trim()).reduce((max,part)=>{
    if(part.endsWith('ms'))return Math.max(max,Number.parseFloat(part)/1000||0);
    if(part.endsWith('s'))return Math.max(max,Number.parseFloat(part)||0);
    return max;
  },0);
}

async function expectNoDocumentOverflow(page){
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
}

async function enterDemo(page){
  await page.locator('#demoBtn').click();
  await expect(page.locator('#planPill')).toContainText(/DEMO/);
}

test('prefers-reduced-motion collapses shared motion durations in the rendered app',async({page})=>{
  const errors=collectPageErrors(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(APP,{waitUntil:'domcontentloaded'});

  const motion=await page.evaluate(()=>{
    const targets=[document.documentElement,document.querySelector('#side'),document.querySelector('.skipLink')].filter(Boolean);
    return targets.map(target=>{
      const style=getComputedStyle(target);
      return {
        transitionDuration:style.transitionDuration,
        animationDuration:style.animationDuration,
        animationIterationCount:style.animationIterationCount,
        scrollBehavior:style.scrollBehavior
      };
    });
  });

  expect(motion.length).toBeGreaterThan(0);
  for(const item of motion){
    expect(seconds(item.transitionDuration)).toBeLessThanOrEqual(0.001);
    expect(seconds(item.animationDuration)).toBeLessThanOrEqual(0.001);
    expect(item.animationIterationCount).not.toContain('infinite');
    expect(item.scrollBehavior).toBe('auto');
  }
  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});

for(const viewport of [
  {name:'reflow-640',width:640,height:900},
  {name:'reflow-320',width:320,height:568}
]){
  test(`${viewport.name} keeps representative dashboard and form workspaces inside the document viewport`,async({page})=>{
    const errors=collectPageErrors(page);
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.goto(APP,{waitUntil:'domcontentloaded'});
    await enterDemo(page);
    await expectNoDocumentOverflow(page);

    if(viewport.width<=820){
      await page.locator('#menuBtn').click();
      await expect(page.locator('#side')).toHaveClass(/\bopen\b/);
    }
    await page.locator('[data-view="profit"]').click();
    await expect(page.locator('#title')).toHaveText('Profit & Pricing');
    await expect(page.locator('input[data-key="price"]')).toBeVisible();
    await expectNoDocumentOverflow(page);

    if(viewport.width<=820)await page.locator('#menuBtn').click();
    await page.locator('[data-view="shopify"]').click();
    await expect(page.locator('#csvFile')).toHaveAttribute('aria-label','Choose Shopify CSV file');
    await expectNoDocumentOverflow(page);

    expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
  });
}

test('200 percent root text enlargement keeps core controls reachable without document-level horizontal overflow',async({page})=>{
  const errors=collectPageErrors(page);
  await page.setViewportSize({width:1280,height:1000});
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:'html{font-size:200% !important}'});
  await enterDemo(page);

  await expect(page.locator('#menuBtn')).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.locator('#menuBtn').click();
  await expect(page.locator('#side')).toHaveClass(/\bopen\b/);
  await page.locator('[data-view="profit"]').click();
  await expect(page.locator('input[data-key="price"]')).toBeVisible();
  await expectNoDocumentOverflow(page);

  expect(errors,`uncaught browser errors: ${errors.join(' | ')}`).toEqual([]);
});
