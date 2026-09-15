import { postCacContribution, realizedPrice, preCacContribution } from './math.js';

const finite=v=>Number.isFinite(Number(v))?Number(v):0;
const nonNegative=v=>Math.max(0,finite(v));
const clampPct=v=>Math.min(100,Math.max(0,finite(v)));

export function discountOutcome(state,discountPct,affiliatePct=state?.affiliatePct){
  const discount=clampPct(discountPct);
  const affiliate=clampPct(affiliatePct);
  const effective={...state,observedCac:nonNegative(state?.observedCac)};
  const price=realizedPrice(effective,discount);
  const preCac=preCacContribution(effective,discount,affiliate);
  const afterCac=postCacContribution(effective,discount,affiliate);
  const floor=nonNegative(state?.requiredPostCac);
  return {discountPct:discount,realizedPrice:price,preCacContribution:preCac,afterCac,floor,pass:afterCac+1e-9>=floor};
}

export function maxSafeDiscountPct(state,affiliatePct=state?.affiliatePct){
  const price=nonNegative(state?.price);
  if(price<=0)return null;
  const fullPrice=discountOutcome(state,0,affiliatePct);
  if(!fullPrice.pass)return null;
  const fullDiscount=discountOutcome(state,100,affiliatePct);
  if(fullDiscount.pass)return 100;

  let low=0,high=100;
  for(let i=0;i<64;i++){
    const mid=(low+high)/2;
    if(discountOutcome(state,mid,affiliatePct).pass)low=mid;
    else high=mid;
  }
  return low;
}
