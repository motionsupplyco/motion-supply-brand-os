import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const support=fs.readFileSync(new URL('../public/support.html',import.meta.url),'utf8');

test('support page exposes the production support email',()=>{
  assert.match(support,/support@motionsupplyos\.com/);
  assert.match(support,/mailto:support@motionsupplyos\.com/);
});
