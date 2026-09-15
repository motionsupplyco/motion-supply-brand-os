import crypto from 'node:crypto';
import express from 'express';
import {providerConfiguration,normalizeShopifyDomain,buildShopifyAuthorization,verifyShopifyOAuthHmac,verifyIntegrationState,exchangeShopifyAuthorizationCode,refreshShopifyOfflineToken,shopifyGraphql} from './integration-providers.js';
import {encryptIntegrationSecret,decryptIntegrationSecret,integrationEncryptionConfigured} from './integration-crypto.js';
import {collectShopifyOperatingSnapshot} from './shopify-sync.js';
import {verifyShopifyWebhookHmac,ensureShopifyWebhooks} from './shopify-webhooks.js';
import {cashForecast,normalizeCashWeek,reorderIntelligence,reorderCashGate,buildOperatingAlerts} from '../public/operating-intelligence.js';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=value=>String(value||'').trim();
const nowIso=()=>new Date().toISOString();
const isStorageMissing=error=>['42P01','PGRST205'].includes(String(error?.code||''));
const safeError=error=>String(error?.message||error||'').slice(0,500);

function storageError(res,error){
  if(isStorageMissing(error))return res.status(503).json({error:'V2 cloud storage is not enabled yet.',code:'V2_STORAGE_NOT_READY'});
  console.error('v2-storage',error);
  return res.status(500).json({error:'V2 data could not be loaded.',code:'V2_STORAGE_ERROR'});
}

async function ownerBrand(admin,ownerId,brandId){
  if(!UUID_RE.test(clean(brandId)))return null;
  const {data,error}=await admin.from('brands').select('id,name,currency').eq('id',brandId).eq('owner_id',ownerId).maybeSingle();
  if(error)throw error;
  return data||null;
}

function publicConnection(row){
  return row?{
    id:row.id,brandId:row.brand_id,provider:row.provider,externalAccountId:row.external_account_id,
    externalAccountName:row.external_account_name,status:row.status,scopes:row.scopes||[],
    accessTokenExpiresAt:row.access_token_expires_at,refreshTokenExpiresAt:row.refresh_token_expires_at,
    metadata:row.metadata||{},lastSyncedAt:row.last_synced_at,createdAt:row.created_at,updatedAt:row.updated_at
  }:null;
}

async function loadShopifyConnection(admin,ownerId,brandId){
  const {data,error}=await admin.from('integration_connections').select('*').eq('owner_id',ownerId).eq('brand_id',brandId).eq('provider','shopify').maybeSingle();
  if(error)throw error;
  return data||null;
}

async function usableShopifyAccessToken(admin,connection,env=process.env){
  if(!connection)throw Object.assign(new Error('Connect Shopify first.'),{code:'SHOPIFY_NOT_CONNECTED'});
  if(!integrationEncryptionConfigured(env))throw Object.assign(new Error('Integration encryption is not configured.'),{code:'INTEGRATION_ENCRYPTION_MISSING'});
  const shop=normalizeShopifyDomain(connection.external_account_id||connection.metadata?.shop_domain);
  let accessToken=decryptIntegrationSecret(connection.access_token_ciphertext,env.INTEGRATION_TOKEN_ENCRYPTION_KEY);
  const expiresAt=connection.access_token_expires_at?Date.parse(connection.access_token_expires_at):0;
  if(accessToken&&expiresAt-Date.now()>5*60_000)return {accessToken,shop,connection};
  const refreshToken=decryptIntegrationSecret(connection.refresh_token_ciphertext,env.INTEGRATION_TOKEN_ENCRYPTION_KEY);
  if(!refreshToken)throw Object.assign(new Error('Shopify authorization needs to be renewed.'),{code:'SHOPIFY_REAUTH_REQUIRED'});
  try{
    const tokens=await refreshShopifyOfflineToken({shop,refreshToken,env});
    const patch={
      access_token_ciphertext:encryptIntegrationSecret(tokens.accessToken,env.INTEGRATION_TOKEN_ENCRYPTION_KEY),
      refresh_token_ciphertext:encryptIntegrationSecret(tokens.refreshToken,env.INTEGRATION_TOKEN_ENCRYPTION_KEY),
      access_token_expires_at:tokens.accessTokenExpiresAt,
      refresh_token_expires_at:tokens.refreshTokenExpiresAt,
      scopes:tokens.scope,status:'connected',updated_at:nowIso()
    };
    const {data,error}=await admin.from('integration_connections').update(patch).eq('id',connection.id).eq('owner_id',connection.owner_id).select('*').single();
    if(error)throw error;
    return {accessToken:tokens.accessToken,shop,connection:data};
  }catch(error){
    if(Number(error?.status)===401)await admin.from('integration_connections').update({status:'needs_attention',updated_at:nowIso()}).eq('id',connection.id).eq('owner_id',connection.owner_id);
    throw error;
  }
}

function callbackRedirect(appUrl,status,code=''){
  const url=new URL(appUrl);
  url.searchParams.set('integration',status);
  if(code)url.searchParams.set('code',code);
  return url.toString();
}

export function registerV2PreJsonRoutes(app,{admin,appUrl,env=process.env}={}){
  app.post('/api/integrations/shopify/webhook',express.raw({type:'application/json',limit:'512kb'}),async(req,res)=>{
    if(!admin||!env.SHOPIFY_CLIENT_SECRET)return res.status(503).send('Integration service is not configured.');
    const raw=Buffer.isBuffer(req.body)?req.body:Buffer.from(req.body||'');
    if(!verifyShopifyWebhookHmac(raw,req.headers['x-shopify-hmac-sha256'],env.SHOPIFY_CLIENT_SECRET))return res.status(401).send('Invalid webhook signature.');
    const topic=clean(req.headers['x-shopify-topic']).toUpperCase().replace(/\//g,'_');
    let shop;try{shop=normalizeShopifyDomain(req.headers['x-shopify-shop-domain'])}catch{return res.status(400).send('Invalid shop.');}
    const eventId=clean(req.headers['x-shopify-webhook-id'])||crypto.createHash('sha256').update(shop).update('|').update(topic).update('|').update(raw).digest('hex');
    const payloadHash=crypto.createHash('sha256').update(raw).digest('hex');
    const {error:claimError}=await admin.from('integration_webhook_events').insert({provider:'shopify',event_id:eventId,event_type:topic,payload_sha256:payloadHash,status:'processing'});
    if(claimError){
      if(String(claimError.code)==='23505')return res.json({received:true,duplicate:true});
      if(isStorageMissing(claimError))return res.status(503).send('V2 storage is not ready.');
      console.error('shopify-webhook-claim',claimError);return res.status(500).send('Webhook could not be claimed.');
    }
    try{
      const {data:connections,error}=await admin.from('integration_connections').select('id,owner_id,metadata').eq('provider','shopify').eq('external_account_id',shop).limit(20);
      if(error)throw error;
      for(const connection of connections||[]){
        const metadata={...(connection.metadata||{}),last_webhook_topic:topic,last_webhook_at:nowIso()};
        if(topic==='APP_UNINSTALLED'){
          metadata.webhook_dirty=false;metadata.disconnected_reason='app_uninstalled';
          const {error:updateError}=await admin.from('integration_connections').update({status:'disconnected',access_token_ciphertext:null,refresh_token_ciphertext:null,access_token_expires_at:null,refresh_token_expires_at:null,metadata,updated_at:nowIso()}).eq('id',connection.id).eq('owner_id',connection.owner_id);
          if(updateError)throw updateError;
        }else{
          metadata.webhook_dirty=true;
          const {error:updateError}=await admin.from('integration_connections').update({metadata,updated_at:nowIso()}).eq('id',connection.id).eq('owner_id',connection.owner_id);
          if(updateError)throw updateError;
        }
      }
      await admin.from('integration_webhook_events').update({status:'completed',processed_at:nowIso(),failure_reason:null}).eq('provider','shopify').eq('event_id',eventId);
      return res.json({received:true});
    }catch(error){
      console.error('shopify-webhook',error);
      await admin.from('integration_webhook_events').update({status:'failed',processed_at:nowIso(),failure_reason:safeError(error)}).eq('provider','shopify').eq('event_id',eventId);
      return res.status(500).send('Webhook processing failed.');
    }
  });
}

export function registerV2Routes(app,{admin,appUrl,requireProUser,env=process.env}={}){
  app.get('/api/v2/integrations/config',(_req,res)=>{
    const providers=providerConfiguration(env);
    res.json({providers:{
      shopify:{configured:providers.shopify.configured,scopes:providers.shopify.scopes,apiVersion:providers.shopify.apiVersion},
      meta:{configured:providers.meta.configured,mode:providers.meta.mode},
      tiktok:{configured:providers.tiktok.configured,mode:providers.tiktok.mode},
      klaviyo:{configured:providers.klaviyo.configured,mode:providers.klaviyo.mode}
    }});
  });

  app.get('/api/v2/integrations',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    const {data,error}=await admin.from('integration_connections').select('id,brand_id,provider,external_account_id,external_account_name,status,scopes,access_token_expires_at,refresh_token_expires_at,metadata,last_synced_at,created_at,updated_at').eq('owner_id',gate.user.id).order('created_at');
    if(error)return storageError(res,error);
    res.json({connections:(data||[]).map(publicConnection)});
  });

  app.post('/api/v2/integrations/shopify/connect',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    try{
      const brand=await ownerBrand(admin,gate.user.id,clean(req.body?.brand_id));
      if(!brand)return res.status(404).json({error:'Choose one of your saved brands first.',code:'BRAND_REQUIRED'});
      const auth=buildShopifyAuthorization({shop:req.body?.shop,ownerId:gate.user.id,brandId:brand.id,appUrl,env});
      res.json({url:auth.url,shop:auth.shop,scopes:auth.scopes});
    }catch(error){
      const code=/not configured/i.test(safeError(error))?'SHOPIFY_NOT_CONFIGURED':'SHOPIFY_CONNECT_INVALID';
      res.status(code==='SHOPIFY_NOT_CONFIGURED'?503:400).json({error:safeError(error),code});
    }
  });

  app.get('/api/integrations/shopify/callback',async(req,res)=>{
    const rawQuery=(req.originalUrl.split('?')[1]||'');
    try{
      if(!providerConfiguration(env).shopify.configured)throw Object.assign(new Error('Shopify integration is not configured.'),{code:'SHOPIFY_NOT_CONFIGURED'});
      if(!verifyShopifyOAuthHmac(rawQuery,env.SHOPIFY_CLIENT_SECRET))throw Object.assign(new Error('Shopify callback signature was invalid.'),{code:'SHOPIFY_HMAC_INVALID'});
      const state=verifyIntegrationState(req.query.state,env.INTEGRATION_OAUTH_STATE_SECRET);
      if(state.provider!=='shopify')throw Object.assign(new Error('OAuth provider mismatch.'),{code:'SHOPIFY_STATE_INVALID'});
      const shop=normalizeShopifyDomain(req.query.shop);
      if(shop!==state.shop)throw Object.assign(new Error('Shopify store mismatch.'),{code:'SHOPIFY_STATE_INVALID'});
      const brand=await ownerBrand(admin,state.ownerId,state.brandId);
      if(!brand)throw Object.assign(new Error('Brand no longer exists.'),{code:'BRAND_NOT_FOUND'});
      const {data:userData,error:userError}=await admin.auth.admin.getUserById(state.ownerId);
      if(userError||!userData?.user)throw Object.assign(new Error('Account no longer exists.'),{code:'ACCOUNT_NOT_FOUND'});
      const tokens=await exchangeShopifyAuthorizationCode({shop,code:req.query.code,env});
      const graphql=(query,variables)=>shopifyGraphql({shop,accessToken:tokens.accessToken,query,variables,env});
      const shopData=await graphql('query BrandOSConnectedShop { shop { id name currencyCode ianaTimezone } }',{});
      const webhooks=await ensureShopifyWebhooks({graphql,appUrl});
      const connectedShop=shopData?.shop;
      if(!connectedShop?.id)throw new Error('Shopify store metadata could not be loaded.');
      const metadata={shop_domain:shop,shop_gid:connectedShop.id,currency_code:connectedShop.currencyCode,iana_timezone:connectedShop.ianaTimezone,webhook_dirty:true,webhook_registration_errors:webhooks.errors.slice(0,10)};
      const payload={
        owner_id:state.ownerId,brand_id:state.brandId,provider:'shopify',external_account_id:shop,external_account_name:connectedShop.name||shop,
        status:webhooks.errors.length?'needs_attention':'connected',scopes:tokens.scope,
        access_token_ciphertext:encryptIntegrationSecret(tokens.accessToken,env.INTEGRATION_TOKEN_ENCRYPTION_KEY),
        refresh_token_ciphertext:encryptIntegrationSecret(tokens.refreshToken,env.INTEGRATION_TOKEN_ENCRYPTION_KEY),
        access_token_expires_at:tokens.accessTokenExpiresAt,refresh_token_expires_at:tokens.refreshTokenExpiresAt,
        metadata,updated_at:nowIso()
      };
      const {error}=await admin.from('integration_connections').upsert(payload,{onConflict:'owner_id,brand_id,provider'});
      if(error)throw error;
      return res.redirect(302,callbackRedirect(appUrl,'shopify_connected'));
    }catch(error){
      console.error('shopify-oauth-callback',{code:error?.code||null,message:safeError(error)});
      return res.redirect(302,callbackRedirect(appUrl,'shopify_error',error?.code||'SHOPIFY_CONNECT_FAILED'));
    }
  });

  app.post('/api/v2/integrations/shopify/sync',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    const brandId=clean(req.body?.brand_id);
    let runId=null;
    try{
      const brand=await ownerBrand(admin,gate.user.id,brandId);
      if(!brand)return res.status(404).json({error:'Brand not found.',code:'BRAND_NOT_FOUND'});
      const connection=await loadShopifyConnection(admin,gate.user.id,brand.id);
      if(!connection)return res.status(409).json({error:'Connect Shopify to this brand first.',code:'SHOPIFY_NOT_CONNECTED'});
      const {data:run,error:runError}=await admin.from('integration_sync_runs').insert({owner_id:gate.user.id,brand_id:brand.id,provider:'shopify',status:'running'}).select('id').single();
      if(runError)return storageError(res,runError);
      runId=run.id;
      const token=await usableShopifyAccessToken(admin,connection,env);
      const graphql=(query,variables)=>shopifyGraphql({shop:token.shop,accessToken:token.accessToken,query,variables,env});
      const snapshot=await collectShopifyOperatingSnapshot({graphql,lookbackDays:60,maxOrderPages:5,maxVariantPages:5,pageSize:100});
      const dailyRows=snapshot.dailySnapshots.map(row=>({owner_id:gate.user.id,brand_id:brand.id,source:'shopify',...row,captured_at:nowIso()}));
      if(dailyRows.length){
        const {error}=await admin.from('commerce_daily_snapshots').upsert(dailyRows,{onConflict:'owner_id,brand_id,source,snapshot_date'});
        if(error)throw error;
      }
      const inventoryRows=snapshot.inventorySnapshots.map(row=>({owner_id:gate.user.id,brand_id:brand.id,...row,captured_at:nowIso()}));
      if(inventoryRows.length){const {error}=await admin.from('inventory_snapshots').insert(inventoryRows);if(error)throw error;}
      const syncStatus=snapshot.partial?'partial':'completed';
      const cursor=snapshot.partial?JSON.stringify(snapshot.cursors):null;
      const metadata={shop:snapshot.shop,lookbackDays:snapshot.lookbackDays,stats:snapshot.stats};
      const recordsWritten=dailyRows.length+inventoryRows.length;
      const {error:finishError}=await admin.from('integration_sync_runs').update({status:syncStatus,finished_at:nowIso(),records_read:snapshot.stats.orderNodesRead+snapshot.stats.variantNodesRead,records_written:recordsWritten,cursor,metadata}).eq('id',runId).eq('owner_id',gate.user.id);
      if(finishError)throw finishError;
      const connectionMeta={...(token.connection.metadata||{}),shop_domain:token.shop,webhook_dirty:false,last_sync_partial:snapshot.partial,last_sync_stats:snapshot.stats};
      await admin.from('integration_connections').update({status:snapshot.partial?'needs_attention':'connected',last_synced_at:nowIso(),metadata:connectionMeta,updated_at:nowIso()}).eq('id',token.connection.id).eq('owner_id',gate.user.id);
      return res.json({ok:true,partial:snapshot.partial,shop:snapshot.shop,stats:snapshot.stats,recordsWritten,cursors:snapshot.cursors});
    }catch(error){
      console.error('shopify-sync',{message:safeError(error),code:error?.code||null});
      if(runId)await admin.from('integration_sync_runs').update({status:'failed',finished_at:nowIso(),error_code:clean(error?.code||error?.status||'SYNC_FAILED').slice(0,80),error_message:safeError(error)}).eq('id',runId).eq('owner_id',gate.user.id);
      if(isStorageMissing(error))return storageError(res,error);
      const status=['SHOPIFY_NOT_CONNECTED','SHOPIFY_REAUTH_REQUIRED'].includes(error?.code)?409:502;
      return res.status(status).json({error:safeError(error)||'Shopify sync failed.',code:error?.code||'SHOPIFY_SYNC_FAILED'});
    }
  });

  app.delete('/api/v2/integrations/:provider/:brandId',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    const provider=clean(req.params.provider).toLowerCase(),brandId=clean(req.params.brandId);
    if(!['shopify','meta','tiktok','klaviyo'].includes(provider)||!UUID_RE.test(brandId))return res.status(400).json({error:'Invalid integration.'});
    const {data,error}=await admin.from('integration_connections').delete().eq('owner_id',gate.user.id).eq('brand_id',brandId).eq('provider',provider).select('id').maybeSingle();
    if(error)return storageError(res,error);
    if(!data)return res.status(404).json({error:'Integration not found.'});
    res.json({ok:true});
  });

  app.get('/api/v2/operating-data',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    const brandId=clean(req.query.brand_id);
    try{
      const brand=await ownerBrand(admin,gate.user.id,brandId);
      if(!brand)return res.status(404).json({error:'Brand not found.'});
      const [dailyResult,inventoryResult,forecastResult,alertsResult]=await Promise.all([
        admin.from('commerce_daily_snapshots').select('*').eq('owner_id',gate.user.id).eq('brand_id',brand.id).order('snapshot_date',{ascending:false}).limit(90),
        admin.from('inventory_snapshots').select('*').eq('owner_id',gate.user.id).eq('brand_id',brand.id).order('captured_at',{ascending:false}).limit(1000),
        admin.from('cash_forecasts').select('*').eq('owner_id',gate.user.id).eq('brand_id',brand.id).order('updated_at',{ascending:false}).limit(1).maybeSingle(),
        admin.from('operating_alerts').select('*').eq('owner_id',gate.user.id).eq('brand_id',brand.id).in('status',['open','acknowledged']).order('last_seen_at',{ascending:false}).limit(100)
      ]);
      for(const result of [dailyResult,inventoryResult,forecastResult,alertsResult])if(result.error)throw result.error;
      const latestInventory=[];const seen=new Set();
      for(const row of inventoryResult.data||[]){const key=`${row.source}|${row.external_variant_id||row.sku_code||row.id}`;if(seen.has(key))continue;seen.add(key);latestInventory.push(row);}
      res.json({brand,daily:dailyResult.data||[],inventory:latestInventory,forecast:forecastResult.data||null,alerts:alertsResult.data||[]});
    }catch(error){return storageError(res,error)}
  });

  app.get('/api/v2/cash-forecasts',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    let query=admin.from('cash_forecasts').select('*').eq('owner_id',gate.user.id).order('updated_at',{ascending:false}).limit(20);
    if(req.query.brand_id)query=query.eq('brand_id',clean(req.query.brand_id));
    const {data,error}=await query;if(error)return storageError(res,error);res.json({forecasts:data||[]});
  });

  app.post('/api/v2/cash-forecasts',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    try{
      const brandId=req.body?.brand_id?clean(req.body.brand_id):null;
      if(brandId&&!await ownerBrand(admin,gate.user.id,brandId))return res.status(404).json({error:'Brand not found.'});
      const startingCash=Number(req.body?.starting_cash)||0,protectedFloor=Math.max(0,Number(req.body?.protected_floor)||0);
      const weeks=Array.from({length:13},(_,index)=>normalizeCashWeek(req.body?.weeks?.[index]||{}));
      const analysis=cashForecast({startingCash,protectedFloor,weeks});
      const payload={owner_id:gate.user.id,brand_id:brandId,name:clean(req.body?.name).slice(0,160)||'13-week forecast',starting_cash:startingCash,protected_floor:protectedFloor,weeks,source_mix:{manual:true},updated_at:nowIso()};
      const {data,error}=await admin.from('cash_forecasts').insert(payload).select('*').single();
      if(error)return storageError(res,error);
      res.json({forecast:data,analysis});
    }catch(error){return res.status(400).json({error:safeError(error)||'Forecast could not be saved.'})}
  });

  app.put('/api/v2/cash-forecasts/:id',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    const id=clean(req.params.id);if(!UUID_RE.test(id))return res.status(400).json({error:'Invalid forecast.'});
    const startingCash=Number(req.body?.starting_cash)||0,protectedFloor=Math.max(0,Number(req.body?.protected_floor)||0);
    const weeks=Array.from({length:13},(_,index)=>normalizeCashWeek(req.body?.weeks?.[index]||{}));
    const {data,error}=await admin.from('cash_forecasts').update({name:clean(req.body?.name).slice(0,160)||'13-week forecast',starting_cash:startingCash,protected_floor:protectedFloor,weeks,updated_at:nowIso()}).eq('id',id).eq('owner_id',gate.user.id).select('*').maybeSingle();
    if(error)return storageError(res,error);if(!data)return res.status(404).json({error:'Forecast not found.'});
    res.json({forecast:data,analysis:cashForecast({startingCash,protectedFloor,weeks})});
  });

  app.post('/api/v2/operating-analysis',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    const forecastInput=req.body?.forecast||null;
    const forecast=forecastInput?cashForecast({startingCash:forecastInput.startingCash,protectedFloor:forecastInput.protectedFloor,weeks:forecastInput.weeks}):null;
    const reorders=(Array.isArray(req.body?.reorders)?req.body.reorders:[]).slice(0,200).map(item=>({sku:clean(item?.sku).slice(0,100),label:clean(item?.label).slice(0,180)||clean(item?.sku).slice(0,100)||'SKU',result:reorderIntelligence(item)}));
    const alerts=buildOperatingAlerts({forecast,reorders,adSignal:req.body?.adSignal||null});
    const cashGates=reorders.map(item=>({sku:item.sku,gate:reorderCashGate(item.result,{forecastHeadroom:forecast?.minimumHeadroom??0,depositPct:req.body?.depositPct??100})}));
    res.json({forecast,reorders,alerts,cashGates});
  });

  app.get('/api/v2/operating-alerts',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    let query=admin.from('operating_alerts').select('*').eq('owner_id',gate.user.id).order('last_seen_at',{ascending:false}).limit(100);
    if(req.query.brand_id)query=query.eq('brand_id',clean(req.query.brand_id));
    const {data,error}=await query;if(error)return storageError(res,error);res.json({alerts:data||[]});
  });
}
