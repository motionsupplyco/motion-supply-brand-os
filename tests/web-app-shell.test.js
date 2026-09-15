import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));

test('web app shell exposes install metadata and launch description',()=>{
  assert.match(index,/rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(index,/rel="icon" href="\/app-icon\.svg"/);
  assert.match(index,/name="description" content="[^"]+"/);
  assert.match(index,/name="apple-mobile-web-app-capable" content="yes"/);
  assert.equal(manifest.name,'Motion Supply Brand OS');
  assert.equal(manifest.short_name,'Brand OS');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'/');
  assert.ok(Array.isArray(manifest.icons)&&manifest.icons.some(icon=>icon.src==='/app-icon.svg'));
});
