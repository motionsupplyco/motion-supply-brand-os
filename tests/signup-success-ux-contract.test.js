import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const accountUi=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');

test('successful signup shows only a clear email-confirmation state',()=>{
  assert.match(accountUi,/ONE MORE STEP/);
  assert.match(accountUi,/Check your email/);
  assert.match(accountUi,/Look for a confirmation link at/);
  assert.match(accountUi,/check Spam or Promotions too/);
  assert.doesNotMatch(accountUi,/Supabase intentionally does not reveal/);
  assert.doesNotMatch(accountUi,/If this is a new account/);
  assert.doesNotMatch(accountUi,/Already used this email before\?/);
  assert.doesNotMatch(accountUi,/acctAfterSignupSignin/);
  assert.doesNotMatch(accountUi,/acctAfterSignupRecover/);
  assert.doesNotMatch(accountUi,/No email after a few minutes\?/);
});
