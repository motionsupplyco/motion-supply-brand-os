import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ADVISOR_GUIDANCE,advisorGuidanceFor} from '../public/advisor-guidance.js';
import {problemNavigatorTarget} from '../public/problem-navigator.js';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public','advisor-resources.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public','index.html'),'utf8');

function advisorRuleTitles(){
  const block=app.match(/function nextMoves\(\)\{([\s\S]*?)\n\}\nfunction advisor/)?.[1]||'';
  const titles=[
    ...[...block.matchAll(/return\s+\[\['([^']+)'/g)].map(match=>match[1]),
    ...[...block.matchAll(/out\.push\(\['([^']+)'/g)].map(match=>match[1])
  ];
  return [...new Set(titles)].sort();
}

test('every current Next Move Advisor rule has explicit first-party guidance',()=>{
  const rules=advisorRuleTitles();
  const guidance=Object.keys(ADVISOR_GUIDANCE).sort();
  assert.equal(rules.length,10);
  assert.deepEqual(guidance,rules);
});

test('advisor guidance is actionable, contextual and does not invent benchmark data',()=>{
  const allowedHelpViews=new Set(['profit','cac','inventory','cash','po','fulfillment','shopify']);
  for(const [title,guidance] of Object.entries(ADVISOR_GUIDANCE)){
    assert.equal(advisorGuidanceFor(` ${title} `),guidance);
    assert.ok(guidance.action);
    assert.ok(guidance.actionLabel);
    assert.ok(guidance.rationale.length>=40);
    assert.ok(allowedHelpViews.has(guidance.help.view));
    assert.ok(guidance.helpLabel);
    if(guidance.action!=='review-3pl')assert.ok(problemNavigatorTarget(guidance.action),`${title} must reuse an existing problem-navigator action target`);
  }
});

test('advisor UI prioritizes Brand OS action/help before optional external reading',()=>{
  assert.match(index,/advisor-guidance\.css/);
  assert.match(index,/advisor-resources\.js/);
  assert.match(ui,/DO THIS IN BRAND OS/);
  assert.match(ui,/dataset\.advisorPrimary/);
  assert.match(ui,/dataset\.advisorHelp/);
  assert.match(ui,/msboOpenHelp/);
  assert.match(ui,/problemNavigatorTarget/);
  assert.match(ui,/OPTIONAL OUTSIDE READING/);
  assert.match(ui,/noopener noreferrer/);
  assert.doesNotMatch(ui,/localStorage\.(?:setItem|removeItem)\(/);
});
