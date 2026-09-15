const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const nonNegative=value=>Math.max(0,finite(value));
const pct01=value=>Math.min(100,Math.max(0,finite(value)))/100;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,finite(value)));
const safeLabel=(value,fallback)=>String(value||fallback||'').trim().slice(0,120);

export function normalizeCollection(input={}){
  const defaultLanded=nonNegative(input.landedCost);
  const defaultFactory=input.factoryUnitCost===null||input.factoryUnitCost===undefined?defaultLanded:nonNegative(input.factoryUnitCost);
  const variants=(Array.isArray(input.variants)?input.variants:[]).slice(0,200).map((variant,index)=>({
    key:safeLabel(variant?.key||variant?.sku||variant?.label,`variant-${index+1}`),
    label:safeLabel(variant?.label||variant?.sku,`Variant ${index+1}`),
    sku:safeLabel(variant?.sku,''),
    units:nonNegative(variant?.units),
    landedCost:variant?.landedCost===null||variant?.landedCost===undefined?defaultLanded:nonNegative(variant?.landedCost),
    factoryUnitCost:variant?.factoryUnitCost===null||variant?.factoryUnitCost===undefined?defaultFactory:nonNegative(variant?.factoryUnitCost)
  })).filter(variant=>variant.units>0);
  return {
    variants,
    retailPrice:nonNegative(input.retailPrice),
    markdownPct:clamp(input.markdownPct,0,100),
    unitsPerOrder:Math.max(.01,nonNegative(input.unitsPerOrder)||1),
    processorPercent:clamp(input.processorPercent,0,100),
    processorFixed:nonNegative(input.processorFixed),
    packagingPerOrder:nonNegative(input.packagingPerOrder),
    shippingSubsidyPerOrder:nonNegative(input.shippingSubsidyPerOrder),
    returnHandlingPerReturn:nonNegative(input.returnHandlingPerReturn),
    affiliatePct:clamp(input.affiliatePct,0,100),
    fixedLaunchCost:nonNegative(input.fixedLaunchCost),
    cacPerOrder:nonNegative(input.cacPerOrder),
    adSpend:input.adSpend===null||input.adSpend===undefined?null:nonNegative(input.adSpend),
    depositPct:clamp(input.depositPct??100,0,100),
    balanceDueWeek:Math.max(1,Math.min(13,Math.trunc(nonNegative(input.balanceDueWeek)||1))),
    freightDutyWeek:Math.max(1,Math.min(13,Math.trunc(nonNegative(input.freightDutyWeek)||Math.max(1,Math.trunc(nonNegative(input.balanceDueWeek)||1))))),
    launchWeek:Math.max(1,Math.min(13,Math.trunc(nonNegative(input.launchWeek)||1)))
  };
}

function scenarioSellThrough(scenario,variant){
  const perVariant=scenario?.variantSellThroughPct&&typeof scenario.variantSellThroughPct==='object'?scenario.variantSellThroughPct:{};
  const direct=perVariant[variant.key]??(variant.sku?perVariant[variant.sku]:undefined)??perVariant[variant.label];
  return pct01(direct===undefined?scenario?.sellThroughPct:direct);
}

export function collectionScenario(input={},scenario={}){
  const collection=normalizeCollection(input);
  const fullPriceShare=pct01(scenario.fullPriceShareOfSoldPct);
  const returnRate=pct01(scenario.returnRatePct);
  const restockableReturnRate=pct01(scenario.restockableReturnPct);
  const markdownPct=scenario.markdownPct===null||scenario.markdownPct===undefined?collection.markdownPct:clamp(scenario.markdownPct,0,100);
  const markdownPrice=collection.retailPrice*(1-markdownPct/100);

  let startingUnits=0,grossSoldUnits=0,expectedReturnUnits=0,restockableReturnUnits=0,nonRestockableReturnUnits=0;
  let fullPriceUnits=0,markdownUnits=0,grossMerchandiseRevenue=0,netMerchandiseRevenue=0;
  let productionCashCost=0,factoryCashCost=0,cogsRemovedFromInventory=0,endingInventoryAtCost=0;
  const variants=[];

  for(const variant of collection.variants){
    const sellThrough=scenarioSellThrough(scenario,variant);
    const sold=variant.units*sellThrough;
    const full=sold*fullPriceShare;
    const marked=sold-full;
    const grossRevenue=full*collection.retailPrice+marked*markdownPrice;
    const returns=sold*returnRate;
    const restockable=returns*restockableReturnRate;
    const nonRestockable=returns-restockable;
    const netRevenue=grossRevenue*(1-returnRate);
    const unitsRemoved=sold-restockable;
    const endingSellable=Math.max(0,variant.units-unitsRemoved);
    const cogsRemoved=unitsRemoved*variant.landedCost;
    const endingCost=endingSellable*variant.landedCost;
    startingUnits+=variant.units;grossSoldUnits+=sold;expectedReturnUnits+=returns;restockableReturnUnits+=restockable;nonRestockableReturnUnits+=nonRestockable;
    fullPriceUnits+=full;markdownUnits+=marked;grossMerchandiseRevenue+=grossRevenue;netMerchandiseRevenue+=netRevenue;
    productionCashCost+=variant.units*variant.landedCost;factoryCashCost+=variant.units*variant.factoryUnitCost;cogsRemovedFromInventory+=cogsRemoved;endingInventoryAtCost+=endingCost;
    variants.push({
      key:variant.key,label:variant.label,sku:variant.sku,startingUnits:variant.units,sellThroughPct:sellThrough*100,grossSoldUnits:sold,
      expectedReturnUnits:returns,restockableReturnUnits:restockable,endingSellableUnits:endingSellable,
      landedCost:variant.landedCost,endingInventoryAtCost:endingCost
    });
  }

  const orders=collection.unitsPerOrder>0?grossSoldUnits/collection.unitsPerOrder:0;
  const processorFees=grossMerchandiseRevenue*(collection.processorPercent/100)+orders*collection.processorFixed;
  const packaging=orders*collection.packagingPerOrder;
  const shippingSubsidy=orders*collection.shippingSubsidyPerOrder;
  const returnHandling=expectedReturnUnits*collection.returnHandlingPerReturn;
  const affiliateCost=netMerchandiseRevenue*(collection.affiliatePct/100);
  const adSpend=collection.adSpend===null?orders*collection.cacPerOrder:collection.adSpend;
  const variableSellingCash=processorFees+packaging+shippingSubsidy+returnHandling+affiliateCost;
  const contributionBeforeAcquisition=netMerchandiseRevenue-cogsRemovedFromInventory-variableSellingCash;
  const contributionAfterAcquisition=contributionBeforeAcquisition-adSpend;
  const contributionAfterFixed=contributionAfterAcquisition-collection.fixedLaunchCost;
  const collectionCashRecovery=netMerchandiseRevenue-variableSellingCash-adSpend-collection.fixedLaunchCost-productionCashCost;
  const economicPositionAtInventoryCost=collectionCashRecovery+endingInventoryAtCost;
  const overallSellThroughPct=startingUnits>0?grossSoldUnits/startingUnits*100:0;
  const netKeptUnits=Math.max(0,grossSoldUnits-expectedReturnUnits);
  const averageRealizedPrice=netKeptUnits>0?netMerchandiseRevenue/netKeptUnits:0;
  const inventoryCapitalPct=productionCashCost>0?endingInventoryAtCost/productionCashCost*100:0;

  return {
    name:safeLabel(scenario.name,'Scenario'),startingUnits,grossSoldUnits,overallSellThroughPct,fullPriceUnits,markdownUnits,
    expectedReturnUnits,restockableReturnUnits,nonRestockableReturnUnits,netKeptUnits,orders,
    grossMerchandiseRevenue,netMerchandiseRevenue,averageRealizedPrice,processorFees,packaging,shippingSubsidy,returnHandling,affiliateCost,
    variableSellingCash,adSpend,cogsRemovedFromInventory,contributionBeforeAcquisition,contributionAfterAcquisition,contributionAfterFixed,
    productionCashCost,factoryCashCost,endingInventoryAtCost,inventoryCapitalPct,collectionCashRecovery,economicPositionAtInventoryCost,
    markdownPct,fullPriceShareOfSoldPct:fullPriceShare*100,returnRatePct:returnRate*100,restockableReturnPct:restockableReturnRate*100,
    variants
  };
}

export function collectionCashSchedule(input={},scenario={}){
  const collection=normalizeCollection(input);
  const result=collectionScenario(input,scenario);
  const factoryDeposit=result.factoryCashCost*(collection.depositPct/100);
  const factoryBalance=Math.max(0,result.factoryCashCost-factoryDeposit);
  const freightDutyCash=Math.max(0,result.productionCashCost-result.factoryCashCost);
  const weeks=Array.from({length:13},(_,index)=>({week:index+1,factoryDeposits:0,factoryBalances:0,freightDuty:0,marketing:0,otherOutflows:0}));
  weeks[0].factoryDeposits+=factoryDeposit;
  weeks[collection.balanceDueWeek-1].factoryBalances+=factoryBalance;
  weeks[collection.freightDutyWeek-1].freightDuty+=freightDutyCash;
  weeks[collection.launchWeek-1].marketing+=result.adSpend;
  weeks[collection.launchWeek-1].otherOutflows+=collection.fixedLaunchCost;
  return {factoryDeposit,factoryBalance,freightDutyCash,adSpend:result.adSpend,fixedLaunchCost:collection.fixedLaunchCost,weeks};
}

export function applyCollectionCashSchedule(baseWeeks=[],schedule={}){
  return Array.from({length:13},(_,index)=>{
    const base=baseWeeks[index]||{},drop=schedule?.weeks?.[index]||{};
    return {
      ...base,
      label:base.label||`Week ${index+1}`,
      factoryDeposits:nonNegative(base.factoryDeposits)+nonNegative(drop.factoryDeposits),
      factoryBalances:nonNegative(base.factoryBalances)+nonNegative(drop.factoryBalances),
      freightDuty:nonNegative(base.freightDuty)+nonNegative(drop.freightDuty),
      marketing:nonNegative(base.marketing)+nonNegative(drop.marketing),
      otherOutflows:nonNegative(base.otherOutflows)+nonNegative(drop.otherOutflows)
    };
  });
}

export function breakEvenSellThroughPct(input={},scenarioTemplate={},{tolerance=.01,maxIterations=60}={}){
  const collection=normalizeCollection(input);
  if(!collection.variants.length||collection.retailPrice<=0)return null;
  const at100=collectionScenario(input,{...scenarioTemplate,sellThroughPct:100,variantSellThroughPct:null});
  if(at100.collectionCashRecovery<0)return null;
  const at0=collectionScenario(input,{...scenarioTemplate,sellThroughPct:0,variantSellThroughPct:null});
  if(at0.collectionCashRecovery>=0)return 0;
  let low=0,high=100;
  for(let i=0;i<maxIterations&&high-low>tolerance;i++){
    const mid=(low+high)/2;
    const result=collectionScenario(input,{...scenarioTemplate,sellThroughPct:mid,variantSellThroughPct:null});
    if(result.collectionCashRecovery>=0)high=mid;else low=mid;
  }
  return high;
}

export function stressCollection(input={},scenarios=[]){
  const collection=normalizeCollection(input);
  const results=(Array.isArray(scenarios)?scenarios:[]).slice(0,12).map(scenario=>collectionScenario(input,scenario));
  return {
    collection,
    totalUnits:collection.variants.reduce((sum,variant)=>sum+variant.units,0),
    productionCashCost:collection.variants.reduce((sum,variant)=>sum+variant.units*variant.landedCost,0),
    scenarios:results,
    worstCashRecovery:results.length?Math.min(...results.map(result=>result.collectionCashRecovery)):null,
    bestCashRecovery:results.length?Math.max(...results.map(result=>result.collectionCashRecovery)):null
  };
}
