const clean=value=>String(value??'').trim();
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const unique=items=>[...new Set(items.filter(Boolean))];

const VIBES=Object.freeze({
  minimal:['Form','Still','Blank','Mono','Line','State','Archive','Common','Basis','Uniform'],
  street:['Dept','Supply','Block','Motion','District','Unit','Works','Club','Standard','Division','Project'],
  luxury:['Atelier','House','Edition','Noir','Vale','Maison','Studio','Reserve','Objects','Society'],
  technical:['System','Index','Module','Grid','Protocol','Lab','Field','Vector','Utility','Core'],
  vintage:['Union','Athletic','Goods','Workshop','Heritage','Company','Mercantile','Standard','Motor','Social']
});
const PREFIXES=Object.freeze(['North','South','East','West','New','True','Rare','Still','Quiet','Heavy','Cold','Night','After','First','Last','Low','High']);
const SUFFIXES=Object.freeze(['Co','Goods','Supply','Studio','Works','Dept','Lab','Club','Uniform','Project','Division','Collective']);
const USPTO_TRADEMARK_SEARCH_URL='https://tmsearch.uspto.gov/';

export function normalizeSeedWords(input){
  const raw=Array.isArray(input)?input.join(' '):clean(input);
  const seen=new Set(),normalized=[];
  for(const token of raw.split(/[\s,;/|]+/)){
    const word=token.replace(/[^a-z0-9'-]/gi,'').trim();
    if(word.length<2||word.length>24)continue;
    const key=word.toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);normalized.push(word);
    if(normalized.length===8)break;
  }
  return normalized;
}

function titleCase(value){return clean(value).split(/\s+/).map(word=>word?word[0].toUpperCase()+word.slice(1).toLowerCase():'').join(' ')}
function hashString(value){let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rotate(items,seed){if(!items.length)return [];const offset=hashString(seed)%items.length;return [...items.slice(offset),...items.slice(0,offset)]}
function regexLiteral(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}

export function brandNameProfile(name){
  const normalized=titleCase(name).replace(/\s+/g,' ').trim();
  const compact=normalized.replace(/[^a-z0-9]/gi,'');
  const words=normalized?normalized.split(' '):[];
  return {
    name:normalized,
    characters:compact.length,
    words:words.length,
    short:compact.length>0&&compact.length<=12,
    compact:compact.length>0&&compact.length<=18,
    easyHandle:compact.length>0&&compact.length<=15,
    notes:[
      compact.length>18?'Longer name; social handles and labels may need abbreviation.':null,
      words.length>3?'More than three words; test how it reads on a neck label and URL.':null,
      /\d/.test(normalized)?'Contains a number; make sure people know whether to type the digit or spell it.':null
    ].filter(Boolean)
  };
}

export function trademarkSearchPlan(name){
  const normalized=titleCase(name).replace(/\s+/g,' ').replace(/"/g,'').trim();
  if(!normalized)return null;
  const searchName=normalized.toLowerCase();
  const words=unique((searchName.match(/[a-z0-9]+/g)||[]));
  const exactQuery=`CM:"${searchName}"`;
  const expandedQuery=words.length?`CM:(${words.map(word=>`/.*${regexLiteral(word)}.*/`).join(' AND ')})`:exactQuery;
  return {
    name:normalized,
    officialUrl:USPTO_TRADEMARK_SEARCH_URL,
    exactQuery,
    expandedQuery,
    guidance:[
      'Search the exact wording first, then expand the same words.',
      'Also search alternative spellings, pronunciations, meanings and similar commercial impressions.',
      'Review related goods and services; International Class 025 alone does not decide whether marks conflict.'
    ],
    disclaimer:'Preliminary federal trademark search workflow only. It is not a clearance opinion, registration prediction, or legal advice.'
  };
}

export function domainLabelForName(name){
  const ascii=clean(name).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  return ascii.replace(/&/g,'and').replace(/[^a-z0-9-]+/g,'').replace(/^-+|-+$/g,'').slice(0,63);
}

export function domainCandidates(name,{tlds=['com','co','net']}={}){
  const label=domainLabelForName(name);if(!label)return [];
  return unique(tlds.map(tld=>clean(tld).toLowerCase().replace(/^\./,'')).filter(tld=>/^[a-z0-9-]{2,24}$/.test(tld)).map(tld=>`${label}.${tld}`));
}

export function socialHandleCandidates(name){
  const base=domainLabelForName(name).replace(/-/g,'');if(!base)return [];
  return unique([base,`${base}co`,`${base}goods`,`${base}studio`,`shop${base}`,`${base}official`]).filter(value=>value.length<=30).slice(0,6);
}

export function generateBrandNames({seedWords=[],vibe='street',count=12,variation=0}={}){
  const seeds=normalizeSeedWords(seedWords).map(titleCase);
  const style=VIBES[vibe]||VIBES.street;
  const variationKey=Math.max(0,Math.trunc(Number(variation)||0));
  const seedKey=`${seeds.join('|')}|${vibe}${variationKey?`|variation:${variationKey}`:''}`;
  const vibeWords=rotate(style,seedKey);
  const prefixes=rotate(PREFIXES,`${seedKey}|p`);
  const suffixes=rotate(SUFFIXES,`${seedKey}|s`);
  const baseSeeds=seeds.length?seeds:['Motion','Foundry','Vale'];
  const candidates=[];
  for(let i=0;i<Math.max(12,count*2);i++){
    const seed=baseSeeds[i%baseSeeds.length];
    const vibeWord=vibeWords[i%vibeWords.length];
    const prefix=prefixes[i%prefixes.length];
    const suffix=suffixes[(i*3)%suffixes.length];
    candidates.push(`${seed} ${vibeWord}`);
    candidates.push(`${prefix} ${seed}`);
    candidates.push(`${seed} ${suffix}`);
    if(i%2===0)candidates.push(`${prefix} ${vibeWord}`);
  }
  return unique(candidates.map(titleCase)).slice(0,clamp(count,1,30)).map(name=>({
    name,
    profile:brandNameProfile(name),
    trademark:trademarkSearchPlan(name),
    domains:domainCandidates(name),
    handles:socialHandleCandidates(name)
  }));
}

export const BRAND_ENGINE_VIBES=Object.freeze(Object.keys(VIBES));
export const BRAND_ENGINE_USPTO_SEARCH_URL=USPTO_TRADEMARK_SEARCH_URL;
