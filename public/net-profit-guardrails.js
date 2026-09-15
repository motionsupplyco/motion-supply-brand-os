const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const nonNegative=value=>Math.max(0,finite(value));
const pct=value=>Math.min(100,Math.max(0,finite(value)));
const provided=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const ratio=(top,bottom)=>bottom>0?top/bottom:null;

export function trueNetProfit(input={}){
  const grossSales=nonNegative(input.grossSales);
  const discounts=nonNegative(input.discounts);
  const refunds=nonNegative(input.refunds);
  const netMerchandiseRevenue=provided(input.netSales)?nonNegative(input.netSales):Math.max(0,grossSales-discounts-refunds);
  const shippingCollected=nonNegative(input.shippingCollected);
  const operatingRevenue=netMerchandiseRevenue+shippingCollected;

  const cogs=nonNegative(input.cogs);
  const packaging=nonNegative(input.packaging);
  const outboundShipping=nonNegative(input.outboundShipping);
  const fulfillment=nonNegative(input.fulfillment);
  const paymentFees=nonNegative(input.paymentFees);
  const affiliateSpend=nonNegative(input.affiliateSpend);
  const directCosts=cogs+packaging+outboundShipping+fulfillment+paymentFees+affiliateSpend;
  const grossProfit=operatingRevenue-cogs;
  const contributionBeforeAcquisition=operatingRevenue-directCosts;

  const adSpend=nonNegative(input.adSpend);
  const contributionAfterAcquisition=contributionBeforeAcquisition-adSpend;
  const software=nonNegative(input.software);
  const rent=nonNegative(input.rent);
  const payroll=nonNegative(input.payroll);
  const contractors=nonNegative(input.contractors);
  const otherOperating=nonNegative(input.otherOperating);
  const operatingExpenses=software+rent+payroll+contractors+otherOperating;
  const operatingProfit=contributionAfterAcquisition-operatingExpenses;

  const targetOperatingMarginPct=pct(input.targetOperatingMarginPct);
  const targetOperatingProfit=operatingRevenue*targetOperatingMarginPct/100;
  const maxAcquisitionSpendForTarget=Math.max(0,contributionBeforeAcquisition-operatingExpenses-targetOperatingProfit);
  const acquisitionHeadroom=maxAcquisitionSpendForTarget-adSpend;
  const newCustomers=nonNegative(input.newCustomers);
  const observedCac=newCustomers>0?adSpend/newCustomers:null;
  const maxCacForTarget=newCustomers>0?maxAcquisitionSpendForTarget/newCustomers:null;
  const blendedMer=ratio(operatingRevenue,adSpend);
  const minimumMerAtTarget=ratio(operatingRevenue,maxAcquisitionSpendForTarget);

  return {
    grossSales,discounts,refunds,netMerchandiseRevenue,shippingCollected,operatingRevenue,
    cogs,packaging,outboundShipping,fulfillment,paymentFees,affiliateSpend,directCosts,grossProfit,
    contributionBeforeAcquisition,adSpend,contributionAfterAcquisition,software,rent,payroll,contractors,otherOperating,operatingExpenses,operatingProfit,
    grossMarginPct:operatingRevenue>0?grossProfit/operatingRevenue*100:0,
    contributionMarginPct:operatingRevenue>0?contributionAfterAcquisition/operatingRevenue*100:0,
    operatingMarginPct:operatingRevenue>0?operatingProfit/operatingRevenue*100:0,
    targetOperatingMarginPct,targetOperatingProfit,maxAcquisitionSpendForTarget,acquisitionHeadroom,newCustomers,observedCac,maxCacForTarget,
    blendedMer,minimumMerAtTarget,acquisitionWithinTarget:operatingRevenue>0&&adSpend<=maxAcquisitionSpendForTarget
  };
}

export function acquisitionSpendScenarios(input={},multipliers=[.75,1,1.25,1.5]){
  const base=trueNetProfit(input);
  return multipliers.map(multiplier=>{
    const adSpend=base.adSpend*Math.max(0,finite(multiplier));
    const result=trueNetProfit({...input,adSpend});
    return {multiplier:Math.max(0,finite(multiplier)),adSpend,operatingProfit:result.operatingProfit,operatingMarginPct:result.operatingMarginPct,withinTarget:result.acquisitionWithinTarget};
  });
}

export function firstOrderAcquisitionGuardrail(input={}){
  const price=nonNegative(input.price);
  const discountPct=pct(input.discountPct);
  const realizedPrice=price*(1-discountPct/100);
  const processorPercent=pct(input.processorPercent);
  const processorFixed=realizedPrice>0?nonNegative(input.processorFixed):0;
  const processorFee=realizedPrice*processorPercent/100+processorFixed;
  const affiliateCost=realizedPrice*pct(input.affiliatePct)/100;
  const preCacContribution=realizedPrice
    -nonNegative(input.landedCost)
    -nonNegative(input.packaging)
    -nonNegative(input.shippingSubsidy)
    -nonNegative(input.returnReserve)
    -processorFee
    -affiliateCost;
  const targetPostCacContribution=nonNegative(input.targetPostCacContribution);
  const maxFirstOrderCac=Math.max(0,preCacContribution-targetPostCacContribution);
  const observedCac=nonNegative(input.observedCac);
  const postCacContribution=preCacContribution-observedCac;
  return {
    price,discountPct,realizedPrice,processorFee,affiliateCost,preCacContribution,targetPostCacContribution,maxFirstOrderCac,observedCac,postCacContribution,
    cacHeadroom:maxFirstOrderCac-observedCac,
    minimumRevenueToPaidSpend:ratio(realizedPrice,maxFirstOrderCac),
    passes:observedCac<=maxFirstOrderCac&&preCacContribution>=targetPostCacContribution
  };
}
