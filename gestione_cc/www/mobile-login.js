'use strict';
(() => {
 const form=document.getElementById('mobileLoginForm'),pin=document.getElementById('mobilePin'),error=document.getElementById('mobileLoginError'),button=document.getElementById('mobileLoginSubmit');
 pin.addEventListener('input',()=>{pin.value=pin.value.replace(/\D/g,'').slice(0,6);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();error.textContent='';
  if(!/^[0-9]{6}$/.test(pin.value)){error.textContent='Inserisci tutte le 6 cifre del PIN.';pin.focus();return;}
  button.disabled=true;button.textContent='Accesso in corso…';
  try{
   const response=await fetch('/api/mobile/login',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:pin.value})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Accesso non riuscito');
   location.replace('/mobile');
  }catch(e){error.textContent=e.message||'Errore di collegamento';pin.value='';pin.focus();}
  finally{button.disabled=false;button.textContent='Accedi';}
 });
})();