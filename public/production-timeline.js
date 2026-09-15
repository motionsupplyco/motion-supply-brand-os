const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const days=value=>Math.max(0,Math.trunc(finite(value)));
const DAY=86400000;

function parseDate(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||'').trim());
  if(!match)return null;
  const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));
  if(Number.isNaN(date.getTime()))return null;
  if(date.getUTCFullYear()!==Number(match[1])||date.getUTCMonth()!==Number(match[2])-1||date.getUTCDate()!==Number(match[3]))return null;
  return date;
}
function iso(date){return date?date.toISOString().slice(0,10):null}
function add(date,count){return new Date(date.getTime()+days(count)*DAY)}
function subtract(date,count){return new Date(date.getTime()-days(count)*DAY)}
function diffDays(a,b){return Math.round((a.getTime()-b.getTime())/DAY)}

export function productionTimeline(input={}){
  const depositDate=parseDate(input.depositDate);
  const targetLaunchDate=parseDate(input.targetLaunchDate);
  const productionLeadDays=days(input.productionLeadDays);
  const inspectionDays=days(input.inspectionDays);
  const transitDays=days(input.transitDays);
  const customsBufferDays=days(input.customsBufferDays);
  const receivingPrepDays=days(input.receivingPrepDays);
  const contentBufferDays=days(input.contentBufferDays);
  const totalCriticalPathDays=productionLeadDays+inspectionDays+transitDays+customsBufferDays+receivingPrepDays+contentBufferDays;
  const inventoryPathDays=productionLeadDays+inspectionDays+transitDays+customsBufferDays+receivingPrepDays;

  let productionComplete=null,qcComplete=null,estimatedArrival=null,inventoryReady=null,earliestLaunch=null;
  if(depositDate){
    productionComplete=add(depositDate,productionLeadDays);
    qcComplete=add(productionComplete,inspectionDays);
    estimatedArrival=add(qcComplete,transitDays);
    inventoryReady=add(estimatedArrival,customsBufferDays+receivingPrepDays);
    earliestLaunch=add(inventoryReady,contentBufferDays);
  }

  const latestDepositDate=targetLaunchDate?subtract(targetLaunchDate,totalCriticalPathDays):null;
  const launchBufferDays=targetLaunchDate&&earliestLaunch?diffDays(targetLaunchDate,earliestLaunch):null;
  const status=launchBufferDays===null?'unscoped':launchBufferDays<0?'late':'on_track';

  return {
    assumptions:{productionLeadDays,inspectionDays,transitDays,customsBufferDays,receivingPrepDays,contentBufferDays},
    totalCriticalPathDays,inventoryPathDays,
    depositDate:iso(depositDate),productionComplete:iso(productionComplete),qcComplete:iso(qcComplete),estimatedArrival:iso(estimatedArrival),inventoryReady:iso(inventoryReady),earliestLaunch:iso(earliestLaunch),
    targetLaunchDate:iso(targetLaunchDate),latestDepositDate:iso(latestDepositDate),launchBufferDays,status,
    disclaimer:'Dates are modeled from founder-entered calendar-day assumptions. They are not factory, freight, customs, or launch guarantees.'
  };
}
