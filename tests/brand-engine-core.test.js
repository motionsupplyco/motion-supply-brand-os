import test from 'node:test';
import assert from 'node:assert/strict';
import {BRAND_ENGINE_VIBES,BRAND_ENGINE_USPTO_SEARCH_URL,normalizeSeedWords,brandNameProfile,trademarkSearchPlan,domainLabelForName,domainCandidates,socialHandleCandidates,generateBrandNames} from '../public/brand-engine-core.js';

test('Brand Engine exposes intentional naming vibes',()=>{
  assert.deepEqual(BRAND_ENGINE_VIBES,['minimal','street','luxury','technical','vintage']);
});

test('seed normalization removes junk, dedupes and caps the set',()=>{
  assert.deepEqual(normalizeSeedWords('ghost, GHOST / archive; 88 $$ void motion supply studio night'),['ghost','GHOST','archive','88','void','motion','supply','studio']);
});

test('domain labels are conservative and URL-friendly',()=>{
  assert.equal(domainLabelForName('VOID DÉPT.™'),'voiddept');
  assert.equal(domainLabelForName('A & B Supply'),'aandbsupply');
  assert.equal(domainLabelForName('  ---  '),'');
});

test('domain candidates never claim availability and only produce normalized names',()=>{
  assert.deepEqual(domainCandidates('Void Dept'),['voiddept.com','voiddept.co','voiddept.net']);
  assert.deepEqual(domainCandidates('Void Dept',{tlds:['.com','COM','bad tld']}),['voiddept.com']);
});

test('social handle candidates stay within common platform length boundaries',()=>{
  const handles=socialHandleCandidates('Motion Supply Company');
  assert.ok(handles.length>0);
  assert.ok(handles.every(handle=>handle.length<=30));
  assert.equal(new Set(handles).size,handles.length);
});

test('USPTO pre-screen plan follows field-tag casing guidance without a clearance verdict',()=>{
  const plan=trademarkSearchPlan('Ghost Dept');
  assert.equal(plan.officialUrl,BRAND_ENGINE_USPTO_SEARCH_URL);
  assert.equal(plan.exactQuery,'CM:"ghost dept"');
  assert.equal(plan.expandedQuery,'CM:(/.*ghost.*/ AND /.*dept.*/)');
  assert.ok(plan.guidance.some(step=>/alternative spellings, pronunciations/i.test(step)));
  assert.ok(plan.guidance.some(step=>/Class 025 alone/i.test(step)));
  assert.match(plan.disclaimer,/not a clearance opinion/i);
  assert.doesNotMatch(JSON.stringify(plan),/trademark clear|clearance score|registration probability/i);
});

test('USPTO pre-screen safely lowercases punctuation-heavy exact and expanded terms',()=>{
  const plan=trademarkSearchPlan("A/B Works 99");
  assert.equal(plan.exactQuery,'CM:"a/b works 99"');
  assert.equal(plan.expandedQuery,'CM:(/.*a.*/ AND /.*b.*/ AND /.*works.*/ AND /.*99.*/)');
});

test('name generation is deterministic for the same founder input',()=>{
  const a=generateBrandNames({seedWords:'void ghost',vibe:'street',count:12});
  const b=generateBrandNames({seedWords:'void ghost',vibe:'street',count:12});
  assert.deepEqual(a,b);
  assert.equal(a.length,12);
  assert.ok(a.every(item=>item.name&&item.trademark?.officialUrl===BRAND_ENGINE_USPTO_SEARCH_URL&&item.domains.length===3&&item.handles.length>0));
});

test('regeneration variations stay deterministic but produce a meaningfully different name set',()=>{
  const base=generateBrandNames({seedWords:'void ghost',vibe:'street',count:12,variation:0});
  const first=generateBrandNames({seedWords:'void ghost',vibe:'street',count:12,variation:1});
  const firstAgain=generateBrandNames({seedWords:'void ghost',vibe:'street',count:12,variation:1});
  const second=generateBrandNames({seedWords:'void ghost',vibe:'street',count:12,variation:2});
  assert.deepEqual(first,firstAgain,'a specific regeneration variation must stay reproducible');
  assert.notDeepEqual(first.map(item=>item.name),base.map(item=>item.name),'Regenerate must not return the original list');
  assert.notDeepEqual(second.map(item=>item.name),first.map(item=>item.name),'successive Regenerate clicks should advance to another list');
  assert.equal(new Set(first.map(item=>item.name)).size,first.length);
});

test('name profile gives observable fit notes instead of a fake quality score',()=>{
  const profile=brandNameProfile('Extremely Long Clothing Brand Company 99');
  assert.equal(profile.words,6);
  assert.ok(profile.notes.some(note=>/Longer name/i.test(note)));
  assert.ok(profile.notes.some(note=>/three words/i.test(note)));
  assert.ok(profile.notes.some(note=>/number/i.test(note)));
  assert.equal(Object.prototype.hasOwnProperty.call(profile,'score'),false);
});
