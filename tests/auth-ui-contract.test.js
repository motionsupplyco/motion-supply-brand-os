import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
const accountUi=await readFile(new URL('../public/account-ui.js',import.meta.url),'utf8');

test('all signed-out account entrypoints use the production account surface',()=>{
  assert.match(accountUi,/closest\('#authBtn'\).*showAccount\(\)/s);
  assert.match(accountUi,/closest\('#inlineSignIn'\).*showSignIn\(\)/s);
  assert.match(accountUi,/closest\('#upgradeNow'\).*loadSession\(\).*showSignIn\(\)/s);
  assert.match(accountUi,/Forgot password\?/);
  assert.match(accountUi,/\/privacy\.html/);
  assert.match(accountUi,/\/terms\.html/);
  assert.match(accountUi,/\/support\.html/);
});

test('password recovery keeps users on the trusted app origin that requested the email',()=>{
  const helper=server.match(/function trustedRecoveryOrigin\(req\)[\s\S]*?\n\}/)?.[0]||'';
  assert.ok(helper,'trustedRecoveryOrigin helper must exist');
  assert.match(helper,/req\.headers\.origin/);
  assert.match(helper,/motion-supply-brand-os\.vercel\.app/);
  assert.match(helper,/-motion-supply-co\.vercel\.app/);
  assert.match(helper,/configuredOrigin/);
  assert.doesNotMatch(helper,/endsWith\('\.vercel\.app'\)/);
  const recover=server.match(/app\.post\('\/api\/auth\/recover'[\s\S]*?\}\)\);/)?.[0]||'';
  assert.match(recover,/trustedRecoveryOrigin\(req\)/);
  assert.match(recover,/redirectTo:`\$\{redirectOrigin\}\/\?reset=1`/);
});

test('protected API identity is revalidated against Supabase Auth on every request',()=>{
  const helper=server.match(/async function userFromRequest\(req\)[\s\S]*?\nasync function subscriptionForUser/)?.[0]||'';
  assert.ok(helper,'userFromRequest helper must exist');
  assert.match(helper,/admin\.auth\.getUser\(token\)/);
  assert.doesNotMatch(helper,/getSession\(/);
});
