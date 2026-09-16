import test from 'node:test';
import assert from 'node:assert/strict';
import {brandEngineProviderConfig,normalizeDomainCheckRequest,brandEngineEventPayload} from '../lib/brand-engine-routes.js';

test('Brand Engine provider config distinguishes manual official trademark screening from unsupported automation',()=>{
  const config=brandEngineProviderConfig({SUPABASE_URL:'x',SUPABASE_SECRET_KEY:'y'});
  assert.equal(config.domains.enabled,true);
  assert.match(config.domains.source,/RDAP/);
  assert.equal(config.trademarks.enabled,true);
  assert.equal(config.trademarks.mode,'official_manual_prescreen');
  assert.equal(config.trademarks.automatedScreening,false);
  assert.equal(config.trademarks.searchUrl,'https://tmsearch.uspto.gov/');
  assert.match(config.trademarks.reason,/does not scrape/i);
  assert.match(config.trademarks.reason,/trademark-clear/i);
  assert.equal(config.social.mode,'verification_links_only');
  assert.equal(config.initializeBrand.enabled,true);
});

test('provider config stays honest when account storage is unavailable',()=>{
  const config=brandEngineProviderConfig({});
  assert.equal(config.initializeBrand.enabled,false);
  assert.equal(config.trademarks.enabled,true);
  assert.equal(config.trademarks.automatedScreening,false);
});

test('domain request normalizes and deduplicates founder input',()=>{
  assert.deepEqual(normalizeDomainCheckRequest({domains:['VoidDept.COM','https://voiddept.com/path','voiddept.co']}),['voiddept.com','voiddept.co']);
});

test('domain request is intentionally capped at three raw selections',()=>{
  assert.throws(()=>normalizeDomainCheckRequest({domains:['a.com','b.com','c.com','d.com']}),error=>error.code==='DOMAIN_LIMIT');
  assert.throws(()=>normalizeDomainCheckRequest({domains:[]}),error=>error.code==='DOMAINS_REQUIRED');
});

test('Brand Engine analytics accepts only funnel-safe fields and strips names/domains/seeds',()=>{
  const event=brandEngineEventPayload({
    event_name:'brand_engine_domain_checked',anonymous_id:'anon-123',
    properties:{vibe:'street',domain_count:3,registered_count:1,not_found_count:1,unknown_count:1,signed_in:false,entrypoint:'sidebar',seed_words:'secret seed',brand_name:'Ghost Dept',domains:['ghostdept.com']}
  });
  assert.equal(event.eventName,'brand_engine_domain_checked');
  assert.equal(event.anonymousId,'anon-123');
  assert.deepEqual(event.properties,{vibe:'street',domain_count:3,registered_count:1,not_found_count:1,unknown_count:1,signed_in:false,entrypoint:'sidebar'});
  assert.equal('brand_name' in event.properties,false);
  assert.equal('seed_words' in event.properties,false);
  assert.equal('domains' in event.properties,false);
});

test('Brand Engine analytics clamps counts and rejects unknown event names',()=>{
  const event=brandEngineEventPayload({event_name:'brand_engine_names_generated',anonymous_id:'x'.repeat(200),properties:{count:999,domain_count:999,vibe:'not-real',entrypoint:'x'.repeat(100)}});
  assert.equal(event.anonymousId.length,80);
  assert.equal(event.properties.count,30);
  assert.equal(event.properties.domain_count,3);
  assert.equal('vibe' in event.properties,false);
  assert.equal(event.properties.entrypoint.length,40);
  assert.throws(()=>brandEngineEventPayload({event_name:'brand_engine_seed_words_collected'}),error=>error.code==='EVENT_INVALID');
});
