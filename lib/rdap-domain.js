import {domainToASCII} from 'node:url';

const BOOTSTRAP_URL='https://data.iana.org/rdap/dns.json';
const clean=value=>String(value??'').trim().toLowerCase();

export function normalizeDomain(input){
  const raw=clean(input).replace(/^https?:\/\//,'').split('/')[0].replace(/\.$/,'');
  const ascii=domainToASCII(raw);
  if(!ascii||ascii.length>253||!/^[a-z0-9.-]+$/.test(ascii)||ascii.startsWith('.')||ascii.endsWith('.')||ascii.includes('..'))throw new Error('Use a valid domain name.');
  const labels=ascii.split('.');
  if(labels.length<2||labels.some(label=>!label||label.length>63||label.startsWith('-')||label.endsWith('-')))throw new Error('Use a valid domain name.');
  return ascii;
}

export function rdapBaseForDomain(domain,bootstrap){
  const normalized=normalizeDomain(domain);
  const tld=normalized.split('.').at(-1);
  const services=Array.isArray(bootstrap?.services)?bootstrap.services:[];
  for(const service of services){
    const tlds=Array.isArray(service?.[0])?service[0].map(clean):[];
    const urls=Array.isArray(service?.[1])?service[1]:[];
    if(tlds.includes(tld)&&urls.length){
      const base=String(urls[0]||'').trim();
      if(/^https:\/\//i.test(base))return base.endsWith('/')?base:`${base}/`;
    }
  }
  return null;
}

async function fetchWithTimeout(url,{fetchImpl=fetch,timeoutMs=5000,headers={}}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetchImpl(url,{headers,signal:controller.signal,redirect:'follow'})}
  finally{clearTimeout(timer)}
}

export async function lookupDomainRdap(input,{fetchImpl=fetch,timeoutMs=5000,bootstrap=null}={}){
  const domain=normalizeDomain(input);
  let bootstrapData=bootstrap;
  if(!bootstrapData){
    const response=await fetchWithTimeout(BOOTSTRAP_URL,{fetchImpl,timeoutMs,headers:{Accept:'application/json','User-Agent':'Motion-Supply-Brand-OS/1.0'}});
    if(!response.ok)throw new Error(`RDAP bootstrap unavailable (${response.status}).`);
    bootstrapData=await response.json();
  }
  const base=rdapBaseForDomain(domain,bootstrapData);
  if(!base)return {domain,status:'unknown',registered:null,source:'rdap',reason:'No authoritative RDAP service was found for this TLD.',checkedAt:new Date().toISOString()};
  const url=new URL(`domain/${encodeURIComponent(domain)}`,base).toString();
  let response;
  try{response=await fetchWithTimeout(url,{fetchImpl,timeoutMs,headers:{Accept:'application/rdap+json, application/json','User-Agent':'Motion-Supply-Brand-OS/1.0'}})}
  catch(error){return {domain,status:'unknown',registered:null,source:'rdap',reason:error?.name==='AbortError'?'RDAP lookup timed out.':'RDAP lookup failed.',checkedAt:new Date().toISOString()}}
  if(response.status===404)return {domain,status:'not_found',registered:false,source:'rdap',reason:'The authoritative RDAP service returned 404. Registration can change at any time; verify with a registrar before purchase.',checkedAt:new Date().toISOString()};
  if(!response.ok)return {domain,status:'unknown',registered:null,source:'rdap',reason:`Authoritative RDAP returned HTTP ${response.status}.`,checkedAt:new Date().toISOString()};
  const body=await response.json().catch(()=>({}));
  return {
    domain,status:'registered',registered:true,source:'rdap',
    handle:typeof body?.handle==='string'?body.handle:null,
    statuses:Array.isArray(body?.status)?body.status.slice(0,20):[],
    reason:'The authoritative RDAP service returned a domain registration record.',
    checkedAt:new Date().toISOString()
  };
}

export const RDAP_BOOTSTRAP_URL=BOOTSTRAP_URL;
