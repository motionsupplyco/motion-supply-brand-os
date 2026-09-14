import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const memory=await readFile(new URL('../public/business-memory-ui.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
test('mobile menu has independent dismissal and accessibility state wiring',()=>{
  assert.match(html,/id="menuCloseBtn"/);
  assert.match(html,/id="menuBackdrop"/);
  assert.match(app,/function openMenu\(\)/);
  assert.match(app,/menuCloseBtn/);
  assert.match(app,/menuBackdrop/);
  assert.match(app,/e\.key==='Escape'/);
  assert.match(app,/document\.body\.classList\.add\('menuOpen'\)/);
  assert.match(app,/document\.body\.classList\.remove\('menuOpen'\)/);
  assert.match(app,/menuCloseBtn'\)\|\|document\.querySelector\('#nav button'\)/);
  assert.match(app,/trigger\?\.focus\(\)/);
});
test('Business Memory uses the complete menu close path',()=>{assert.match(memory,/window\.msboCloseMenu\?\.\(\)/);});


test('delete brand closes mobile navigation before confirmation',()=>{
  const start=app.indexOf('async function deleteBrand(brandId)');
  const end=app.indexOf('async function addSku',start);
  const fn=app.slice(start,end);
  assert.match(fn,/closeMenu\(\{restoreFocus:false\}\)/);
  assert.ok(fn.indexOf('closeMenu')<fn.indexOf('confirm(warning)'));
});
