import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const memory=await readFile(new URL('../public/business-memory-ui.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const mobileA11y=await readFile(new URL('../public/mobile-nav-a11y.js',import.meta.url),'utf8');

test('mobile menu has independent dismissal and accessibility state wiring',()=>{
  assert.match(html,/id="menuCloseBtn"/);
  assert.match(html,/id="menuBackdrop"/);
  assert.match(html,/aria-controls="side"/);
  assert.match(html,/src="mobile-nav-a11y\.js"/);
  assert.match(app,/function openMenu\(\)/);
  assert.match(app,/menuCloseBtn/);
  assert.match(app,/menuBackdrop/);
  assert.match(app,/e\.key==='Escape'/);
  assert.match(app,/document\.body\.classList\.add\('menuOpen'\)/);
  assert.match(app,/document\.body\.classList\.remove\('menuOpen'\)/);
  assert.match(app,/menuCloseBtn'\)\|\|document\.querySelector\('#nav button'\)/);
  assert.match(app,/trigger\?\.focus\(\)/);
});

test('mobile drawer is inert while closed and traps Tab focus while open',()=>{
  assert.match(mobileA11y,/mobileQuery=window\.matchMedia\('\(max-width:820px\)'\)/);
  assert.match(mobileA11y,/side\.inert=true/);
  assert.match(mobileA11y,/side\.setAttribute\('aria-hidden','true'\)/);
  assert.match(mobileA11y,/side\.inert=false/);
  assert.match(mobileA11y,/function trapDrawerFocus\(event\)/);
  assert.match(mobileA11y,/event\.key!=='Tab'/);
  assert.match(mobileA11y,/side\.contains\(active\)/);
  assert.match(mobileA11y,/last\.focus\(\{preventScroll:true\}\)/);
  assert.match(mobileA11y,/first\.focus\(\{preventScroll:true\}\)/);
  assert.match(mobileA11y,/MutationObserver\(syncDrawerAccessibility\)/);
  assert.match(mobileA11y,/mobileQuery\.addEventListener\('change',syncDrawerAccessibility\)/);
});

test('every mobile nav selection uses the complete close path including custom V2 route buttons',()=>{
  assert.match(mobileA11y,/function closeDrawerAfterNavSelection\(event\)/);
  assert.match(mobileA11y,/target\?\.closest\('#nav button'\)/);
  assert.match(mobileA11y,/window\.msboCloseMenu\(\)/);
  assert.match(mobileA11y,/document\.addEventListener\('click',closeDrawerAfterNavSelection\)/);
});

test('Business Memory uses the complete menu close path',()=>{assert.match(memory,/window\.msboCloseMenu\?\.\(\)/);});

test('delete brand closes mobile navigation before confirmation',()=>{
  const start=app.indexOf('async function deleteBrand(brandId)');
  const end=app.indexOf('async function addSku',start);
  const fn=app.slice(start,end);
  assert.match(fn,/closeMenu\(\{restoreFocus:false\}\)/);
  assert.ok(fn.indexOf('closeMenu')<fn.indexOf('confirm(warning)'));
});
