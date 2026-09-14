import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const modal=await readFile(new URL('../public/modal-a11y.js',import.meta.url),'utf8');

test('shared modal exposes accessible dialog semantics',()=>{
  assert.match(html,/class="modalbox" role="dialog" aria-modal="true"/);
  assert.match(html,/id="closeModal"[^>]+aria-label="Close dialog"/);
  assert.match(html,/src="modal-a11y\.js"/);
});

test('shared modal contains keyboard focus and restores the invoking control',()=>{
  assert.match(modal,/shell\.inert=true/);
  assert.match(modal,/shell\.inert=false/);
  assert.match(modal,/event\.key!==\'Tab\'/);
  assert.match(modal,/event\.shiftKey/);
  assert.match(modal,/returnFocus=document\.activeElement/);
  assert.match(modal,/target\.focus\(\{preventScroll:true\}\)/);
});
