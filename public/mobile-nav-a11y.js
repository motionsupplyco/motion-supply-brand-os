const side=document.querySelector('#side');
const trigger=document.querySelector('#menuBtn');
const mobileQuery=window.matchMedia('(max-width:820px)');

function isOpen(){
  return Boolean(side?.classList.contains('open'));
}

function focusableInMenu(){
  if(!side)return [];
  return [...side.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter(el=>!el.disabled&&el.getAttribute('aria-hidden')!=='true');
}

function syncDrawerAccessibility(){
  if(!side)return;
  const mobile=mobileQuery.matches;
  const open=isOpen();
  if(mobile&&!open){
    side.inert=true;
    side.setAttribute('aria-hidden','true');
  }else{
    side.inert=false;
    side.removeAttribute('aria-hidden');
  }
  if(trigger)trigger.setAttribute('aria-expanded',String(mobile&&open));
}

function trapDrawerFocus(event){
  if(event.key!=='Tab'||!mobileQuery.matches||!isOpen()||!side)return;
  const focusable=focusableInMenu();
  if(!focusable.length){
    event.preventDefault();
    return;
  }
  const first=focusable[0];
  const last=focusable[focusable.length-1];
  const active=document.activeElement;
  if(event.shiftKey&&(active===first||!side.contains(active))){
    event.preventDefault();
    last.focus({preventScroll:true});
  }else if(!event.shiftKey&&(active===last||!side.contains(active))){
    event.preventDefault();
    first.focus({preventScroll:true});
  }
}

if(side){
  new MutationObserver(syncDrawerAccessibility).observe(side,{attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',trapDrawerFocus);
  if(typeof mobileQuery.addEventListener==='function')mobileQuery.addEventListener('change',syncDrawerAccessibility);
  else if(typeof mobileQuery.addListener==='function')mobileQuery.addListener(syncDrawerAccessibility);
  syncDrawerAccessibility();
}
