import {registerBrandEngineRoutes} from './brand-engine-routes.js';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=value=>String(value??'').trim();
const finiteOrNull=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Number(value);
const nonNegative=value=>Math.max(0,Number.isFinite(Number(value))?Number(value):0);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):0));
const isStorageMissing=error=>['42P01','PGRST205'].includes(String(error?.code||''));

function storageError(res,error){
  if(isStorageMissing(error))return res.status(503).json({error:'V2 cloud storage is not enabled yet.',code:'V2_STORAGE_NOT_READY'});
  console.error('v2-planning-storage',error);
  return res.status(500).json({error:'Planning data could not be saved.',code:'V2_STORAGE_ERROR'});
}

async function ownedBrand(admin,ownerId,brandId){
  if(!UUID_RE.test(clean(brandId)))return null;
  const {data,error}=await admin.from('brands').select('id').eq('id',brandId).eq('owner_id',ownerId).maybeSingle();
  if(error)throw error;
  return data||null;
}

async function ownedSku(admin,ownerId,brandId,skuId){
  if(!skuId)return null;
  if(!UUID_RE.test(clean(skuId)))return false;
  const {data,error}=await admin.from('skus').select('id,sku,name,landed_cost').eq('id',skuId).eq('brand_id',brandId).eq('owner_id',ownerId).maybeSingle();
  if(error)throw error;
  return data||false;
}

export function registerV2PlanningRoutes(app,{admin,requireProUser}={}){
  // Brand Engine is public and independent; mounting here avoids changing the established server/auth/billing route order.
  registerBrandEngineRoutes(app,{admin});

  app.get('/api/v2/sku-planning',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    const brandId=clean(req.query.brand_id);
    try{
      if(!await ownedBrand(admin,gate.user.id,brandId))return res.status(404).json({error:'Brand not found.'});
      const {data,error}=await admin.from('sku_planning_settings').select('*').eq('owner_id',gate.user.id).eq('brand_id',brandId).order('updated_at',{ascending:false}).limit(500);
      if(error)return storageError(res,error);
      res.json({settings:data||[]});
    }catch(error){return storageError(res,error)}
  });

  app.post('/api/v2/sku-planning',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    const brandId=clean(req.body?.brand_id),itemKey=clean(req.body?.item_key).slice(0,220);
    try{
      if(!await ownedBrand(admin,gate.user.id,brandId))return res.status(404).json({error:'Brand not found.'});
      if(!itemKey)return res.status(400).json({error:'Item key is required.'});
      const source=clean(req.body?.source||'manual').toLowerCase();
      if(!['manual','shopify'].includes(source))return res.status(400).json({error:'Invalid planning source.'});
      const skuId=clean(req.body?.sku_id)||null;
      const sku=await ownedSku(admin,gate.user.id,brandId,skuId);
      if(sku===false)return res.status(403).json({error:'SKU not found under this brand.'});
      const externalVariantId=clean(req.body?.external_variant_id).slice(0,180)||null;
      if(source==='shopify'&&!externalVariantId)return res.status(400).json({error:'Shopify planning rows require a variant ID.'});
      const landedInput=finiteOrNull(req.body?.landed_cost);
      const manualDemand=finiteOrNull(req.body?.manual_weekly_demand);
      const highDemand=finiteOrNull(req.body?.high_weekly_demand);
      const supplierNotes=clean(req.body?.supplier_notes).slice(0,2000)||null;
      const payload={
        owner_id:gate.user.id,brand_id:brandId,item_key:itemKey,sku_id:sku?.id||null,source,
        external_variant_id:externalVariantId,sku_code:clean(req.body?.sku_code||sku?.sku).slice(0,120)||null,
        label:clean(req.body?.label||sku?.name).slice(0,220)||null,
        manual_weekly_demand:manualDemand===null?null:Math.max(0,manualDemand),
        lead_weeks:nonNegative(req.body?.lead_weeks),
        high_weekly_demand:highDemand===null?null:Math.max(0,highDemand),
        moq:Math.max(0,Math.trunc(nonNegative(req.body?.moq))),
        deposit_pct:clamp(req.body?.deposit_pct??100,0,100),
        landed_cost:landedInput===null?(sku?.landed_cost??null):Math.max(0,landedInput),
        supplier_notes:supplierNotes,active:req.body?.active!==false,updated_at:new Date().toISOString()
      };
      const {data,error}=await admin.from('sku_planning_settings').upsert(payload,{onConflict:'owner_id,brand_id,item_key'}).select('*').single();
      if(error)return storageError(res,error);
      res.json({setting:data});
    }catch(error){return storageError(res,error)}
  });

  app.delete('/api/v2/sku-planning/:id',async(req,res)=>{
    const gate=await requireProUser(req,res);if(!gate)return;
    const id=clean(req.params.id);
    if(!UUID_RE.test(id))return res.status(400).json({error:'Invalid planning row.'});
    const {data,error}=await admin.from('sku_planning_settings').delete().eq('id',id).eq('owner_id',gate.user.id).select('id').maybeSingle();
    if(error)return storageError(res,error);
    if(!data)return res.status(404).json({error:'Planning row not found.'});
    res.json({ok:true});
  });
}
