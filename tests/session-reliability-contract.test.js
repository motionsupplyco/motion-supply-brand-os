import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');

test('API errors preserve HTTP status and application code',()=>{
  assert.match(app,/const e=new Error\(j\.error\|\|`Request failed \(\$\{r\.status\}\)`\);e\.status=r\.status;e\.code=j\.code\|\|null;throw e/);
});

test('account refresh only clears the local session for a real 401',()=>{
  const start=app.indexOf('async function refreshAccount()');
  const end=app.indexOf('function updateAccount()',start);
  const fn=start>=0&&end>start?app.slice(start,end):'';
  assert.ok(fn,'refreshAccount must exist');
  assert.match(fn,/if\(e\.status===401\)\{storeSession\(null\)/);
  assert.match(fn,/else console\.error\('refresh-account',e\)/);
  assert.match(fn,/try\{await loadCloud\(\)\}catch\(e\)\{console\.error\('load-cloud',e\)\}/);
  assert.doesNotMatch(fn,/catch\(e\)\{storeSession\(null\)/);
});
