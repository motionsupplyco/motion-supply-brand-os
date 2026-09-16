import {checkDomainsRdap,normalizeDomain} from './rdap-domain.js';

const clean=value=>String(value??'').trim();
const HOUR=60*60_000;
const DOMAIN_MAX_REQUESTS=30;
const EVENT_MAX_REQUESTS=180;
const domainBuckets=new Map();
const eventBuckets=new Map();
const EVENT_NAMES=new Set(['brand_engine_viewed','brand_engine_names_generated','brand_engine_domain_checked','brand_engine_handoff_started','brand_engine_brand_initialized']);
const VIBES=new Set(['minimal','street','luxury','technical','vintage']);
const ENTRYPOINTS=new Set(['standalone','sidebar','handoff']);

function pruneBuckets(map,now){
  if(map.size<2000)return;
  for(const[key,value]of map){if(now-value.start>HOUR)map.delete(key)}
  if(map.size>5000){let remove=map.size-5000;for(const key of map.keys()){map.delete(key);if(--remove<=0)break}}
}
function hourlyLimiter(map,max,{error='Rate limit reached. Try again later.',code='BRAND_ENGINE_RATE_LIMITED'}={}){
  return(req,res,next)=>{
    const now=Date.now(),key=String(req.ip||'unknown');pruneBuckets(map,now);
    const entry=map.get(key)||{count:0,start:now};if(now-entry.start>HOUR){entry.count=0;entry.start=now}
    entry.count++;map.set(key,entry);
    if(entry.count>max){res.setHeader('Retry-After',Math.max(1,Math.ceil((HOUR-(now-entry.start))/1000)));return res.status(429).json({error,code})}
    next();
  }
}
export const brandEngineDomainLimiter=hourlyLimiter(domainBuckets,DOMAIN_MAX_REQUESTS,{error:'Domain check limit reached. Try again later.'});
export const brandEngineEventLimiter=hourlyLimiter(eventBuckets,EVENT_MAX_REQUESTS,{error:'Analytics event limit reached. Try again later.',code:'BRAND_ENGINE_EVENT_RATE_LIMITED'});

export function brandEngineProviderConfig(env=process.env){
  return {
    domains:{enabled:true,source:'ICANN/IANA RDAP',mode:'registration_status'},
    trademarks:{
      enabled:true,
      source:'USPTO Trademark Search',
      mode:'official_manual_prescreen',
      automatedScreening:false,
      searchUrl:'https://tmsearch.uspto.gov/',
      reason:'Brand OS provides official USPTO search queries and guidance, but does not scrape the search system, assign a clearance score, or label a name trademark-clear.'
    },
    social:{enabled:true,mode:'verification_links_only',instagram:'manual_verification',tiktok:'manual_verification'},
    initializeBrand:{enabled:Boolean(env.SUPABASE_URL&&(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY))}
  };
}

export function normalizeDomainCheckRequest(body){
  const values=Array.isArray(body?.domains)?body.domains:[];
  if(!values.length)throw Object.assign(new Error('Choose at least one domain to check.'),{status:400,code:'DOMAINS_REQUIRED'});
  if(values.length>3)throw Object.assign(new Error('Check up to 3 domains at a time.'),{status:400,code:'DOMAIN_LIMIT'});
  const domains=[...new Set(values.map(value=>normalizeDomain(clean(value))))];
  if(!domains.length)throw Object.assign(new Error('Choose at least one valid domain to check.'),{status:400,code:'DOMAINS_REQUIRED'});
  return domains;
}

export function brandEngineEventPayload(body={}){
  const eventName=clean(body.event_name);
  if(!EVENT_NAMES.has(eventName))throw Object.assign(new Error('Unknown Brand Engine event.'),{status:400,code:'EVENT_INVALID'});
  const input=body.properties&&typeof body.properties==='object'&&!Array.isArray(body.properties)?body.properties:{};
  const properties={};
  const vibe=clean(input.vibe).toLowerCase();if(VIBES.has(vibe))properties.vibe=vibe;
  for(const key of ['count','domain_count','registered_count','not_found_count','unknown_count']){
    const value=Number(input[key]);if(Number.isFinite(value))properties[key]=Math.max(0,Math.min(key==='count'?30:3,Math.trunc(value)));
  }
  if(typeof input.signed_in==='boolean')properties.signed_in=input.signed_in;
  const entrypoint=clean(input.entrypoint).toLowerCase();if(ENTRYPOINTS.has(entrypoint))properties.entrypoint=entrypoint;
  return {eventName,anonymousId:clean(body.anonymous_id).slice(0,80)||null,properties};
}

export function registerBrandEngineRoutes(app,{domainLimiter=brandEngineDomainLimiter,eventLimiter=brandEngineEventLimiter,checkDomains=checkDomainsRdap,admin=null,env=process.env}={}){
  app.get('/api/brand-engine/config',(_req,res)=>res.json({providers:brandEngineProviderConfig(env)}));

  const handlers=[];
  if(typeof domainLimiter==='function')handlers.push(domainLimiter);
  handlers.push(async(req,res)=>{
    let domains;
    try{domains=normalizeDomainCheckRequest(req.body)}
    catch(error){return res.status(error?.status||400).json({error:error.message||'Invalid domain request.',code:error?.code||'DOMAIN_REQUEST_INVALID'})}
    try{
      const results=await checkDomains(domains,{maxDomains:3,timeoutMs:5000});
      return res.json({
        results,
        disclaimer:'RDAP reports registration records, not purchase guarantees or registrar pricing. A not-found result can change at any time; confirm at a registrar before buying.'
      });
    }catch(error){
      console.error('brand-engine-domain-check',{message:String(error?.message||error).slice(0,300)});
      return res.status(502).json({error:'Domain registration status could not be checked right now.',code:'RDAP_LOOKUP_FAILED'});
    }
  });
  app.post('/api/brand-engine/domain-check',...handlers);

  const eventHandlers=[];if(typeof eventLimiter==='function')eventHandlers.push(eventLimiter);
  eventHandlers.push(async(req,res)=>{
    if(!admin)return res.status(503).json({error:'Analytics storage is not configured.'});
    let event;try{event=brandEngineEventPayload(req.body)}catch(error){return res.status(error?.status||400).json({error:error.message||'Invalid event.',code:error?.code||'EVENT_INVALID'})}
    const {error}=await admin.from('product_events').insert({user_id:null,anonymous_id:event.anonymousId,event_name:event.eventName,properties:event.properties});
    if(error){console.error('brand-engine-event',{message:String(error.message||error).slice(0,300)});return res.status(500).json({error:'Analytics event could not be recorded.'})}
    return res.json({ok:true});
  });
  app.post('/api/brand-engine/event',...eventHandlers);
}
