import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../public/account-ui.js',import.meta.url),'utf8');

test('account actions suppress duplicate submissions while pending',()=>{
  assert.match(ui,/async function withPending\(button,pendingLabel,task\)/);
  assert.match(ui,/if\(!button\|\|button\.disabled\)return/);
  assert.match(ui,/button\.disabled=true/);
  assert.match(ui,/button\.setAttribute\('aria-busy','true'\)/);
  assert.match(ui,/button\.disabled=false/);
  assert.match(ui,/button\.removeAttribute\('aria-busy'\)/);
});

test('auth email and sensitive actions use pending guard',()=>{
  assert.match(ui,/withPending\(button,kind==='signin'\?'Signing in…':'Creating account…'/);
  assert.match(ui,/withPending\(button,'Sending…'/);
  assert.match(ui,/withPending\(button,'Updating…'/);
  assert.match(ui,/withPending\(button,active\?'Opening billing…':'Opening checkout…'/);
  assert.match(ui,/withPending\(button,'Deleting…'/);
});
