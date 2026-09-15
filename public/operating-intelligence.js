const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const nonNegative=value=>Math.max(0,finite(value));
const clamp=(value,min,max)=>Math.min(max,Math.max(min,finite(value)));

export const FORECAST_WEEKS=13;

export const CASH_WEEK_FIELDS=Object.freeze({
  inflows:['dtcPayouts','wholesaleReceipts','otherInflows'],
  outflows:['factoryDeposits','factoryBalances','freightDuty','marketing','payrollContractors','softwareRent','taxesDebt','otherOutflows']
});

export function normalizeCashWeek(week={}){
  const out={label:String(week?.label||'').trim().slice(0,40)};
  for(const key of [...CASH_WEEK_FIELDS.inflows,...CASH_WEEK_FIELDS.outflows])out[key]=nonNegative(week?.[key]);
  return out;
}

export function cashForecast({startingCash=0,protectedFloor=0,weeks=[]}={}){
  const floor=nonNegative(protectedFloor);
  let openingCash=finite(startingCash);
  const normalized=Array.from({length:FORECAST_WEEKS},(_,index)=>normalizeCashWeek(Array.isArray(weeks)?weeks[index]:null));
  const rows=normalized.map((week,index)=>{
    const inflows=CASH_WEEK_FIELDS.inflows.reduce((sum,key)=>sum+week[key],0);
    const outflows=CASH_WEEK_FIELDS.outflows.reduce((sum,key)=>sum+week[key],0);
    const closingCash=openingCash+inflows-outflows;
    const headroom=closingCash-floor;
    const row={
      week:index+1,
      label:week.label||`Week ${index+1}`,
      openingCash,
      ...week,
      inflows,
      outflows,
      closingCash,
      protectedFloor:floor,
      headroom,
      belowFloor:headroom<0
    };
    openingCash=closingCash;
    return row;
  });
  const minimum=rows.reduce((lowest,row)=>row.closingCash<lowest.closingCash?row:lowest,rows[0]);
  const firstBreach=rows.find(row=>row.belowFloor)||null;
  return {
    startingCash:finite(startingCash),
    protectedFloor:floor,
    weeks:rows,
    endingCash:rows.at(-1)?.closingCash??finite(startingCash),
    minimumCash:minimum?.closingCash??finite(startingCash),
    minimumHeadroom:minimum?.headroom??finite(startingCash)-floor,
    minimumWeek:minimum?.week??null,
    firstBreachWeek:firstBreach?.week??null,
    firstBreachAmount:firstBreach?Math.abs(firstBreach.headroom):0,
    passes:!firstBreach
  };
}

export function cashForecastScenario(input={},options={}){
  const inflowMultiplier=Math.max(0,finite(options.inflowMultiplier||1));
  const marketingMultiplier=Math.max(0,finite(options.marketingMultiplier||1));
  const weeks=(Array.isArray(input.weeks)?input.weeks:[]).map(week=>({
    ...week,
    dtcPayouts:nonNegative(week?.dtcPayouts)*inflowMultiplier,
    wholesaleReceipts:nonNegative(week?.wholesaleReceipts)*inflowMultiplier,
    otherInflows:nonNegative(week?.otherInflows),
    marketing:nonNegative(week?.marketing)*marketingMultiplier
  }));
  return cashForecast({...input,weeks});
}

export function reorderIntelligence(input={}){
  const weeklyDemand=nonNegative(input.weeklyDemand??input.avgWeeklyDemand);
  const highWeeklyDemand=Math.max(weeklyDemand,nonNegative(input.highWeeklyDemand||weeklyDemand));
  const leadWeeks=nonNegative(input.leadWeeks);
  const onHand=nonNegative(input.onHand);
  const inbound=nonNegative(input.inbound);
  const allocated=nonNegative(input.allocated);
  const landedCost=nonNegative(input.landedCost);
  const moq=Math.ceil(nonNegative(input.moq));
  const inventoryPosition=Math.max(0,onHand+inbound-allocated);
  const availableOnHand=Math.max(0,onHand-allocated);
  const baseLeadDemand=weeklyDemand*leadWeeks;
  const highLeadDemand=highWeeklyDemand*leadWeeks;
  const safetyStock=Math.max(0,highLeadDemand-baseLeadDemand);
  const reorderPoint=baseLeadDemand+safetyStock;
  const reorderGap=Math.max(0,Math.ceil(reorderPoint-inventoryPosition));
  const reviewTriggered=weeklyDemand>0&&leadWeeks>0&&inventoryPosition<=reorderPoint;
  const reviewQuantity=reviewTriggered?Math.max(reorderGap,moq):0;
  const onHandWeeksCover=weeklyDemand>0?availableOnHand/weeklyDemand:Infinity;
  const positionWeeksCover=weeklyDemand>0?inventoryPosition/weeklyDemand:Infinity;
  const likelyRunsOutBeforeReplenishment=reviewTriggered&&onHandWeeksCover<=leadWeeks;
  const severity=!reviewTriggered?'healthy':likelyRunsOutBeforeReplenishment?'critical':'warning';
  return {
    weeklyDemand,highWeeklyDemand,leadWeeks,onHand,inbound,allocated,inventoryPosition,availableOnHand,
    baseLeadDemand,highLeadDemand,safetyStock,reorderPoint,reorderGap,reviewTriggered,reviewQuantity,
    onHandWeeksCover,positionWeeksCover,likelyRunsOutBeforeReplenishment,severity,
    landedCost,reviewCashRequired:reviewQuantity*landedCost,
    note:reviewTriggered?'Review demand quality, supplier timing, MOQ and cash before placing a PO.':'Inventory position is above the modeled reorder review point.'
  };
}

export function reorderCashGate(reorder={},options={}){
  const depositPct=clamp(options.depositPct??100,0,100);
  const forecastHeadroom=finite(options.forecastHeadroom);
  const reviewCashRequired=nonNegative(reorder.reviewCashRequired);
  const cashDueNow=reviewCashRequired*depositPct/100;
  const remainingHeadroom=forecastHeadroom-cashDueNow;
  return {
    depositPct,
    reviewCashRequired,
    cashDueNow,
    forecastHeadroom,
    remainingHeadroom,
    passes:remainingHeadroom>=0,
    note:remainingHeadroom>=0?'The modeled deposit stays above the selected cash headroom. Confirm timing and supplier terms before ordering.':'The modeled deposit would consume more than the selected cash headroom. Reduce units, improve terms, delay the PO, or increase available cash.'
  };
}

const severityRank=Object.freeze({critical:0,warning:1,info:2,healthy:3});

export function buildOperatingAlerts({forecast=null,reorders=[],adSignal=null,productionMilestones=null}={}){
  const alerts=[];
  if(forecast?.firstBreachWeek){
    alerts.push({
      type:'cash_floor',severity:'critical',entityKey:'cash',
      title:`Cash falls below your protected floor in Week ${forecast.firstBreachWeek}`,
      detail:`Modeled shortfall is ${forecast.firstBreachAmount.toFixed(2)}. Review PO timing, marketing, payroll and expected receipts before committing more cash.`,
      evidence:{week:forecast.firstBreachWeek,shortfall:forecast.firstBreachAmount,minimumHeadroom:forecast.minimumHeadroom}
    });
  }
  for(const item of Array.isArray(reorders)?reorders:[]){
    const result=item?.result||item;
    if(!result?.reviewTriggered)continue;
    const label=String(item?.label||item?.sku||'SKU');
    alerts.push({
      type:'reorder_review',severity:result.severity==='critical'?'critical':'warning',entityKey:String(item?.sku||label),
      title:`${label} crossed its reorder review point`,
      detail:`${Math.ceil(result.inventoryPosition)} units positioned vs ${Math.ceil(result.reorderPoint)} review point. Review ${result.reviewQuantity} units before MOQ/cash adjustments.`,
      evidence:{inventoryPosition:result.inventoryPosition,reorderPoint:result.reorderPoint,reviewQuantity:result.reviewQuantity,weeksCover:result.onHandWeeksCover,reviewCashRequired:result.reviewCashRequired}
    });
  }
  const productionItems=Array.isArray(productionMilestones)?productionMilestones:productionMilestones?.milestones;
  for(const item of Array.isArray(productionItems)?productionItems:[]){
    if(!['overdue','due_soon'].includes(item?.status))continue;
    const overdue=item.status==='overdue';
    const label=String(item.label||'Production milestone');
    const days=Math.abs(finite(item.daysUntil));
    const timing=days===0?'today':`${days} day${days===1?'':'s'} ${overdue?'past':'away'}`;
    alerts.push({
      type:'production_milestone',severity:overdue?'critical':'warning',entityKey:`production:${String(item.id||label)}`,
      title:overdue?`${label} missed its modeled date`:`${label} is due soon`,
      detail:overdue
        ?`Modeled date was ${String(item.plannedDate||'not set')} and is now ${timing} with no recorded actual completion. Brand OS does not infer the cause.`
        :`Modeled date is ${String(item.plannedDate||'not set')} (${timing}). Confirm the plan and record the actual completion when it happens.`,
      evidence:{milestoneId:item.id||null,plannedDate:item.plannedDate||null,daysUntil:item.daysUntil??null,status:item.status}
    });
  }
  if(adSignal&&Number.isFinite(Number(adSignal.spendChangePct))&&Number.isFinite(Number(adSignal.contributionChangePct))){
    const spend=finite(adSignal.spendChangePct),contribution=finite(adSignal.contributionChangePct);
    if(spend>0&&contribution<spend){
      alerts.push({
        type:'acquisition_efficiency',severity:contribution<0?'critical':'warning',entityKey:'acquisition',
        title:'Ad spend is growing faster than contribution',
        detail:`Spend changed ${spend.toFixed(1)}% while contribution changed ${contribution.toFixed(1)}%. This is an observation, not proof of causation.`,
        evidence:{spendChangePct:spend,contributionChangePct:contribution}
      });
    }
  }
  return alerts.sort((a,b)=>(severityRank[a.severity]??9)-(severityRank[b.severity]??9));
}
