import {problemNavigator,problemNavigatorTarget} from './problem-navigator.js';

const $=selector=>document.querySelector(selector);

function modalParts(){
  const root=$('#modal');
  return {root,box:root?.querySelector('.modalbox')||null,body:$('#modalBody')};
}

function closeNavigator(){
  const {root}=modalParts();
  root?.classList.add('hidden');
}

function openNavigator(){
  const {root,box,body}=modalParts();
  if(!root||!box||!body)return;
  if(typeof window.msboCloseMenu==='function')window.msboCloseMenu({restoreFocus:false});
  box.classList.add('problemNavigatorModal');
  box.setAttribute('aria-label','Solve a business problem');
  body.innerHTML=problemNavigator();
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

function openProblemHelp(button){
  const view=String(button?.dataset.problemHelpView||'');
  const term=String(button?.dataset.problemHelpTerm||'');
  closeNavigator();
  $('#menuBtn')?.focus({preventScroll:true});
  requestAnimationFrame(()=>{
    if(typeof window.msboOpenHelp==='function')window.msboOpenHelp({view,term});
    else $('#learnBtn')?.click();
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
    const box=root.querySelector('.modalbox');
    box?.classList.remove('problemNavigatorModal');
    box?.setAttribute('aria-label','Brand OS dialog');
  }).observe(root,{attributes:true,attributeFilter:['class']});
}
