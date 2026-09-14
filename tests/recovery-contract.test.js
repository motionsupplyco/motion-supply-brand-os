import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const accountUi=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');
const recoveryHtml=await readFile(new URL('../public/forgot-password.html',import.meta.url),'utf8');
const recoveryJs=await readFile(new URL('../public/forgot-password.js',import.meta.url),'utf8');

test('password recovery is visible and has a standalone fallback',()=>{
  assert.match(accountUi,/Forgot password\?/);
  assert.match(recoveryHtml,/Reset your password/);
  assert.match(recoveryHtml,/src="forgot-password\.js"/);
  assert.match(recoveryJs,/\/api\/auth\/recover/);
});

test('password recovery does not report success when Supabase rejects delivery',()=>{
  const start=server.indexOf("app.post('/api/auth/recover'");
  const end=server.indexOf("app.post('/api/auth/update-password'",start);
  const route=start>=0&&end>start?server.slice(start,end):'';
  assert.ok(route,'recovery route must exist');
  assert.match(route,/const\{error\}=await authClient\.auth\.resetPasswordForEmail/);
  assert.match(route,/RECOVERY_RATE_LIMITED/);
  assert.match(route,/RECOVERY_DELIVERY_FAILED/);
  assert.match(route,/console\.error\('recover-email'/);
  assert.ok(route.indexOf('if(error)')>route.indexOf('resetPasswordForEmail'),'delivery error must be checked after Supabase returns');
});

test('password update validates the bearer token before changing only that user',()=>{
  const start=server.indexOf("app.post('/api/auth/update-password'");
  const end=server.indexOf("app.get('/api/account'",start);
  const route=server.slice(start,end);
  assert.match(route,/admin\.auth\.getUser\(token\)/);
  assert.match(route,/admin\.auth\.admin\.updateUserById\(userData\.user\.id,\{password\}\)/);
  assert.doesNotMatch(route,/userClient\.auth\.updateUser/);
});
