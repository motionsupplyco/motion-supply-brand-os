const qs=(selector,root=document)=>root.querySelector(selector);
const qsa=(selector,root=document)=>[...root.querySelectorAll(selector)];

function ensureSkipLink(){
  if(document.querySelector('.skipLink'))return;
  const link=document.createElement('a');
  link.className='skipLink';
  link.href='#mainContent';
  link.textContent='Skip to main content';
  document.body.prepend(link);
}

function ensureLandmarks(){
  const main=qs('main');
  if(main){
    main.id=main.id||'mainContent';
    main.tabIndex=-1;
  }
  const title=qs('#title');
  if(title){
    title.setAttribute('aria-live','polite');
    title.setAttribute('aria-atomic','true');
  }
  const app=qs('#app');
  if(app){
    app.setAttribute('role','region');
    app.setAttribute('aria-labelledby','title');
  }
}

function syncNavCurrent(){
  qsa('#nav button').forEach(button=>{
    if(button.classList.contains('active'))button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
}

function accessibleFieldId(input,index){
  const raw=input.dataset.key||input.name||input.id||`control-${index}`;
  return `msbo-field-${String(raw).replace(/[^a-zA-Z0-9_-]/g,'-')}`;
}

function labelGeneratedFields(root=document){
  qsa('.field',root).forEach((field,index)=>{
    const control=field.querySelector('input,select,textarea');
    const label=field.querySelector('label');
    if(!control||!label)return;
    if(!control.id)control.id=accessibleFieldId(control,index);
    label.htmlFor=control.id;
    const help=field.querySelector('small');
    if(help){
      if(!help.id)help.id=`${control.id}-help`;
      const existing=(control.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);
      if(!existing.includes(help.id))existing.push(help.id);
      control.setAttribute('aria-describedby',existing.join(' '));
    }
  });
}

function makeQuickActionsKeyboardAccessible(root=document){
  qsa('.actioncard[data-jump]',root).forEach(card=>{
    if(card.matches('button,a'))return;
    card.setAttribute('role','button');
    card.tabIndex=0;
    if(card.dataset.a11yKeybound==='true')return;
    card.dataset.a11yKeybound='true';
    card.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        card.click();
      }
    });
  });
}

function nameSpecialControls(root=document){
  const csv=qs('#csvFile',root);
  if(csv&&!csv.getAttribute('aria-label')&&!csv.getAttribute('aria-labelledby')){
    csv.setAttribute('aria-label','Choose Shopify CSV file');
  }
  const deleteConfirm=qs('#acctDeleteConfirm',root);
  if(deleteConfirm&&!deleteConfirm.getAttribute('aria-label')&&!deleteConfirm.getAttribute('aria-labelledby')){
    deleteConfirm.setAttribute('aria-label','Type DELETE to confirm account deletion');
  }
  qsa('table th',root).forEach(th=>{if(!th.hasAttribute('scope'))th.setAttribute('scope','col')});
}

function nameDialog(){
  const box=qs('#modal .modalbox');
  if(!box)return;
  const heading=box.querySelector('h1,h2,h3');
  if(heading){
    if(!heading.id)heading.id='msbo-dialog-title';
    box.setAttribute('aria-labelledby',heading.id);
    box.removeAttribute('aria-label');
  }else if(!box.hasAttribute('aria-label')){
    box.setAttribute('aria-label','Brand OS dialog');
  }
}

function applyAccessibility(root=document){
  ensureLandmarks();
  syncNavCurrent();
  labelGeneratedFields(root);
  makeQuickActionsKeyboardAccessible(root);
  nameSpecialControls(root);
  nameDialog();
}

function initAccessibility(){
  ensureSkipLink();
  applyAccessibility(document);
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='attributes'&&record.target.closest?.('#nav'))syncNavCurrent();
      if(record.type==='childList'){
        record.addedNodes.forEach(node=>{
          if(node.nodeType===Node.ELEMENT_NODE)applyAccessibility(node);
        });
        nameDialog();
      }
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAccessibility,{once:true});
else initAccessibility();

export {applyAccessibility,labelGeneratedFields,makeQuickActionsKeyboardAccessible,syncNavCurrent};
