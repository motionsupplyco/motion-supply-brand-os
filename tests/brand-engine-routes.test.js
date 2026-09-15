import test from 'node:test';
import assert from 'node:assert/strict';
import {brandEngineProviderConfig,normalizeDomainCheckRequest} from '../lib/brand-engine-routes.js';

test('Brand Engine provider config tells the truth about unsupported automated trademark/social checks',()=>{
  const config=brandEngineProviderConfig({SUPABASE_URL:'x',SUPABASE_SECRET_KEY:'y'});
  assert.equal(config.domains.enabled,true);
  assert.match(config.domains.source,/RDAP/);
  assert.equal(config.trademarks.enabled,false);
  assert.match(config.trademarks.reason,/will not scrape/i);
  assert.equal(config.social.mode,'verification_links_only');
  assert.equal(config.initializeBrand.enabled,true);
});

test('provider config stays honest when account storage is unavailable',()=>{
  const config=brandEngineProviderConfig({});
  assert.equal(config.initializeBrand.enabled,false);
  assert.equal(config.trademarks.mode,'official_provider_required');
});

test('domain request normalizes and deduplicates founder input',()=>{
  assert.deepEqual(normalizeDomainCheckRequest({domains:['VoidDept.COM','https://voiddept.com/path','voiddept.co']}),['voiddept.com','voiddept.co']);
});

test('domain request is intentionally capped at three raw selections',()=>{
  assert.throws(()=>normalizeDomainCheckRequest({domains:['a.com','b.com','c.com','d.com']}),error=>error.code==='DOMAIN_LIMIT');
  assert.throws(()=>normalizeDomainCheckRequest({domains:[]}),error=>error.code==='DOMAINS_REQUIRED');
});
