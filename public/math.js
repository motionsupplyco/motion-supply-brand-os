export const FOUNDRY_EIGHT = Object.freeze({
  price: 78, landedCost: 27.40, packaging: 1.20, shippingSubsidy: 4.50, returnReserve: 2.50,
  processorPercent: 2.9, processorFixed: 0.30, requiredPostCac: 15, observedCac: 15,
  adSpend: 210, newCustomers: 14,
  weeklyDemand: 10, highWeeklyDemand: 14, leadWeeks: 6, onHand: 35, inbound: 0, allocated: 0,
  wholesalePrice: 45, wholesaleHandling: 1, wholesaleRepPct: 8, fixedLaunchCost: 1100,
  launchUnits: 100, inhouseFulfillment: 5.72, thirdPartyVariable: 5.40, thirdPartyMonthly: 500,
  monthlyOrders: 1000, cashStart: 7500, protectedFloor: 2500, committedOutflows: 3000,
  expectedInflows: 2000, taxReserve: 0, payroll: 0, supplierBalance: 0, wholesaleReceivable: 0,
  processorHold: 0, discountPct: 0, affiliatePct: 0, proposedUnits: 80, depositPct: 50,
  sessions: 1500, addToCarts: 50, checkouts: 32, orders: 14
});

export const STARTER_STATE = Object.freeze({
  price: 0, landedCost: 0, packaging: 0, shippingSubsidy: 0, returnReserve: 0,
  processorPercent: 0, processorFixed: 0, requiredPostCac: 0, observedCac: 0,
  adSpend: 0, newCustomers: 0,
  weeklyDemand: 0, highWeeklyDemand: 0, leadWeeks: 0, onHand: 0, inbound: 0, allocated: 0,
  wholesalePrice: 0, wholesaleHandling: 0, wholesaleRepPct: 0, fixedLaunchCost: 0,
  launchUnits: 0, inhouseFulfillment: 0, thirdPartyVariable: 0, thirdPartyMonthly: 0,
  monthlyOrders: 0, cashStart: 0, protectedFloor: 0, committedOutflows: 0,
  expectedInflows: 0, taxReserve: 0, payroll: 0, supplierBalance: 0, wholesaleReceivable: 0,
  processorHold: 0, discountPct: 0, affiliatePct: 0, proposedUnits: 0, depositPct: 0,
  sessions: 0, addToCarts: 0, checkouts: 0, orders: 0
});

const n=v=>Number.isFinite(Number(v))?Number(v):0;
export function processorFee(price,s){ const p=n(price); return p>0 ? p*n(s.processorPercent)/100+n(s.processorFixed) : 0; }
export function realizedPrice(s,discountPct=s.discountPct){ return Math.max(0,n(s.price)*(1-n(discountPct)/100)); }
export function affiliateCost(price,s,affiliatePct=s.affiliatePct){ return Math.max(0,n(price)*n(affiliatePct)/100); }
export function preCacContribution(s,discountPct=s.discountPct,affiliatePct=s.affiliatePct){
  const price=realizedPrice(s,discountPct);
  if(price<=0) return 0;
  return price-n(s.landedCost)-n(s.packaging)-n(s.shippingSubsidy)-n(s.returnReserve)-processorFee(price,s)-affiliateCost(price,s,affiliatePct);
}
export function postCacContribution(s,discountPct=s.discountPct,affiliatePct=s.affiliatePct){ return preCacContribution(s,discountPct,affiliatePct)-n(s.observedCac); }
export function maxFirstOrderCac(s){ return Math.max(0,preCacContribution(s,0,0)-n(s.requiredPostCac)); }
export function grossMarginPct(s){ return n(s.price)>0?((n(s.price)-n(s.landedCost))/n(s.price))*100:0; }
export function contributionMarginPct(s){ return n(s.price)>0?(preCacContribution(s,0,0)/n(s.price))*100:0; }
export function breakEvenOrders(s){ const c=postCacContribution(s,0,0); return c>0?Math.ceil(n(s.fixedLaunchCost)/c):Infinity; }
export function cacFromSpend(s){ return n(s.newCustomers)>0?n(s.adSpend)/n(s.newCustomers):Infinity; }
export function funnelMetrics(s){
  const sessions=n(s.sessions), atc=n(s.addToCarts), checkouts=n(s.checkouts), orders=n(s.orders);
  return {
    conversionRate:sessions>0?orders/sessions*100:0,
    addToCartRate:sessions>0?atc/sessions*100:0,
    checkoutStartRate:sessions>0?checkouts/sessions*100:0,
    cartToCheckoutRate:atc>0?checkouts/atc*100:0,
    checkoutCompletionRate:checkouts>0?orders/checkouts*100:0
  };
}
export function inventoryMath(s){
  const base=n(s.weeklyDemand), high=n(s.highWeeklyDemand)>0?Math.max(base,n(s.highWeeklyDemand)):base, weeks=n(s.leadWeeks);
  const leadDemand=base*weeks, highLeadDemand=high*weeks;
  const safetyStock=Math.max(0,highLeadDemand-leadDemand), reorderPoint=leadDemand+safetyStock;
  const inventoryPosition=Math.max(0,n(s.onHand)+n(s.inbound)-n(s.allocated));
  const reorderGap=Math.max(0,Math.ceil(reorderPoint-inventoryPosition));
  const weeksCover=base>0?Math.max(0,n(s.onHand)-n(s.allocated))/base:Infinity;
  return {leadDemand,highLeadDemand,safetyStock,reorderPoint,inventoryPosition,reorderGap,weeksCover};
}
export function wholesaleContribution(s){ return n(s.wholesalePrice)-n(s.landedCost)-n(s.wholesaleHandling)-(n(s.wholesalePrice)*n(s.wholesaleRepPct)/100); }
export function retailerGrossMarginPct(s){ return n(s.price)>0?(n(s.price)-n(s.wholesalePrice))/n(s.price)*100:0; }
export function normalized3pl(s){ return n(s.monthlyOrders)>0?n(s.thirdPartyVariable)+n(s.thirdPartyMonthly)/n(s.monthlyOrders):Infinity; }
export function crossoverOrders(s){ const delta=n(s.inhouseFulfillment)-n(s.thirdPartyVariable); return delta>0?Math.ceil(n(s.thirdPartyMonthly)/delta):Infinity; }
export function cashCheckpoint(s){
  const projectedCash=n(s.cashStart)+n(s.expectedInflows)+n(s.wholesaleReceivable)-n(s.committedOutflows)-n(s.taxReserve)-n(s.payroll)-n(s.supplierBalance)-n(s.processorHold);
  return {projectedCash,headroom:projectedCash-n(s.protectedFloor)};
}
export function purchaseOrderGate(s){
  const poTotal=n(s.proposedUnits)*n(s.landedCost), deposit=poTotal*n(s.depositPct)/100;
  const base=n(s.cashStart)+n(s.expectedInflows)+n(s.wholesaleReceivable)-n(s.committedOutflows)-n(s.taxReserve)-n(s.payroll)-n(s.supplierBalance)-n(s.processorHold);
  const afterDeposit=base-deposit, afterFullPo=base-poTotal;
  return {poTotal,deposit,baseCash:base,afterDeposit,afterFullPo,depositHeadroom:afterDeposit-n(s.protectedFloor),fullPoHeadroom:afterFullPo-n(s.protectedFloor)};
}
