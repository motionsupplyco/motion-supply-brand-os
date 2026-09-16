const $=selector=>document.querySelector(selector);

const LOOP=[
  {
    id:'economics',
    step:'01',
    label:'MAKE MONEY',
    title:'Economics first',
    question:'Can each order support the business?',
    input:'Price, landed cost, order costs, CAC',
    decision:'Price, offer depth, acquisition ceiling',
    actions:[
      ['Profit & Pricing','#nav button[data-view="profit"]'],
      ['Profit Guardrails','[data-profit-view="profitguardrails"]']
    ]
  },
  {
    id:'demand',
    step:'02',
    label:'READ DEMAND',
    title:'Read what happened',
    question:'What did shoppers actually do?',
    input:'Sessions, orders, store imports',
    decision:'Where to investigate before changing spend',
    actions:[
      ['Store Funnel','#nav button[data-view="funnel"]'],
      ['Shopify Import','#nav button[data-view="shopify"]']
    ]
  },
  {
    id:'cash',
    step:'03',
    label:'PROTECT CASH',
    title:'Commit with context',
    question:'Can inventory or production fit the cash plan?',
    input:'Demand, lead time, cash floor, supplier terms',
    decision:'Reorder review, timing, PO or production commitment',
    actions:[
      ['Reorder Intelligence','[data-v2-view="reorderintel"]'],
      ['Cash Forecast','[data-v2-view="cashforecast"]']
    ]
  },
  {
    id:'decision',
    step:'04',
    label:'DECIDE NEXT',
    title:'Choose the next move',
    question:'What deserves attention before everything else?',
    input:'Your completed model and operating signals',
    decision:'One prioritized operating action',
    actions:[
      ['Operating Alerts','[data-v2-view="operatingalerts"]'],
      ['Next Move','#nav button[data-view="advisor"]']
    ]
  }
];

function loopMarkup(){
  return `<section id="guidedOperatingLoop" class="guidedOperatingLoop" aria-labelledby="guidedLoopTitle" data-guided-signature="founder-operating-loop-v1">
    <div class="guidedLoopHead">
      <div>
        <span class="kicker">FOUNDER OPERATING LOOP</span>
        <h3 id="guidedLoopTitle">Work the business in sequence, not tool by tool.</h3>
        <p>Use this rail when you are not sure where to go next. It creates no score and no new business numbers — each step opens the existing Brand OS workspace that owns the decision.</p>
      </div>
      <button type="button" class="outline guidedSolve" data-guided-route="#problemNav">Solve a specific problem</button>
    </div>
    <div class="guidedLoopGrid">
      ${LOOP.map(stage=>`<article class="guidedStage" data-guided-stage="${stage.id}">
        <div class="guidedStageTop"><span class="guidedStep">${stage.step}</span><span class="guidedLabel">${stage.label}</span></div>
        <h4>${stage.title}</h4>
        <p class="guidedQuestion">${stage.question}</p>
        <dl>
          <div><dt>INPUT</dt><dd>${stage.input}</dd></div>
          <div><dt>DECISION</dt><dd>${stage.decision}</dd></div>
        </dl>
        <div class="guidedActions">
          ${stage.actions.map(([label,selector])=>`<button type="button" data-guided-route="${selector.replaceAll('"','&quot;')}">${label}<span aria-hidden="true">→</span></button>`).join('')}
        </div>
      </article>`).join('')}
    </div>
  </section>`;
}

function dashboardVisible(){
  return $('#title')?.textContent.trim()==='Business Health';
}

function renderGuidedLoop(){
  if(!dashboardVisible())return;
  const app=$('#app');
  if(!app)return;
  const intro=app.querySelector('.dashboardIntro');
  if(!intro)return;
  if(app.querySelector('#guidedOperatingLoop'))return;
  intro.insertAdjacentHTML('afterend',loopMarkup());
}

function routeTo(selector){
  if(!selector)return;
  let target=null;
  try{target=$(selector)}catch{return}
  if(!target)return;
  target.click();
}

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-guided-route]');
  if(!button)return;
  event.preventDefault();
  routeTo(button.dataset.guidedRoute||'');
});

let scheduled=false;
function scheduleRender(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    renderGuidedLoop();
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleRender,{once:true});else scheduleRender();
new MutationObserver(scheduleRender).observe(document.querySelector('#app')||document.body,{subtree:true,childList:true});
