import {advisorGuidanceFor} from './advisor-guidance.js';
import {problemNavigatorTarget} from './problem-navigator.js';

const RESOURCES={
  'Set up product economics':[
    ['Shopify: Pricing your products','https://help.shopify.com/en/manual/products/details/product-pricing/determine-pricing']
  ],
  'Finish the acquisition model':[
    ['Shopify: Customer acquisition cost guide','https://www.shopify.com/blog/customer-acquisition-cost'],
    ['Shopify: Measuring marketing performance','https://help.shopify.com/en/manual/promoting-marketing/analyze-marketing/marketing-performance']
  ],
  'Stop scaling acquisition':[
    ['Shopify: Reduce customer acquisition cost','https://www.shopify.com/blog/ecommerce-customer-acquisition'],
    ['Shopify: Improve ecommerce conversion','https://www.shopify.com/blog/ecommerce-conversion-rate'],
    ['Shopify: Pricing your products','https://help.shopify.com/en/manual/products/details/product-pricing/determine-pricing']
  ],
  'Bring CAC back under the ceiling':[
    ['Shopify: Customer acquisition cost guide','https://www.shopify.com/blog/customer-acquisition-cost'],
    ['Shopify: Ecommerce customer acquisition','https://www.shopify.com/blog/ecommerce-customer-acquisition']
  ],
  'Protect cash':[
    ['SBA: Manage your finances','https://www.sba.gov/business-guide/manage-your-business/manage-your-finances']
  ],
  'Hold the proposed PO':[
    ['SBA: Manage your finances','https://www.sba.gov/business-guide/manage-your-business/manage-your-finances'],
    ['Shopify: Inventory management','https://www.shopify.com/blog/inventory-management']
  ],
  'Review the next reorder':[
    ['Shopify: Reorder point guide','https://www.shopify.com/blog/reorder-point'],
    ['Shopify: Inventory management','https://www.shopify.com/blog/inventory-management']
  ],
  'Protect the economics':[
    ['Shopify: Profit margin guide','https://www.shopify.com/blog/what-is-profit-margin'],
    ['Shopify: Pricing your products','https://help.shopify.com/en/manual/products/details/product-pricing/determine-pricing']
  ],
  'Review the 3PL quote in detail':[
    ['Shopify: Third-party logistics guide','https://www.shopify.com/blog/third-party-logistics-3pl']
  ],
  'Review the store pulse':[
    ['Shopify: Analytics and reports','https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports']
  ]
};

const SPECIAL_TARGETS=Object.freeze({'review-3pl':'#nav button[data-view="fulfillment"]'});

function trackResource(title,label,url){
  try{
    const anonymousId=localStorage.getItem('msbo_anon_id')||undefined;
    const rawSession=localStorage.getItem('msbo_session');
    const session=rawSession?JSON.parse(rawSession):null;
    fetch('/api/events',{
      method:'POST',
      headers:{'Content-Type':'application/json',...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{})},
      body:JSON.stringify({event_name:'advisor_resource_clicked',anonymous_id:anonymousId,properties:{recommendation:title,resource:label,url}})
    }).catch(()=>{});
  }catch{}
}

function advisorTarget(action){return problemNavigatorTarget(action)||SPECIAL_TARGETS[String(action||'')]||null}

function focusCurrentViewTitle(){
  const title=document.querySelector('#title');
  if(!title)return;
  const temporary=!title.hasAttribute('tabindex');
  if(temporary)title.setAttribute('tabindex','-1');
  title.focus({preventScroll:true});
  if(temporary)title.addEventListener('blur',()=>title.removeAttribute('tabindex'),{once:true});
}

function openAdvisorAction(guidance){
  const selector=advisorTarget(guidance?.action);
  const target=selector?document.querySelector(selector):null;
  if(!target)return;
  window.msboCloseMenu?.({restoreFocus:false});
  target.click();
  requestAnimationFrame(focusCurrentViewTitle);
}

function openAdvisorHelp(button,guidance){
  const context=guidance?.help||{};
  const returnFocusSelectors=[`#${button.id}`,'#menuBtn','#learnBtn'];
  if(typeof window.msboOpenHelp==='function'){
    window.msboOpenHelp({view:context.view||'',term:context.term||'',returnFocusSelectors});
    return;
  }
  document.querySelector('#learnBtn')?.click();
}

function addBrandOsGuidance(card,heading,guidance,index){
  if(!guidance||card.querySelector('[data-advisor-guidance]'))return;
  const box=document.createElement('div');
  box.dataset.advisorGuidance='true';
  box.className='advisorGuidance mt';

  const label=document.createElement('small');
  label.className='kicker';
  label.textContent='DO THIS IN BRAND OS';
  box.appendChild(label);

  const rationale=document.createElement('p');
  rationale.className='advisorGuidanceWhy';
  rationale.textContent=guidance.rationale;
  box.appendChild(rationale);

  const actions=document.createElement('div');
  actions.className='advisorGuidanceActions';

  const primary=document.createElement('button');
  primary.type='button';
  primary.className='primary';
  primary.dataset.advisorPrimary='true';
  primary.textContent=guidance.actionLabel;
  primary.addEventListener('click',()=>openAdvisorAction(guidance));
  actions.appendChild(primary);

  const help=document.createElement('button');
  help.type='button';
  help.className='outline';
  help.dataset.advisorHelp='true';
  help.id=`advisorHelp${index}`;
  help.textContent=guidance.helpLabel||'Explain this move';
  help.addEventListener('click',()=>openAdvisorHelp(help,guidance));
  actions.appendChild(help);

  box.appendChild(actions);
  card.appendChild(box);
}

function addOutsideResources(card,heading,resources){
  if(!resources?.length||card.querySelector('[data-advisor-resources]'))return;
  const box=document.createElement('div');
  box.dataset.advisorResources='true';
  box.className='advisorResources mt';

  const label=document.createElement('small');
  label.className='kicker';
  label.textContent='OPTIONAL OUTSIDE READING';
  box.appendChild(label);

  const note=document.createElement('p');
  note.className='muted';
  note.textContent='Use these vetted references after the Brand OS action above. They open in a new tab and do not change your model.';
  box.appendChild(note);

  const links=document.createElement('div');
  links.className='advisorResourceLinks';
  resources.forEach(([text,url])=>{
    const a=document.createElement('a');
    a.href=url;
    a.target='_blank';
    a.rel='noopener noreferrer';
    a.className='outline advisorResourceLink';
    a.textContent=`${text} ↗`;
    a.addEventListener('click',()=>trackResource(heading,text,url));
    links.appendChild(a);
  });
  box.appendChild(links);
  card.appendChild(box);
}

function enhanceAdvisor(){
  const title=document.querySelector('#title');
  const app=document.querySelector('#app');
  if(!title||!app||title.textContent.trim()!=='Next Move Advisor')return;

  [...app.querySelectorAll('.card')].forEach((card,index)=>{
    const heading=card.querySelector('h3')?.textContent?.trim();
    const guidance=advisorGuidanceFor(heading);
    if(!guidance)return;
    addBrandOsGuidance(card,heading,guidance,index);
    addOutsideResources(card,heading,RESOURCES[heading]);
  });
}

let scheduled=false;
const observer=new MutationObserver(()=>{
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;enhanceAdvisor()});
});
observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('DOMContentLoaded',enhanceAdvisor);
