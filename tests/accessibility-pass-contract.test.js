import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'public','accessibility.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public','accessibility.css'),'utf8');

test('shared accessibility assets load exactly once',()=>{
  assert.equal((html.match(/accessibility\.css/g)||[]).length,1);
  assert.equal((html.match(/accessibility\.js/g)||[]).length,1);
});

test('accessibility layer creates skip navigation and named main content',()=>{
  assert.match(js,/Skip to main content/);
  assert.match(js,/href='#mainContent'|href='\#mainContent'|link\.href='#mainContent'/);
  assert.match(js,/main\.id=main\.id\|\|'mainContent'/);
  assert.match(js,/main\.tabIndex=-1/);
  assert.match(js,/aria-labelledby','title/);
});

test('generated calculator fields receive associated labels and descriptions',()=>{
  assert.match(js,/\.field/);
  assert.match(js,/label\.htmlFor=control\.id/);
  assert.match(js,/aria-describedby/);
  assert.match(js,/dataset\.key/);
});

test('dashboard quick actions become keyboard-operable controls',()=>{
  assert.match(js,/\.actioncard\[data-jump\]/);
  assert.match(js,/setAttribute\('role','button'\)/);
  assert.match(js,/card\.tabIndex=0/);
  assert.match(js,/event\.key==='Enter'/);
  assert.match(js,/event\.key===' '/);
  assert.match(js,/card\.click\(\)/);
});

test('special controls and tables gain accessible names and header scopes',()=>{
  assert.match(js,/Choose Shopify CSV file/);
  assert.match(js,/Type DELETE to confirm account deletion/);
  assert.match(js,/table th/);
  assert.match(js,/setAttribute\('scope','col'\)/);
});

test('current navigation and dialog naming stay synchronized with rendered state',()=>{
  assert.match(js,/aria-current','page/);
  assert.match(js,/MutationObserver/);
  assert.match(js,/aria-labelledby/);
  assert.match(js,/msbo-dialog-title/);
});

test('keyboard focus is visible and reduced-motion preference is honored',()=>{
  assert.match(css,/:focus-visible/);
  assert.match(css,/outline:/);
  assert.match(css,/prefers-reduced-motion:\s*reduce/);
  assert.match(css,/transition-duration:\.01ms!important/);
});
