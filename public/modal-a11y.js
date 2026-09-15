const root=document.querySelector('#modal');
const box=root?.querySelector('.modalbox');
const shell=document.querySelector('.shell');
let returnFocus=null;

function focusable(){
  if(!box)return [];
  return [...box.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter(el=>!el.disabled&&el.getAttribute('aria-hidden')!=='true'&&el.offsetParent!==null);
}

function modalOpen(){return Boolean(root&&!root.classList.contains('hidden'));}

function syncModalAccessibility(){
  if(!root||!box)return;
  const open=modalOpen();
  if(open){
    if(!returnFocus||!returnFocus.isConnected)returnFocus=document.activeElement;
    if(shell)shell.inert=true;
    requestAnimationFrame(()=>{
      if(!modalOpen())return;
      const preferred=box.querySelector('input:not([type="hidden"]),select,textarea,button:not(#closeModal),a[href]');
      (preferred||box).focus({preventScroll:true});
    });
  }else{
    if(shell)shell.inert=false;
    const target=returnFocus;
    returnFocus=null;
    if(target?.isConnected)requestAnimationFrame(()=>target.focus({preventScroll:true}));
  }
}

function trapModalFocus(event){
  if(event.key!=='Tab'||!modalOpen()||!box)return;
  const items=focusable();
  if(!items.length){event.preventDefault();box.focus({preventScroll:true});return;}
  const first=items[0],last=items[items.length-1],active=document.activeElement;
  if(event.shiftKey&&(active===first||!box.contains(active))){event.preventDefault();last.focus({preventScroll:true});}
  else if(!event.shiftKey&&(active===last||!box.contains(active))){event.preventDefault();first.focus({preventScroll:true});}
}

if(root&&box){
  new MutationObserver(syncModalAccessibility).observe(root,{attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',trapModalFocus);
  syncModalAccessibility();
}
