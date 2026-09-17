import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const notes=await readFile(new URL('../docs/problem-navigator-release-notes.md',import.meta.url),'utf8');

test('problem navigator release notes keep the stacked merge boundary explicit',()=>{
  assert.match(notes,/stacked on `v3-brand-engine` \/ PR #21/i);
  assert.match(notes,/must not be merged to `main` before its base V3 work lands/i);
  assert.match(notes,/Missing data remains unknown/i);
  assert.match(notes,/does not create a second calculation engine/i);
  assert.match(notes,/Keep this PR draft while PR #21 is unmerged/i);
});
