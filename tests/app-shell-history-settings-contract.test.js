import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Settings is a first-class Brand OS workspace with account, data, install, help and legal controls',()=>{
  const html=read('public/index.html');
  const settings=read('public/settings-ui.js');
  assert.match(html,/id="settingsNav"/);
  assert.match(html,/settings-ui\.css/);
  assert.match(html,/settings-ui\.js/);
  for(const label of ['ACCOUNT & PLAN','WORKSPACE & DATA','APP ACCESS','HELP & LEGAL'])assert.match(settings,new RegExp(label.replace(/[&]/g,'\\&')));
  assert.match(settings,/\/support\.html/);
  assert.match(settings,/\/privacy\.html/);
  assert.match(settings,/\/terms\.html/);
  assert.match(settings,/Add to Home Screen/);
});

test('workspace routing owns browser history and restores Brand OS routes on popstate',()=>{
  const router=read('public/workspace-route.js');
  assert.match(router,/history\.pushState/);
  assert.match(router,/history\.replaceState/);
  assert.match(router,/addEventListener\('popstate'/);
  assert.match(router,/navigateFromHistory/);
  assert.match(router,/core:settings/);
  assert.match(router,/core:memory/);
});

test('Safari-engine CI permanently runs the app-shell history regression',()=>{
  const workflow=read('.github/workflows/v2-browser-smoke.yml');
  assert.match(workflow,/app-shell-history-settings\.spec\.js/);
  assert.match(workflow,/--project=webkit/);
  const browser=read('browser-tests/app-shell-history-settings.spec.js');
  assert.match(browser,/history\.back\(\)/);
  assert.match(browser,/history\.forward\(\)/);
  assert.match(browser,/expectDrawerOffCanvas/);
});
