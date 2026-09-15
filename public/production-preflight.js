const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const nonNegative=value=>Math.max(0,finite(value));
const pct=value=>Math.min(100,Math.max(0,finite(value)));
const provided=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));

const CHECKS=Object.freeze([
  {id:'styleIdentity',label:'Style / SKU identity',group:'tech_pack',blocking:false,waivable:false},
  {id:'materialSpec',label:'Fabric / material specification',group:'tech_pack',blocking:false,waivable:false},
  {id:'measurementSpec',label:'Measurement specification',group:'tech_pack',blocking:true,waivable:false},
  {id:'tolerances',label:'Measurement tolerances',group:'tech_pack',blocking:true,waivable:false},
  {id:'constructionSpec',label:'Construction / seam details',group:'tech_pack',blocking:false,waivable:false},
  {id:'artworkPlacement',label:'Artwork / branding placement',group:'tech_pack',blocking:false,waivable:true},
  {id:'colorSpec',label:'Color specification',group:'tech_pack',blocking:false,waivable:true},
  {id:'labelsPackaging',label:'Labels / packaging instructions',group:'tech_pack',blocking:false,waivable:true},
  {id:'sizeGrade',label:'Size grading / size breakdown',group:'tech_pack',blocking:true,waivable:false},
  {id:'approvedSample',label:'Physical sample approved',group:'approval',blocking:true,waivable:false},
  {id:'sampleMeasurementsRecorded',label:'Approved sample measurements recorded',group:'approval',blocking:true,waivable:false},
  {id:'writtenQuote',label:'Written production quote',group:'commercial',blocking:true,waivable:false},
  {id:'paymentTerms',label:'Payment terms in writing',group:'commercial',blocking:true,waivable:false},
  {id:'productionLeadTime',label:'Production lead time in writing',group:'commercial',blocking:true,waivable:false},
  {id:'incoterm',label:'Shipping / Incoterm responsibility documented',group:'commercial',blocking:true,waivable:false},
  {id:'defectRemedy',label:'Defect / remake / credit remedy documented',group:'commercial',blocking:false,waivable:false},
  {id:'inspectionPlan',label:'Inspection / QC plan documented',group:'commercial',blocking:false,waivable:true}
]);

function statusOf(value,waivable=false){
  if(value===true||value==='ready')return 'ready';
  if((value==='na'||value==='not_applicable')&&waivable)return 'na';
  return 'missing';
}

export function productionCommitment(input={}){
  const orderQty=Math.max(0,Math.trunc(nonNegative(input.orderQty)));
  const factoryUnitCost=nonNegative(input.factoryUnitCost);
  const productionSubtotal=orderQty*factoryUnitCost;
  const depositPct=pct(input.depositPct);
  const deposit=productionSubtotal*depositPct/100;
  const balance=Math.max(0,productionSubtotal-deposit);
  const sampleCost=nonNegative(input.sampleCost);
  const toolingCost=nonNegative(input.toolingCost);
  const inspectionCost=nonNegative(input.inspectionCost);
  const freightEstimate=nonNegative(input.freightEstimate);
  const dutyEstimate=nonNegative(input.dutyEstimate);
  const otherProductionCost=nonNegative(input.otherProductionCost);
  const preProductionCash=sampleCost+toolingCost+deposit;
  const postDepositKnownCash=balance+inspectionCost+freightEstimate+dutyEstimate+otherProductionCost;
  const totalKnownCash=productionSubtotal+sampleCost+toolingCost+inspectionCost+freightEstimate+dutyEstimate+otherProductionCost;
  const coverage={
    quantity:provided(input.orderQty),factoryUnitCost:provided(input.factoryUnitCost),depositPct:provided(input.depositPct),
    freightEstimate:provided(input.freightEstimate),dutyEstimate:provided(input.dutyEstimate),inspectionCost:provided(input.inspectionCost)
  };
  const missingEstimateLabels=[];
  if(!coverage.freightEstimate)missingEstimateLabels.push('freight');
  if(!coverage.dutyEstimate)missingEstimateLabels.push('duty / import taxes');
  if(!coverage.inspectionCost)missingEstimateLabels.push('inspection / QC');
  return {
    orderQty,factoryUnitCost,productionSubtotal,depositPct,deposit,balance,sampleCost,toolingCost,inspectionCost,freightEstimate,dutyEstimate,otherProductionCost,
    preProductionCash,postDepositKnownCash,totalKnownCash,coverage,missingEstimateLabels,
    coreCommercialInputsReady:coverage.quantity&&coverage.factoryUnitCost&&coverage.depositPct&&orderQty>0&&factoryUnitCost>0
  };
}

export function productionPreflight(input={}){
  const checks=CHECKS.map(def=>{
    const status=statusOf(input.checks?.[def.id],def.waivable);
    return {...def,status,addressed:status==='ready'||status==='na'};
  });
  const addressed=checks.filter(check=>check.addressed).length;
  const missing=checks.filter(check=>!check.addressed);
  const blockers=missing.filter(check=>check.blocking);
  const commitment=productionCommitment(input);
  const commercialBlockers=[];
  if(!commitment.coverage.quantity||commitment.orderQty<=0)commercialBlockers.push('Production quantity is not locked.');
  if(!commitment.coverage.factoryUnitCost||commitment.factoryUnitCost<=0)commercialBlockers.push('Factory unit cost is not locked.');
  if(!commitment.coverage.depositPct)commercialBlockers.push('Deposit percentage is not documented.');
  const blockingMessages=[...blockers.map(check=>`${check.label} is not ready.`),...commercialBlockers];
  const cautions=[];
  if(commitment.missingEstimateLabels.length)cautions.push(`Known cash plan excludes ${commitment.missingEstimateLabels.join(', ')} because no estimate was entered.`);
  if(commitment.depositPct===100&&commitment.productionSubtotal>0)cautions.push('The full production subtotal is modeled as due at deposit.');
  if(!checks.find(check=>check.id==='defectRemedy')?.addressed)cautions.push('No written defect / remake / credit remedy is documented.');
  if(!checks.find(check=>check.id==='inspectionPlan')?.addressed)cautions.push('No inspection / QC plan is documented.');
  const status=blockingMessages.length?'blocked':missing.length||cautions.length?'needs_review':'ready_for_internal_review';
  return {
    checks,addressed,totalChecks:checks.length,coveragePct:checks.length?addressed/checks.length*100:0,missing,blockers,blockingMessages,cautions,status,commitment,
    disclaimer:'This preflight checks documentation and cash exposure. It does not verify a factory, guarantee quality, or certify that a supplier is legitimate.'
  };
}

export function compareFactoryQuotes(quotes=[]){
  return (Array.isArray(quotes)?quotes:[]).map((quote,index)=>{
    const commitment=productionCommitment(quote);
    return {
      index,name:String(quote?.name||`Factory ${index+1}`).trim()||`Factory ${index+1}`,
      ...commitment,
      sampleLeadDays:provided(quote?.sampleLeadDays)?nonNegative(quote.sampleLeadDays):null,
      productionLeadDays:provided(quote?.productionLeadDays)?nonNegative(quote.productionLeadDays):null,
      notes:String(quote?.notes||'').trim()
    };
  });
}

export {CHECKS as PRODUCTION_PREFLIGHT_CHECKS};
