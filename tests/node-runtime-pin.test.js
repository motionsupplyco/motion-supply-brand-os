import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const root=path.join(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const workflow=fs.readFileSync(path.join(root,'.github','workflows','test.yml'),'utf8');

const EXPECTED_NODE='24.x';

test('production manifest and lockfile pin the same Node major',()=>{
  assert.equal(pkg.engines?.node,EXPECTED_NODE);
  assert.equal(lock.packages?.['']?.engines?.node,EXPECTED_NODE);
});

test('CI verifies the same Node major used by production',()=>{
  assert.match(workflow,/node-version:\s*24(?:\s|$)/m);
});

test('Node pin does not loosen exact production dependency versions',()=>{
  assert.deepEqual(pkg.dependencies,{
    '@supabase/supabase-js':'2.116.0',
    dotenv:'16.6.1',
    express:'5.2.1',
    stripe:'18.5.0'
  });
  assert.deepEqual(lock.packages?.['']?.dependencies,pkg.dependencies);
});
