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
  poBalanceDueWeeks: 4, poExpectedInflowsBeforeBalance: 0, poExpectedOutflowsBeforeBalance: 0,
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
  poBalanceDueWeeks: 0, poExpectedInflowsBeforeBalance: 0, poExpectedOutflowsBeforeBalance: 0,
  sessions: 0, addToCarts: 0, checkouts: 0, orders: 0
});

const finite=v=>Number.isFinite(Number(v))?Number(v):0;
const nonNegative=v=>Math.max(0,finite(v));
const pct01=v=>Math.min(100,Math.max(0,finite(v)));

export function processorFee(price,s){
  const p=nonNegative(price);
  return p>0 ? p*pct01(s.processorPercent)/100+nonNegative(s.processorFixed) : 0;
}
export function realizedPrice(s,discountPct=s.discountPct){
  return Math.max(0,nonNegative(s.price)*(1-pct01(discountPct)/100));
}
export function affiliateCost(price,s,affiliatePct=s.affiliatePct){
  return Math.max(0,nonNegative(price)*pct01(affiliatePct)/100);
}
export function preCacContribution(s,discountPct=s.discountPct,affiliatePct=s.affiliatePct){
  const price=realizedPrice(s,discountPct);
  if(price<=0) return 0;
  return price-nonNegative(s.landedCost)-nonNegative(s.packaging)-nonNegative(s.shippingSubsidy)-nonNegative(s.returnReserve)-processorFee(price,s)-affiliateCost(price,s,affiliatePct);
}
export function postCacContribution(s,discountPct=s.discountPct,affiliatePct=s.affiliatePct){
  return preCacContribution(s,discountPct,affiliatePct)-nonNegative(s.observedCac);
}
export function maxFirstOrderCac(s){ return Math.max(0,preCacContribution(s,0,0)-nonNegative(s.requiredPostCac)); }
export function grossMarginPct(s){ const price=nonNegative(s.price); return price>0?((price-nonNegative(s.landedCost))/price)*100:0; }
export function contributionMarginPct(s){ const price=nonNegative(s.price); return price>0?(preCacContribution(s,0,0)/price)*100:0; }
export function breakEvenOrders(s){ const c=postCacContribution(s,0,0); return c>0?Math.ceil(nonNegative(s.fixedLaunchCost)/c):Infinity; }
export function cacFromSpend(s){ const customers=nonNegative(s.newCustomers); return customers>0?nonNegative(s.adSpend)/customers:Infinity; }
export function funnelMetrics(s){
  const sessions=nonNegative(s.sessions), atc=nonNegative(s.addToCarts), checkouts=nonNegative(s.checkouts), orders=nonNegative(s.orders);
  return {
    conversionRate:sessions>0?orders/sessions*100:0,
    addToCartRate:sessions>0?atc/sessions*100:0,
    checkoutStartRate:sessions>0?checkouts/sessions*100:0,
    cartToCheckoutRate:atc>0?checkouts/atc*100:0,
    checkoutCompletionRate:checkouts>0?orders/checkouts*100:0
  };
}
export function inventoryMath(s){
  const base=nonNegative(s.weeklyDemand), high=nonNegative(s.highWeeklyDemand)>0?Math.max(base,nonNegative(s.highWeeklyDemand)):base, weeks=nonNegative(s.leadWeeks);
  const leadDemand=base*weeks, highLeadDemand=high*weeks;
  const safetyStock=Math.max(0,highLeadDemand-leadDemand), reorderPoint=leadDemand+safetyStock;
  const inventoryPosition=Math.max(0,nonNegative(s.onHand)+nonNegative(s.inbound)-nonNegative(s.allocated));
  const reorderGap=Math.max(0,Math.ceil(reorderPoint-inventoryPosition));
  const weeksCover=base>0?Math.max(0,nonNegative(s.onHand)-nonNegative(s.allocated))/base:Infinity;
  return {leadDemand,highLeadDemand,safetyStock,reorderPoint,inventoryPosition,reorderGap,weeksCover};
}
export function wholesaleContribution(s){
  const price=nonNegative(s.wholesalePrice);
  return price-nonNegative(s.landedCost)-nonNegative(s.wholesaleHandling)-(price*pct01(s.wholesaleRepPct)/100);
}
export function retailerGrossMarginPct(s){ const price=nonNegative(s.price); return price>0?(price-nonNegative(s.wholesalePrice))/price*100:0; }
export function normalized3pl(s){ const orders=nonNegative(s.monthlyOrders); return orders>0?nonNegative(s.thirdPartyVariable)+nonNegative(s.thirdPartyMonthly)/orders:Infinity; }
export function crossoverOrders(s){ const delta=nonNegative(s.inhouseFulfillment)-nonNegative(s.thirdPartyVariable); return delta>0?Math.ceil(nonNegative(s.thirdPartyMonthly)/delta):Infinity; }
export function cashCheckpoint(s){
  const projectedCash=nonNegative(s.cashStart)+nonNegative(s.expectedInflows)+nonNegative(s.wholesaleReceivable)-nonNegative(s.committedOutflows)-nonNegative(s.taxReserve)-nonNegative(s.payroll)-nonNegative(s.supplierBalance)-nonNegative(s.processorHold);
  return {projectedCash,headroom:projectedCash-nonNegative(s.protectedFloor)};
}
export function purchaseOrderGate(s){
  const units=nonNegative(s.proposedUnits), cost=nonNegative(s.landedCost), depositPct=pct01(s.depositPct);
  const poTotal=units*cost, deposit=poTotal*depositPct/100, remainingBalance=Math.max(0,poTotal-deposit);
  const base=nonNegative(s.cashStart)+nonNegative(s.expectedInflows)+nonNegative(s.wholesaleReceivable)-nonNegative(s.committedOutflows)-nonNegative(s.taxReserve)-nonNegative(s.payroll)-nonNegative(s.supplierBalance)-nonNegative(s.processorHold);
  const afterDeposit=base-deposit;
  const cashBeforeBalance=afterDeposit+nonNegative(s.poExpectedInflowsBeforeBalance)-nonNegative(s.poExpectedOutflowsBeforeBalance);
  const afterBalance=cashBeforeBalance-remainingBalance;
  const afterFullPo=base-poTotal; // legacy same-window comparison kept for backwards compatibility
  const floor=nonNegative(s.protectedFloor);
  const minimumProjectedCash=Math.min(afterDeposit,cashBeforeBalance,afterBalance);
  return {
    poTotal,deposit,remainingBalance,baseCash:base,afterDeposit,afterFullPo,
    depositHeadroom:afterDeposit-floor,fullPoHeadroom:afterFullPo-floor,
    balanceDueWeeks:nonNegative(s.poBalanceDueWeeks),cashBeforeBalance,afterBalance,
    balanceHeadroom:afterBalance-floor,minimumProjectedCash,minimumHeadroom:minimumProjectedCash-floor
  };
}
