const ACTION_TARGETS={
  'fix-margin':'[data-profit-view="profitguardrails"]',
  'open-profit':'#nav button[data-view="profit"]',
  'test-price':'#nav button[data-view="profit"]',
  'check-discount':'#nav button[data-view="discount"]',
  'restock-plan':'[data-v2-view="reorderintel"]',
  'inventory-math':'#nav button[data-view="inventory"]',
  'diagnose-cac':'#nav button[data-view="cac"]',
  'acquisition-guardrail':'[data-profit-view="profitguardrails"]',
  'protect-cash':'[data-v2-view="cashforecast"]',
  'po-cash-gate':'#nav button[data-view="po"]',
  'stress-drop':'[data-collection-view="collectionstress"]',
  'production-preflight':'[data-production-view="preflight"]',
  'shopify-import':'#nav button[data-view="shopify"]',
  'integrations':'[data-v2-view="integrations"]',
  'business-health':'#nav button[data-view="dashboard"]',
  'next-move':'#nav button[data-view="advisor"]'
};

const PROBLEMS=[
  {
    id:'margin',icon:'↗',title:'Profit feels too low',
    happening:'Revenue can look healthy while product cost, fulfillment, fees, acquisition, or overhead leave too little behind.',
    why:'You need to separate order economics from period-level operating profit before deciding what to cut or scale.',
    term:'Contribution',explain:'Contribution is the money left after the costs tied to producing and fulfilling the sale. Brand OS keeps that separate from operating overhead and true operating profit.',
    actions:[['fix-margin','Fix My Margin','primary'],['open-profit','Open Profit & Pricing','outline']]
  },
  {
    id:'pricing',icon:'$',title:'I need to set or change a price',
    happening:'A price decision changes gross margin, contribution, discount room, break-even, and the CAC the order can support.',
    why:'Testing the economics before publishing the price is safer than trying to repair margin after customers are already buying.',
    term:'Contribution floor',explain:'Your contribution floor is the amount you choose to keep after variable order costs and, where modeled, acquisition. It is your guardrail—not an industry benchmark.',
    actions:[['test-price','Test New Price','primary'],['check-discount','Check Discount Ceiling','outline']]
  },
  {
    id:'inventory',icon:'□',title:'I do not know when to reorder',
    happening:'On-hand units alone do not tell you when to reorder. Demand pace, inbound stock, lead time, MOQ, and cash all matter.',
    why:'Ordering too late risks stockouts; ordering too early can trap cash in inventory. Brand OS keeps the reorder signal separate from the final PO decision.',
    term:'Reorder review point',explain:'This is the modeled inventory position where a reorder deserves review based on the demand and lead-time inputs you supplied. It is not an automatic purchase order.',
    actions:[['restock-plan','Build a Restock Plan','primary'],['inventory-math','Open Inventory Math','outline']]
  },
  {
    id:'acquisition',icon:'◎',title:'Ads are spending but I am not sure what is safe',
    happening:'CAC can look acceptable until product contribution, discounts, payment fees, returns, and the profit target are considered together.',
    why:'A spend decision should be compared with the contribution the acquired order can actually support—not revenue alone.',
    term:'CAC ceiling',explain:'The CAC ceiling is the maximum acquisition cost allowed by the economics and contribution target you entered. Brand OS does not claim that paid media caused all observed revenue.',
    actions:[['diagnose-cac','Diagnose Ad Spend','primary'],['acquisition-guardrail','Open Acquisition Guardrails','outline']]
  },
  {
    id:'cash',icon:'13',title:'I need to protect cash',
    happening:'A profitable plan can still create a cash crunch when deposits, balances, freight, marketing, payroll, or other outflows hit before cash comes back in.',
    why:'Timing matters. The important question is whether the modeled plan crosses the cash floor you chose to protect.',
    term:'Protected cash floor',explain:'This is the minimum operating cash balance you choose not to cross. Brand OS uses your floor; it does not invent a universal safe-cash benchmark.',
    actions:[['protect-cash','Protect My Cash','primary'],['po-cash-gate','Check a PO Against Cash','outline']]
  },
  {
    id:'drop',icon:'△',title:'I need to know if this drop is affordable',
    happening:'Units, landed cost, selling price, sell-through, returns, factory payment timing, and launch spend can make the same collection look very different under different scenarios.',
    why:'Stress-testing the drop before committing cash makes the tradeoffs visible without pretending demand is guaranteed.',
    term:'Sell-through scenario',explain:'A sell-through scenario is an explicit assumption about how much inventory sells. It is a planning case, not a forecast or promise of demand.',
    actions:[['stress-drop','Run Collection Scenario','primary'],['production-preflight','Open Production Preflight','outline']]
  },
  {
    id:'shopify',icon:'S',title:'I need to understand my Shopify numbers',
    happening:'Store exports and synced commerce observations can show sales activity, but they do not automatically contain every cost required for true profit.',
    why:'Brand OS separates observed commerce data from founder-controlled costs and assumptions so missing information stays missing instead of becoming fake certainty.',
    term:'Commerce observation',explain:'An observation is a value read from a connected or imported commerce source. It is not automatically an accounting metric or proof of causation.',
    actions:[['shopify-import','Review Shopify Numbers','primary'],['integrations','Open Integrations','outline']]
  },
  {
    id:'unknown',icon:'?',title:'I do not know what is wrong yet',
    happening:'When the problem is unclear, starting with one random calculator can send you toward the wrong fix.',
    why:'Start with the numbers you already supplied, then use the rule-based Next Move Advisor to surface the first decision that actually has evidence behind it.',
    term:'Evidence-backed next move',explain:'Brand OS only uses inputs or observations currently available in the app. Blank data stays blank, and the advisor does not invent a diagnosis.',
    actions:[['business-health','Show Me What Matters','primary'],['next-move','Open Next Move Advisor','outline']]
  }
];

const esc=value=>String(value??'').replace(/[&<>\'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

export function problemNavigatorTarget(action){return ACTION_TARGETS[String(action||'')]||null}

export function problemNavigator(){
  return `<div class="problemNavigator">
    <section class="problemHero">
      <div><span class="kicker">PROBLEM-FIRST OPERATING SYSTEM</span><h2>What are you trying to solve?</h2><p>Pick the decision that is costing you attention right now. Brand OS will send you to the existing tool built for that problem—using the inputs already in this session.</p></div>
      <div class="problemTruth"><b>No fake diagnosis.</b><span>Missing business data stays unknown. Choosing a path does not create or overwrite financial inputs.</span></div>
    </section>
    <section class="problemGrid" aria-label="Founder problems">
      ${PROBLEMS.map(problem=>`<article class="problemCard" data-problem-id="${esc(problem.id)}">
        <div class="problemCardHead"><span class="problemIcon" aria-hidden="true">${esc(problem.icon)}</span><h3>${esc(problem.title)}</h3></div>
        <div class="problemStep"><small>WHAT'S HAPPENING</small><p>${esc(problem.happening)}</p></div>
        <div class="problemStep"><small>WHY IT MATTERS</small><p>${esc(problem.why)}</p></div>
        <div class="problemStep actionStep"><small>WHAT TO DO</small><div class="problemActions">${problem.actions.map(([action,label,tone])=>`<button class="${tone}" type="button" data-problem-action="${esc(action)}">${esc(label)}</button>`).join('')}</div></div>
        <details class="problemExplain"><summary>Explain: ${esc(problem.term)}</summary><p>${esc(problem.explain)}</p></details>
      </article>`).join('')}
    </section>
  </div>`;
}
