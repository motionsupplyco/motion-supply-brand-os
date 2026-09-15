import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../public/brand-engine.html',import.meta.url),'utf8');
const handoff=await readFile(new URL('../public/brand-engine-handoff.js',import.meta.url),'utf8');
const sitemap=await readFile(new URL('../public/sitemap.xml',import.meta.url),'utf8');
const robots=await readFile(new URL('../public/robots.txt',import.meta.url),'utf8');
const planningRoutes=await readFile(new URL('../lib/v2-planning-routes.js',import.meta.url),'utf8');

test('Brand Engine has canonical and social metadata for the public acquisition URL',()=>{
  assert.match(html,/rel="canonical" href="https:\/\/www\.motionsupplyos\.com\/brand-engine"/);
  assert.match(html,/property="og:title"/);
  assert.match(html,/property="og:description"/);
  assert.match(html,/property="og:url" content="https:\/\/www\.motionsupplyos\.com\/brand-engine"/);
  assert.match(html,/Free Clothing Brand Name Generator/);
});

test('sitemap and robots expose the canonical Brand Engine route',()=>{
  assert.match(sitemap,/<loc>https:\/\/www\.motionsupplyos\.com\/brand-engine<\/loc>/);
  assert.match(robots,/Sitemap: https:\/\/www\.motionsupplyos\.com\/sitemap\.xml/);
});

test('Brand OS sidebar utility area exposes the free Brand Engine',()=>{
  assert.match(handoff,/id='brandEngineNavLink'/);
  assert.match(handoff,/link\.href='\/brand-engine'/);
  assert.match(handoff,/Brand Engine · Free name tool/);
});

test('Brand Engine public routes are mounted without modifying server route order',()=>{
  assert.match(planningRoutes,/registerBrandEngineRoutes\(app\)/);
  assert.match(planningRoutes,/import \{registerBrandEngineRoutes\} from '\.\/brand-engine-routes\.js'/);
});
