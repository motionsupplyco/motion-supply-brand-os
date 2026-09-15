import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');

test('catalog UI exposes complete brand and SKU CRUD controls',()=>{
  for(const marker of ['data-editbrand','data-deletebrand','data-addsku','data-editsku','data-deletesku'])assert.match(app,new RegExp(marker));
  assert.match(app,/api\(`\/api\/brands\/\$\{encodeURIComponent\(brandId\)\}`,'PATCH'/);
  assert.match(app,/api\(`\/api\/skus\/\$\{encodeURIComponent\(skuId\)\}`,'PATCH'/);
  assert.match(app,/api\(`\/api\/skus\/\$\{encodeURIComponent\(skuId\)\}`,'DELETE'/);
});

test('catalog destructive controls require explicit confirmation',()=>{
  assert.match(app,/async function deleteBrand[\s\S]*?confirm\(warning\)/);
  assert.match(app,/async function deleteSku[\s\S]*?confirm\(`/);
});
