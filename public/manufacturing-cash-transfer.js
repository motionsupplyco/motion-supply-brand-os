const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const nonNegative=value=>Math.max(0,finite(value));
const provided=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const validWeek=value=>provided(value)&&Number(value)>=1&&Number(value)<=13?Math.trunc(Number(value)):null;

export const MANUFACTURING_CASH_TRANSFER_KEY='msbo_pending_manufacturing_cash_v1';
const ALLOWED_CATEGORIES=new Set(['factoryDeposits','factoryBalances','freightDuty','otherOutflows']);

export function buildManufacturingCashTransfer(input={}){
  const lines=[];
  const missingTiming=[];
  const unknownEstimates=[];
  const add=(amount,week,category,label)=>{
    const cash=nonNegative(amount);
    if(cash<=0)return;
    const resolvedWeek=validWeek(week);
    if(!resolvedWeek){missingTiming.push(label);return}
    lines.push({week:resolvedWeek,category,label:String(label||'Manufacturing cash').trim(),amount:cash});
  };

  add(input.deposit,input.depositWeek,'factoryDeposits','Factory deposit');
  add(input.balance,input.balanceWeek,'factoryBalances','Factory balance');

  const freightKnown=input.freightKnown!==false;
  const dutyKnown=input.dutyKnown!==false;
  const inspectionKnown=input.inspectionKnown!==false;
  if(!freightKnown)unknownEstimates.push('freight');
  if(!dutyKnown)unknownEstimates.push('duty / import taxes');
  if(!inspectionKnown)unknownEstimates.push('inspection / QC');

  const freightDuty=(freightKnown?nonNegative(input.freightEstimate):0)+(dutyKnown?nonNegative(input.dutyEstimate):0);
  add(freightDuty,input.freightDutyWeek,'freightDuty','Freight / duty');
  const inspectionOther=(inspectionKnown?nonNegative(input.inspectionCost):0)+nonNegative(input.otherProductionCost);
  add(inspectionOther,input.inspectionOtherWeek,'otherOutflows','Inspection / other production');

  const total=lines.reduce((sum,line)=>sum+line.amount,0);
  return {
    version:1,
    source:String(input.source||'production-preflight'),
    factoryName:String(input.factoryName||'').trim(),
    styleName:String(input.styleName||'').trim(),
    quoteReference:String(input.quoteReference||'').trim(),
    createdAt:String(input.createdAt||''),
    lines,
    total,
    missingTiming,
    unknownEstimates,
    valid:missingTiming.length===0&&lines.length>0,
    note:'Sample and tooling cash are not auto-applied because Production Preflight allows those fields to represent costs already paid or still planned.'
  };
}

export function applyManufacturingCashTransfer(forecast={},transfer={}){
  if(!transfer||transfer.valid!==true)throw new Error('Manufacturing cash transfer is not ready to apply.');
  const weeks=Array.from({length:13},(_,index)=>({label:`Week ${index+1}`,...(forecast.weeks?.[index]||{})}));
  let appliedTotal=0;
  const appliedLines=[];
  for(const line of transfer.lines||[]){
    const week=validWeek(line.week);
    const category=String(line.category||'');
    const amount=nonNegative(line.amount);
    if(!week||!ALLOWED_CATEGORIES.has(category)||amount<=0)continue;
    weeks[week-1][category]=nonNegative(weeks[week-1][category])+amount;
    appliedTotal+=amount;
    appliedLines.push({...line,week,category,amount});
  }
  return {forecast:{...forecast,weeks},appliedTotal,appliedLines};
}
