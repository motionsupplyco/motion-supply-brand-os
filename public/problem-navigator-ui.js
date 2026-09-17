import {problemNavigator,problemNavigatorTarget} from './problem-navigator.js';

const $=selector=>document.querySelector(selector);

function modalParts(){
  const root=$('#modal');
  return {root,box:root?.querySelector('.modalbox')||null,body:$('#modalBody')};
}

function closeNavigator(){
  const {root}=modalParts();
  root?.classList.add('hidden');
  document.body.classList.remove('problemNavigatorOpen');
}

function openNavigator(){
  const {root,box,body}=modalParts();
  if(!root||!box||!body)return;
  if(typeof window.msboCloseMenu==='function')window.msboCloseMenu({restoreFocus:false});
  box.classList.add('problemNavigatorModal');
  box.setAttribute('aria-label','Solve a business problem');
  body.innerHTML=problemNavigator();
  document.body.classList.add('problemNavigatorOpen');
  root.classList.remove('hidden');
}

function openAction(action){
  const selector=problemNavigatorTarget(action);
  const target=selector?$(selector):null;
  if(!target)return;
  closeNavigator();
  requestAnimationFrame(()=>{
    target.click();
    requestAnimationFrame(()=>$('#menuBtn')?.focus({preventScroll:true}));
  });
}

function problemHelpReturnFocusSelectors(){
  return ['#problemNav','#menuBtn','#learnBtn'];
}

function firstVisibleControl(selectors){
  for(const selector of selectors){
    const target=$(selector);
    if(!target?.isConnected||target.disabled||target.closest('[inert]'))continue;
    const rect=target.getBoundingClientRect();
    if(rect.width>0&&rect.height>0&&rect.bottom>0&&rect.right>0&&rect.top<window.innerHeight&&rect.left<window.innerWidth)return target;
  }
  return null;
}

function openProblemHelp(button){
  const view=String(button?.dataset.problemHelpView||'');
  const term=String(button?.dataset.problemHelpTerm||'');
  const returnFocusSelectors=problemHelpReturnFocusSelectors();
  closeNavigator();
  requestAnimationFrame(()=>{
    if(typeof window.msboOpenHelp==='function')window.msboOpenHelp({view,term,returnFocusSelectors});
    else{
      firstVisibleControl(returnFocusSelectors)?.focus({preventScroll:true});
      $('#learnBtn')?.click();
    }
  });
}

document.addEventListener('click',event=>{
  if(event.target.closest('#problemNav')){
    event.preventDefault();
    openNavigator();
    return;
  }
  const help=event.target.closest('[data-problem-help-view]');
  if(help){
    event.preventDefault();
    openProblemHelp(help);
    return;
  }
  const action=event.target.closest('[data-problem-action]');
  if(!action)return;
  event.preventDefault();
  openAction(action.dataset.problemAction);
});

const root=$('#modal');
if(root){
  new MutationObserver(()=>{
    if(!root.classList.contains('hidden'))return;
    document.body.classList.remove('problemNavigatorOpen');
    const box=root.querySelector('.modalbox');
    box?.classList.remove('problemNavigatorModal');
    box?.setAttribute('aria-label','Brand OS dialog');
  }).observe(root,{attributes:true,attributeFilter:['class']});
}
