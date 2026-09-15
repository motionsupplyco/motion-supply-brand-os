import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {SHOPIFY_WEBHOOK_TOPICS,SHOPIFY_WEBHOOK_LIST_QUERY,SHOPIFY_WEBHOOK_CREATE_MUTATION,SHOPIFY_WEBHOOK_CLAIM_STALE_MS,verifyShopifyWebhookHmac,classifyShopifyWebhookDuplicate,claimShopifyWebhookEvent,ensureShopifyWebhooks} from '../lib/shopify-webhooks.js';

function fakeWebhookAdmin(initial=null,{loseReclaim=false}={}){
  let state=initial?{provider:'shopify',event_id:'evt_1',event_type:'ORDERS_CREATE',...initial}:null;
  return {
    state:()=>state,
    from(table){
      assert.equal(table,'integration_webhook_events');
      const filters={};let patch=null;
      const builder={
        async insert(row){
          if(!state){state={...row};return {error:null}}
          return {error:{code:'23505',message:'duplicate'}};
        },
        select(){return builder},
        update(value){patch=value;return builder},
        eq(key,value){filters[key]=value;return builder},
        async maybeSingle(){
          if(!patch){
            if(!state)return {data:null,error:null};
            return {data:{status:state.status,attempts:state.attempts,claimed_at:state.claimed_at,payload_sha256:state.payload_sha256},error:null};
          }
          if(loseReclaim)return {data:null,error:null};
          const matches=state&&Object.entries(filters).every(([key,value])=>state[key]===value);
          if(!matches)return {data:null,error:null};
          state={...state,...patch};
          return {data:{attempts:state.attempts},error:null};
        }
      };
      return builder;
    }
  };
}

test('Shopify webhook verifier authenticates the raw body with base64 HMAC',()=>{
  const body=Buffer.from('{"id":123,"topic":"orders/create"}');
  const secret='shopify-client-secret';
  const hmac=crypto.createHmac('sha256',secret).update(body).digest('base64');
  assert.equal(verifyShopifyWebhookHmac(body,hmac,secret),true);
  assert.equal(verifyShopifyWebhookHmac(Buffer.from('{}'),hmac,secret),false);
  assert.equal(verifyShopifyWebhookHmac(body,'not-a-valid-signature',secret),false);
});

test('completed webhook IDs dedupe but failed claims can be retried',()=>{
  const hash='abc123';
  assert.deepEqual(classifyShopifyWebhookDuplicate({status:'completed',payload_sha256:hash,claimed_at:'2026-09-15T08:00:00.000Z'},{payloadHash:hash,nowMs:Date.parse('2026-09-15T08:01:00.000Z')}),{action:'duplicate',reason:'completed'});
  assert.deepEqual(classifyShopifyWebhookDuplicate({status:'failed',payload_sha256:hash,claimed_at:'2026-09-15T08:00:00.000Z'},{payloadHash:hash,nowMs:Date.parse('2026-09-15T08:01:00.000Z')}),{action:'reclaim',reason:'failed'});
});

test('active processing claims dedupe while stale claims can be reclaimed',()=>{
  const now=Date.parse('2026-09-15T08:20:00.000Z'),hash='same';
  assert.deepEqual(classifyShopifyWebhookDuplicate({status:'processing',payload_sha256:hash,claimed_at:'2026-09-15T08:19:00.000Z'},{payloadHash:hash,nowMs:now}),{action:'duplicate',reason:'processing'});
  assert.deepEqual(classifyShopifyWebhookDuplicate({status:'processing',payload_sha256:hash,claimed_at:new Date(now-SHOPIFY_WEBHOOK_CLAIM_STALE_MS-1).toISOString()},{payloadHash:hash,nowMs:now}),{action:'reclaim',reason:'stale_processing'});
});

test('same webhook ID with a different payload hash is rejected instead of silently deduped',()=>{
  assert.deepEqual(classifyShopifyWebhookDuplicate({status:'failed',payload_sha256:'original',claimed_at:'2026-09-15T08:00:00.000Z'},{payloadHash:'different'}),{action:'reject',reason:'payload_mismatch'});
});

test('new webhook claim stores a processing row with one attempt',async()=>{
  const admin=fakeWebhookAdmin();
  const result=await claimShopifyWebhookEvent({admin,eventId:'evt_1',eventType:'ORDERS_CREATE',payloadHash:'hash-1',now:new Date('2026-09-15T08:30:00.000Z')});
  assert.deepEqual(result,{claimed:true,reclaimed:false,attempts:1});
  assert.equal(admin.state().status,'processing');
  assert.equal(admin.state().attempts,1);
  assert.equal(admin.state().claimed_at,'2026-09-15T08:30:00.000Z');
});

test('failed webhook claim is atomically reclaimed and attempt count increments',async()=>{
  const admin=fakeWebhookAdmin({status:'failed',attempts:1,claimed_at:'2026-09-15T08:00:00.000Z',payload_sha256:'hash-1',processed_at:'2026-09-15T08:01:00.000Z',failure_reason:'temporary failure'});
  const result=await claimShopifyWebhookEvent({admin,eventId:'evt_1',eventType:'ORDERS_CREATE',payloadHash:'hash-1',now:new Date('2026-09-15T08:30:00.000Z')});
  assert.equal(result.claimed,true);
  assert.equal(result.reclaimed,true);
  assert.equal(result.attempts,2);
  assert.equal(admin.state().status,'processing');
  assert.equal(admin.state().attempts,2);
  assert.equal(admin.state().processed_at,null);
  assert.equal(admin.state().failure_reason,null);
});

test('completed webhook stays deduped and a lost reclaim race does not double-process',async()=>{
  const complete=fakeWebhookAdmin({status:'completed',attempts:1,claimed_at:'2026-09-15T08:00:00.000Z',payload_sha256:'hash-1'});
  const duplicate=await claimShopifyWebhookEvent({admin:complete,eventId:'evt_1',eventType:'ORDERS_CREATE',payloadHash:'hash-1',now:new Date('2026-09-15T08:30:00.000Z')});
  assert.equal(duplicate.claimed,false);
  assert.equal(duplicate.duplicate,true);
  assert.equal(duplicate.status,'completed');

  const raced=fakeWebhookAdmin({status:'failed',attempts:2,claimed_at:'2026-09-15T08:00:00.000Z',payload_sha256:'hash-1'},{loseReclaim:true});
  const lost=await claimShopifyWebhookEvent({admin:raced,eventId:'evt_1',eventType:'ORDERS_CREATE',payloadHash:'hash-1',now:new Date('2026-09-15T08:30:00.000Z')});
  assert.equal(lost.claimed,false);
  assert.equal(lost.duplicate,true);
  assert.equal(lost.reason,'claim_lost');
});

test('webhook registration only creates missing topic+URI pairs',async()=>{
  const calls=[];
  const uri='https://www.motionsupplyos.com/api/integrations/shopify/webhook';
  const graphql=async(query,variables)=>{
    calls.push({query,variables});
    if(query===SHOPIFY_WEBHOOK_LIST_QUERY)return {webhookSubscriptions:{nodes:[{id:'w1',topic:'APP_UNINSTALLED',uri}]}};
    if(query===SHOPIFY_WEBHOOK_CREATE_MUTATION)return {webhookSubscriptionCreate:{webhookSubscription:{id:`new-${variables.topic}`,topic:variables.topic,uri:variables.webhookSubscription.uri},userErrors:[]}};
    throw new Error('unexpected query');
  };
  const result=await ensureShopifyWebhooks({graphql,appUrl:'https://www.motionsupplyos.com'});
  assert.equal(result.uri,uri);
  assert.equal(result.created.length,SHOPIFY_WEBHOOK_TOPICS.length-1);
  assert.equal(calls.filter(call=>call.query===SHOPIFY_WEBHOOK_CREATE_MUTATION).some(call=>call.variables.topic==='APP_UNINSTALLED'),false);
  assert.ok(result.created.some(item=>item.topic==='ORDERS_CREATE'));
  assert.ok(result.created.some(item=>item.topic==='INVENTORY_LEVELS_UPDATE'));
});

test('webhook registration surfaces provider userErrors instead of claiming success',async()=>{
  const graphql=async(query,variables)=>{
    if(query===SHOPIFY_WEBHOOK_LIST_QUERY)return {webhookSubscriptions:{nodes:[]}};
    return {webhookSubscriptionCreate:{webhookSubscription:null,userErrors:variables.topic==='ORDERS_CREATE'?[{field:['topic'],message:'denied'}]:[]}};
  };
  const result=await ensureShopifyWebhooks({graphql,appUrl:'https://www.motionsupplyos.com',topics:['ORDERS_CREATE']});
  assert.equal(result.created.length,0);
  assert.equal(result.errors.length,1);
  assert.equal(result.errors[0].topic,'ORDERS_CREATE');
});
