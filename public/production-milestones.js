const DAY=86400000;

function parseIsoDate(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||'').trim());
  if(!match)return null;
  const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));
  if(Number.isNaN(date.getTime()))return null;
  if(date.getUTCFullYear()!==Number(match[1])||date.getUTCMonth()!==Number(match[2])-1||date.getUTCDate()!==Number(match[3]))return null;
  return date;
}
function diffDays(later,earlier){return Math.round((later.getTime()-earlier.getTime())/DAY)}

export function productionMilestoneStatus({plannedDate=null,actualDate=null,asOfDate=null,dueSoonDays=7}={}){
  const planned=parseIsoDate(plannedDate),actual=parseIsoDate(actualDate),asOf=parseIsoDate(asOfDate);
  if(actual&&asOf&&actual.getTime()>asOf.getTime())return {status:'invalid_future_actual',slippageDays:null,daysUntil:null};
  if(actual){
    if(!planned)return {status:'completed_unscheduled',slippageDays:null,daysUntil:null};
    const slippageDays=diffDays(actual,planned);
    return {status:slippageDays>0?'completed_late':'completed_on_time',slippageDays,daysUntil:null};
  }
  if(!planned)return {status:'unscheduled',slippageDays:null,daysUntil:null};
  if(!asOf)return {status:'scheduled',slippageDays:null,daysUntil:null};
  const daysUntil=diffDays(planned,asOf);
  if(daysUntil<0)return {status:'overdue',slippageDays:null,daysUntil};
  if(daysUntil<=Math.max(0,Number(dueSoonDays)||0))return {status:'due_soon',slippageDays:null,daysUntil};
  return {status:'upcoming',slippageDays:null,daysUntil};
}

const DEFINITIONS=[
  ['po','Deposit / PO','depositDate','depositDate'],
  ['production','Production complete','productionComplete','productionCompleteDate'],
  ['qc','Inspection / QC complete','qcComplete','qcCompleteDate'],
  ['arrival','Inventory arrival','estimatedArrival','arrivalDate'],
  ['ready','Inventory ready','inventoryReady','inventoryReadyDate'],
  ['launch','Launch','targetLaunchDate','launchDate']
];

export function buildProductionMilestones({timeline={},actuals={},asOfDate=null,dueSoonDays=7}={}){
  const milestones=DEFINITIONS.map(([id,label,plannedKey,actualKey])=>{
    const plannedDate=timeline?.[plannedKey]||null;
    const actualDate=actuals?.[actualKey]||null;
    const state=productionMilestoneStatus({plannedDate,actualDate,asOfDate,dueSoonDays});
    return {id,label,plannedDate,actualDate,...state};
  });
  const counts={
    overdue:milestones.filter(item=>item.status==='overdue').length,
    dueSoon:milestones.filter(item=>item.status==='due_soon').length,
    completed:milestones.filter(item=>item.status.startsWith('completed_')).length,
    completedLate:milestones.filter(item=>item.status==='completed_late').length,
    invalidFutureActual:milestones.filter(item=>item.status==='invalid_future_actual').length,
    open:milestones.filter(item=>['scheduled','upcoming','due_soon','overdue'].includes(item.status)).length,
    unscheduled:milestones.filter(item=>item.status==='unscheduled').length
  };
  const datedOpen=milestones.filter(item=>item.plannedDate&&!item.actualDate).sort((a,b)=>String(a.plannedDate).localeCompare(String(b.plannedDate)));
  const nextMilestone=datedOpen[0]||null;
  const anyPlanned=milestones.some(item=>item.plannedDate||item.actualDate);
  const allTrackedComplete=anyPlanned&&milestones.filter(item=>item.plannedDate).every(item=>Boolean(item.actualDate)&&item.status!=='invalid_future_actual');
  const status=!anyPlanned?'unscoped':(counts.overdue>0||counts.invalidFutureActual>0)?'needs_attention':allTrackedComplete?'complete':'active';
  return {
    status,milestones,counts,nextMilestone,
    disclaimer:'Milestone status compares founder-entered modeled dates with founder-recorded actual dates. Brand OS does not infer why a milestone moved or guarantee future dates.'
  };
}
