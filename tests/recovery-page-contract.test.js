import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../public/forgot-password.html',import.meta.url),'utf8');
const script=await readFile(new URL('../public/forgot-password.js',import.meta.url),'utf8');
const support=await readFile(new URL('../public/support.html',import.meta.url),'utf8');
const accountUi=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');

test('password recovery has a permanent public entrypoint',()=>{
  assert.match(page,/Reset your password/i);
  assert.match(page,/id="recoveryEmail"/);
  assert.match(page,/id="recoverySend"/);
  assert.match(page,/src="forgot-password\.js"/);
  assert.match(support,/href="\/forgot-password\.html"/);
});

test('standalone recovery uses the server recovery endpoint without exposing account existence',()=>{
  assert.match(script,/fetch\('\/api\/auth\/recover'/);
  assert.match(script,/If that account exists, a recovery email has been sent/);
  assert.doesNotMatch(script,/SUPABASE_/);
});

test('sign-in modal still exposes password recovery',()=>{
  assert.match(accountUi,/Forgot password\?/);
  assert.match(accountUi,/showForgotPassword/);
  assert.match(accountUi,/\/api\/auth\/recover/);
});
