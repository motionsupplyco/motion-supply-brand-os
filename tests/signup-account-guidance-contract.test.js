import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const account=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');

test('ambiguous signup confirmation stays privacy-safe without duplicate-account copy',()=>{
  assert.doesNotMatch(account,/Account created\. Check your email to confirm, then sign in\./);
  assert.doesNotMatch(account,/We sent a confirmation link/);
  assert.doesNotMatch(account,/Already used this email before\?/);
  assert.doesNotMatch(account,/Supabase intentionally does not reveal/);
  assert.match(account,/Check your email/);
  assert.match(account,/Look for a confirmation link at/);
  assert.match(account,/check Spam or Promotions too/);
});

test('post-signup confirmation does not show account-recovery actions',()=>{
  assert.doesNotMatch(account,/id="acctAfterSignupSignin"/);
  assert.doesNotMatch(account,/id="acctAfterSignupRecover"/);
  assert.doesNotMatch(account,/No email after a few minutes\?/);
});
