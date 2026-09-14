import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const account=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');

test('ambiguous signup confirmation does not falsely claim a new account was created',()=>{
  assert.doesNotMatch(account,/Account created\. Check your email to confirm, then sign in\./);
  assert.match(account,/If this is a new account, check your email for the confirmation message\./);
  assert.match(account,/If you already used this email before, sign in or reset your password\./);
});

test('post-signup guidance exposes sign-in and password-recovery paths',()=>{
  assert.match(account,/id="acctAfterSignupSignin"/);
  assert.match(account,/id="acctAfterSignupRecover"/);
  assert.match(account,/acctAfterSignupSignin/);
  assert.match(account,/acctAfterSignupRecover/);
  assert.match(account,/showForgotPassword/);
});
