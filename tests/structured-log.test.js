import { EventEmitter } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';
import { safeRequestRoute, structuredRequestLogger, structuredRequestRecord } from '../lib/structured-log.js';

function fakeResponse(statusCode=200,requestId='req-test'){
  const res=new EventEmitter();
  res.statusCode=statusCode;
  res.locals={requestId};
  res.getHeader=name=>String(name).toLowerCase()==='x-request-id'?requestId:undefined;
  return res;
}

test('structured request record contains only bounded operational fields',()=>{
  const req={
    method:'post',
    path:'/api/brands/secret-value',
    baseUrl:'/api',
    route:{path:'/brands/:id'},
    headers:{authorization:'Bearer super-secret-token','x-forwarded-for':'203.0.113.10'},
    query:{email:'founder@example.com',token:'query-secret'},
    body:{email:'founder@example.com',password:'dont-log-me'}
  };
  const record=structuredRequestRecord({req,res:fakeResponse(201,'req-123'),requestId:'req-123',startedAt:1000,finishedAt:1037});
  assert.deepEqual(Object.keys(record),['timestamp','level','event','request_id','method','route','status','duration_ms']);
  assert.equal(record.route,'/api/brands/:id');
  assert.equal(record.request_id,'req-123');
  assert.equal(record.status,201);
  assert.equal(record.duration_ms,37);
  const line=JSON.stringify(record);
  for(const secret of ['super-secret-token','203.0.113.10','founder@example.com','query-secret','dont-log-me','secret-value'])assert.doesNotMatch(line,new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('unmatched API routes are normalized instead of logging path values',()=>{
  const req={method:'GET',path:'/api/private/customer-123?token=secret'};
  assert.equal(safeRequestRoute(req),'/api/:unmatched');
});

test('logger emits one JSON line on API completion at status-appropriate level',()=>{
  let now=1000;
  const calls=[];
  const logger={log:line=>calls.push(['log',line]),warn:line=>calls.push(['warn',line]),error:line=>calls.push(['error',line])};
  const middleware=structuredRequestLogger({logger,clock:()=>now});
  const req={method:'GET',path:'/api/account',baseUrl:'',route:{path:'/api/account'}};
  const res=fakeResponse(401,'req-401');
  let nextCalled=false;
  middleware(req,res,()=>{nextCalled=true});
  now=1025;
  res.emit('finish');
  assert.equal(nextCalled,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],'warn');
  assert.deepEqual(JSON.parse(calls[0][1]),{
    timestamp:new Date(1025).toISOString(),
    level:'warn',
    event:'http_request',
    request_id:'req-401',
    method:'GET',
    route:'/api/account',
    status:401,
    duration_ms:25
  });
});

test('logger ignores non-API completions',()=>{
  const calls=[];
  const logger={log:line=>calls.push(line),warn:line=>calls.push(line),error:line=>calls.push(line)};
  const req={method:'GET',path:'/privacy.html',route:{path:'*'}};
  const res=fakeResponse(200,'req-static');
  structuredRequestLogger({logger,clock:()=>1000})(req,res,()=>{});
  res.emit('finish');
  assert.equal(calls.length,0);
});
