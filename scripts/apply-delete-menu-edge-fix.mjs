import fs from 'node:fs';

const path='public/app.js';
let app=fs.readFileSync(path,'utf8');
const from="async function deleteBrand(brandId){\n  const brand=brands.find(b=>String(b.id)===String(brandId));";
const to="async function deleteBrand(brandId){\n  closeMenu({restoreFocus:false});\n  const brand=brands.find(b=>String(b.id)===String(brandId));";
if(!app.includes(from))throw new Error('deleteBrand patch target missing');
app=app.replace(from,to);
fs.writeFileSync(path,app);

const testPath='tests/mobile-nav-contract.test.js';
let test=fs.readFileSync(testPath,'utf8');
const marker="delete brand closes mobile navigation before confirmation";
if(!test.includes(marker))test += `\n\ntest('${marker}',()=>{\n  const start=app.indexOf('async function deleteBrand(brandId)');\n  const end=app.indexOf('async function addSku',start);\n  const fn=app.slice(start,end);\n  assert.match(fn,/closeMenu\\(\\{restoreFocus:false\\}\\)/);\n  assert.ok(fn.indexOf('closeMenu')<fn.indexOf('confirm(warning)'));\n});\n`;
fs.writeFileSync(testPath,test);
