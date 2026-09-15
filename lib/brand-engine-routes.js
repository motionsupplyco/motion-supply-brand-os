import {checkDomainsRdap,normalizeDomain} from './rdap-domain.js';

const clean=value=>String(value??'').trim();

export function brandEngineProviderConfig(env=process.env){
  return {
    domains:{enabled:true,source:'ICANN/IANA RDAP',mode:'registration_status'},
    trademarks:{enabled:false,source:'USPTO',mode:'official_provider_required',reason:'Brand OS will not scrape or label a name trademark-clear. Official search access must be configured before automated screening is enabled.'},
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

export function registerBrandEngineRoutes(app,{domainLimiter=null,checkDomains=checkDomainsRdap,env=process.env}={}){
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
}
