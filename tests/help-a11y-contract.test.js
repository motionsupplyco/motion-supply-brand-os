import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const help=await readFile(new URL('../public/help.js',import.meta.url),'utf8');

test('beginner guide is modal and isolates the application while open',()=>{
  assert.match(help,/role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"helpTitle\"/);
  assert.match(help,/shell\.inert=true/);
  assert.match(help,/shell\.inert=false/);
  assert.match(help,/helpReturnFocus=document\.activeElement/);
});

test('beginner guide supports Escape, Tab trapping, and focus restoration',()=>{
  assert.match(help,/e\.key==='Escape'/);
  assert.match(help,/e\.key!=='Tab'/);
  assert.match(help,/e\.shiftKey/);
  assert.match(help,/target\.focus\(\{preventScroll:true\}\)/);
  assert.match(help,/closeHelp\(\{restoreFocus:false\}\)/);
});
