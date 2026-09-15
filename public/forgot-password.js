const email=document.querySelector('#recoveryEmail');
const button=document.querySelector('#recoverySend');
const message=document.querySelector('#recoveryMessage');

function setMessage(text){if(message)message.textContent=text}

async function sendRecovery(){
  const value=String(email?.value||'').trim().toLowerCase();
  if(!value){setMessage('Enter your email first.');email?.focus();return}
  button.disabled=true;
  setMessage('Sending recovery email…');
  try{
    const res=await fetch('/api/auth/recover',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:value})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);
    setMessage(data.message||'If that account exists, a recovery email has been sent.');
  }catch(error){
    setMessage(error?.message||'Recovery email could not be sent right now. Try again shortly.');
  }finally{
    button.disabled=false;
  }
}

button?.addEventListener('click',sendRecovery);
email?.addEventListener('keydown',event=>{if(event.key==='Enter')sendRecovery()});
