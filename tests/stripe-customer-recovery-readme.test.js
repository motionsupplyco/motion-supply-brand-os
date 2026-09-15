import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const doc=await readFile(new URL('../BILLING_RECOVERY_IMPLEMENTATION.md',import.meta.url),'utf8');

test('billing recovery documentation keeps the production safety gate explicit',()=>{
  assert.match(doc,/Do not merge until/);
  assert.match(doc,/resource_missing/);
  assert.match(doc,/full test suite\/CI is green/);
});
