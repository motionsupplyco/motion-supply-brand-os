import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const server=await readFile(new URL('../server.js',import.meta.url),'utf8');

test('in-process limiter state is bounded and pruned',()=>{
  assert.match(server,/RATE_BUCKET_SOFT_LIMIT=5000/);
  assert.match(server,/RATE_BUCKET_HARD_LIMIT=10000/);
  assert.match(server,/RATE_BUCKET_MAX_AGE=60\*60_000/);
  assert.match(server,/function pruneRateBuckets\(now\)/);
  assert.match(server,/now-\(x\.touchedAt\|\|x\.start\)>RATE_BUCKET_MAX_AGE/);
  assert.match(server,/buckets\.size>RATE_BUCKET_HARD_LIMIT/);
  assert.match(server,/x\.touchedAt=now/);
});

test('rate limit responses expose a positive Retry-After value',()=>{
  assert.match(server,/Retry-After',Math\.max\(1,Math\.ceil/);
  assert.match(server,/code:'RATE_LIMITED'/);
});
