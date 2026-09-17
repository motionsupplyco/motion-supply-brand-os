export const ADVISOR_GUIDANCE=Object.freeze({
  'Set up product economics':Object.freeze({
    action:'open-profit',actionLabel:'Open Profit & Pricing',
    rationale:'Build one real order first so contribution is based on your selling price and costs instead of a guess.',
    help:Object.freeze({view:'profit',term:'Contribution'}),helpLabel:'Explain contribution'
  }),
  'Finish the acquisition model':Object.freeze({
    action:'diagnose-cac',actionLabel:'Open Customer Acquisition',
    rationale:'Set the contribution you want left after acquisition, then compare that guardrail with the CAC you entered or calculated.',
    help:Object.freeze({view:'cac',term:'CAC'}),helpLabel:'Explain CAC'
  }),
  'Stop scaling acquisition':Object.freeze({
    action:'fix-margin',actionLabel:'Open Profit Guardrails',
    rationale:'The acquired order is contribution-negative in the current model. Review price, variable costs, offer depth and CAC before adding spend.',
    help:Object.freeze({view:'cac',term:'CAC'}),helpLabel:'Why stop scaling?'
  }),
  'Bring CAC back under the ceiling':Object.freeze({
    action:'acquisition-guardrail',actionLabel:'Open Acquisition Guardrails',
    rationale:'Use your own contribution target to see how much acquisition cost the order can support before more spend is approved.',
    help:Object.freeze({view:'cac',term:'CAC'}),helpLabel:'Explain the CAC ceiling'
  }),
  'Protect cash':Object.freeze({
    action:'protect-cash',actionLabel:'Open Cash Forecast',
    rationale:'Move from the quick checkpoint into timing: map when cash comes in and when obligations leave so the protected floor stays visible.',
    help:Object.freeze({view:'cash',term:'Protected cash floor'}),helpLabel:'Explain the cash floor'
  }),
  'Hold the proposed PO':Object.freeze({
    action:'po-cash-gate',actionLabel:'Open PO Cash Gate',
    rationale:'Review the deposit and remaining-payment timing against the cash floor you chose before committing the purchase order.',
    help:Object.freeze({view:'po',term:'Protected cash floor'}),helpLabel:'Why hold this PO?'
  }),
  'Review the next reorder':Object.freeze({
    action:'restock-plan',actionLabel:'Build a Restock Plan',
    rationale:'A reorder review point is a signal to investigate. Confirm demand, inbound units, supplier timing and cash before placing an order.',
    help:Object.freeze({view:'inventory',term:'Reorder point'}),helpLabel:'Explain the reorder point'
  }),
  'Protect the economics':Object.freeze({
    action:'fix-margin',actionLabel:'Open Profit Guardrails',
    rationale:'The model is currently contribution-positive. Keep the guardrail visible while testing discounts, acquisition pressure and changing costs.',
    help:Object.freeze({view:'profit',term:'Contribution'}),helpLabel:'Explain contribution'
  }),
  'Review the 3PL quote in detail':Object.freeze({
    action:'review-3pl',actionLabel:'Open 3PL Decision',
    rationale:'The cost-only comparison favors the 3PL in the current inputs, but service levels, minimums and transition risk still need a founder decision.',
    help:Object.freeze({view:'fulfillment',term:'3PL'}),helpLabel:'Explain the 3PL comparison'
  }),
  'Review the store pulse':Object.freeze({
    action:'shopify-import',actionLabel:'Open Shopify Import',
    rationale:'Use the imported period as an observation, then compare another period before calling a trend or changing the business because of one export.',
    help:Object.freeze({view:'shopify',term:''}),helpLabel:'How to read Shopify data'
  })
});

export function advisorGuidanceFor(title){return ADVISOR_GUIDANCE[String(title||'').trim()]||null}
