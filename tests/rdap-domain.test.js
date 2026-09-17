import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDomain,rdapBaseForDomain,lookupDomainRdap,checkDomainsRdap,RDAP_BOOTSTRAP_URL} from '../lib/rdap-domain.js';

const bootstrap={services:[[['com'],['https://rdap.example/']], [['co'],['https://rdap.co.example']]]};

const headers=location=>({get:name=>String(name||'').toLowerCase()==='location'?location:null});

test('domain normalization accepts domains and URLs but rejects malformed labels',()=>{
  assert.equal(normalizeDomain('HTTPS://Example.COM/path'),'example.com');
  assert.equal(normalizeDomain('bücher.com'),'xn--bcher-kva.com');
  assert.throws(()=>normalizeDomain('localhost'),/valid domain/i);
  assert.throws(()=>normalizeDomain('-bad.com'),/valid domain/i);
  assert.throws(()=>normalizeDomain('bad..com'),/valid domain/i);
});

test('RDAP bootstrap chooses the authoritative service for the TLD',()=>{
  assert.equal(rdapBaseForDomain('example.com',bootstrap),'https://rdap.example/');
  assert.equal(rdapBaseForDomain('example.co',bootstrap),'https://rdap.co.example/');
  assert.equal(rdapBaseForDomain('example.xyz',bootstrap),null);
});

test('authoritative 404 is represented as not found, not a guaranteed purchase claim',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options});return {ok:false,status:404,json:async()=>({})}};
  const result=await lookupDomainRdap('voiddept.com',{bootstrap,fetchImpl});
  assert.equal(result.status,'not_found');
  assert.equal(result.registered,false);
  assert.match(result.reason,/verify with a registrar/i);
  assert.equal(calls[0].url,'https://rdap.example/domain/voiddept.com');
  assert.equal(calls[0].options.redirect,'manual');
});

test('200 RDAP response means a registration record exists',async()=>{
  const fetchImpl=async()=>({ok:true,status:200,json:async()=>({handle:'D123',status:['active']})});
  const result=await lookupDomainRdap('voiddept.com',{bootstrap,fetchImpl});
  assert.equal(result.status,'registered');
  assert.equal(result.registered,true);
  assert.equal(result.handle,'D123');
  assert.deepEqual(result.statuses,['active']);
});

test('same-origin HTTPS RDAP redirects can be followed within the authoritative service',async()=>{
  const calls=[];
  const fetchImpl=async url=>{
    calls.push(String(url));
    if(calls.length===1)return {ok:false,status:302,headers:headers('/domain/voiddept.com?followed=1'),json:async()=>({})};
    return {ok:false,status:404,json:async()=>({})};
  };
  const result=await lookupDomainRdap('voiddept.com',{bootstrap,fetchImpl});
  assert.equal(result.status,'not_found');
  assert.deepEqual(calls,['https://rdap.example/domain/voiddept.com','https://rdap.example/domain/voiddept.com?followed=1']);
});

test('cross-origin or protocol-changing RDAP redirects are blocked instead of followed',async()=>{
  for(const location of ['https://169.254.169.254/latest/meta-data/','http://rdap.example/domain/voiddept.com']){
    const calls=[];
    const fetchImpl=async url=>{calls.push(String(url));return {ok:false,status:302,headers:headers(location),json:async()=>({})}};
    const result=await lookupDomainRdap('voiddept.com',{bootstrap,fetchImpl});
    assert.equal(result.status,'unknown');
    assert.equal(result.registered,null);
    assert.match(result.reason,/redirect was blocked/i);
    assert.equal(calls.length,1,'unsafe redirect must never be fetched');
  }
});

test('unsupported TLD stays unknown instead of being labeled available',async()=>{
  const result=await lookupDomainRdap('voiddept.xyz',{bootstrap,fetchImpl:async()=>{throw new Error('should not fetch')}});
  assert.equal(result.status,'unknown');
  assert.equal(result.registered,null);
});

test('bootstrap is fetched from IANA when not supplied',async()=>{
  const calls=[];
  const fetchImpl=async url=>{
    calls.push(String(url));
    if(String(url)===RDAP_BOOTSTRAP_URL)return {ok:true,status:200,json:async()=>bootstrap};
    return {ok:false,status:404,json:async()=>({})};
  };
  const result=await lookupDomainRdap('voiddept.com',{fetchImpl});
  assert.equal(result.status,'not_found');
  assert.deepEqual(calls,[RDAP_BOOTSTRAP_URL,'https://rdap.example/domain/voiddept.com']);
});

test('provider errors stay unknown instead of producing false availability',async()=>{
  const fetchImpl=async()=>({ok:false,status:429,json:async()=>({})});
  const result=await lookupDomainRdap('voiddept.com',{bootstrap,fetchImpl});
  assert.equal(result.status,'unknown');
  assert.equal(result.registered,null);
  assert.match(result.reason,/429/);
});

test('batch domain check fetches IANA bootstrap once and caps request size',async()=>{
  const calls=[];
  const fetchImpl=async url=>{
    calls.push(String(url));
    if(String(url)===RDAP_BOOTSTRAP_URL)return {ok:true,status:200,json:async()=>bootstrap};
    if(String(url).includes('rdap.example'))return {ok:false,status:404,json:async()=>({})};
    return {ok:true,status:200,json:async()=>({handle:'CO-1',status:['active']})};
  };
  const results=await checkDomainsRdap(['voiddept.com','voiddept.co'],{fetchImpl});
  assert.equal(results.length,2);
  assert.equal(calls.filter(url=>url===RDAP_BOOTSTRAP_URL).length,1);
  assert.equal(results[0].status,'not_found');
  assert.equal(results[1].status,'registered');
  await assert.rejects(checkDomainsRdap(['a.com','b.com','c.com','d.com'],{fetchImpl}),/up to 3 domains/i);
});

test('bootstrap failure makes every requested domain unknown rather than available',async()=>{
  const fetchImpl=async()=>({ok:false,status:503,json:async()=>({})});
  const results=await checkDomainsRdap(['voiddept.com','voiddept.co'],{fetchImpl});
  assert.equal(results.length,2);
  assert.ok(results.every(result=>result.status==='unknown'&&result.registered===null));
});
