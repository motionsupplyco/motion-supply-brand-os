const $=selector=>document.querySelector(selector);

const CONTEXT={
  'Profit & Pricing':{
    decision:'Can one modeled order create enough contribution before acquisition?',
    needs:'Selling price, landed cost, and every variable order cost you actually know.',
    next:'Finish order costs before using contribution to set acquisition or discount decisions.',
    help:['profit','Contribution']
  },
  'Customer Acquisition Cost':{
    decision:'How much customer acquisition cost can the first order carry?',
    needs:'Product economics, your chosen post-CAC contribution floor, and observed or calculated CAC.',
    next:'Compare actual CAC with your own ceiling before increasing acquisition spend.',
    help:['cac','CAC']
  },
  'Store Funnel':{
    decision:'Which part of the store journey changed in the period you entered?',
    needs:'One consistent source and date range for sessions, carts, checkouts, and completed orders.',
    next:'Investigate the stage that changed; a rate change is evidence to inspect, not proof of the cause.',
    help:['funnel','']
  },
  'Discount Ceiling':{
    decision:'How deep can this offer go while preserving the contribution floor you chose?',
    needs:'Complete product economics, CAC, and any affiliate commission included in the offer.',
    next:'Test the exact promotion you plan to publish instead of borrowing a universal discount benchmark.',
    help:['discount','Contribution']
  },
  'Inventory & Reorder':{
    decision:'When does current inventory deserve a reorder review?',
    needs:'Actual demand pace, supplier lead time, on-hand, confirmed inbound, and allocated units.',
    next:'Treat the trigger as a review point; check cash and supplier terms before turning it into a PO.',
    help:['inventory','Reorder point']
  },
  'Launch & Break-Even':{
    decision:'How many contribution-positive orders are needed to recover the fixed launch cost you entered?',
    needs:'Product economics, CAC, and the fixed launch cost for the same launch scenario.',
    next:'Compare modeled break-even orders with your inventory and demand evidence without inventing demand.',
    help:['launch','Break-even orders']
  },
  'Cash Checkpoint':{
    decision:'How much operating cash is really available after the near-term obligations you entered?',
    needs:'Inflows and outflows from the same planning window plus the protected cash floor you choose.',
    next:'Carry this checkpoint into the PO Cash Gate before committing inventory cash.',
    help:['cash','Protected cash floor']
  },
  'PO Cash Gate':{
    decision:'Can this inventory commitment fit without crossing your protected operating cash floor?',
    needs:'A current cash checkpoint plus the proposed PO amount, deposit terms, and timing you actually know.',
    next:'If cash fits, still review demand quality and supplier terms before approving the purchase.',
    help:['po','Protected cash floor']
  },
  '3PL Decision':{
    decision:'At your modeled volume, how does a real 3PL quote compare with your real in-house fulfillment cost?',
    needs:'The quote terms, expected order volume, storage or minimum fees, and comparable in-house costs.',
    next:'Use normalized cost for the money question, then evaluate service quality separately.',
    help:['fulfillment','3PL']
  },
  'Wholesale Economics':{
    decision:'Does this wholesale deal leave enough unit contribution for your brand and workable retailer economics?',
    needs:'Wholesale price, product cost, commissions or fees, and the actual proposed deal terms.',
    next:'If the unit economics work, review inventory capacity and cash impact before accepting the order.',
    help:['wholesale','Gross margin']
  },
  'Shopify CSV Dashboard':{
    decision:'What actually happened in the Shopify export and date range you supplied?',
    needs:'Real Orders or Transaction History exports with a consistent period and source.',
    next:'Use the import as source-labeled commerce evidence; do not treat it as bookkeeping or accounting profit.',
    help:['shopify','AOV']
  },
  'Next Move Advisor':{
    decision:'Which unresolved operating decision deserves your attention first?',
    needs:'Enough real Brand OS inputs for the current model to distinguish known facts from missing data.',
    next:'Take one action, update the model with what changed, then reassess instead of chasing every signal at once.',
    help:['advisor','']
  }
};

function contextMarkup(title,context){
  return `<section id="workspaceDecisionContext" class="workspaceDecisionContext" aria-label="Decision context for ${title}">
    <div class="workspaceDecisionGrid">
      <div><span>DECISION</span><p>${context.decision}</p></div>
      <div><span>EVIDENCE NEEDED</span><p>${context.needs}</p></div>
      <div><span>NEXT HANDOFF</span><p>${context.next}</p></div>
    </div>
    <button id="workspaceDecisionHelp" type="button" class="workspaceDecisionHelp" data-workspace-help-view="${context.help[0]}" data-workspace-help-term="${context.help[1]}">Open guided help <span aria-hidden="true">→</span></button>
  </section>`;
}

function renderDecisionContext(){
  const title=$('#title')?.textContent.trim()||'';
  const context=CONTEXT[title];
  if(!context)return;
  const app=$('#app');
  if(!app||app.querySelector('#workspaceDecisionContext'))return;
  const head=app.querySelector('.toolhead');
  if(!head)return;
  head.insertAdjacentHTML('afterend',contextMarkup(title,context));
}

function openContextHelp(button){
  const view=String(button?.dataset.workspaceHelpView||'');
  const term=String(button?.dataset.workspaceHelpTerm||'');
  window.msboOpenHelp?.({view,term,returnFocusSelectors:['#workspaceDecisionHelp','#learnBtn','#menuBtn']});
}

document.addEventListener('click',event=>{
  const button=event.target.closest('#workspaceDecisionHelp');
  if(!button)return;
  event.preventDefault();
  openContextHelp(button);
});

let scheduled=false;
function scheduleRender(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    renderDecisionContext();
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleRender,{once:true});else scheduleRender();
new MutationObserver(scheduleRender).observe(document.querySelector('#app')||document.body,{subtree:true,childList:true});
