'use strict';
(() => {
 let state=null,periodMode='month',selectedMonth=new Date().toISOString().slice(0,7),activeScreen='overview',hideAmounts=false,csrf='';
 const $=id=>document.getElementById(id),money=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
 const num=n=>Number.isFinite(Number(n))?Number(n):0;
 const dateKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const account=id=>state.accounts.find(a=>String(a.id)===String(id));
 const accountName=id=>account(id)?.name||'Da classificare';
 const isMortgage=a=>{let x=a,seen=new Set();while(x&&!seen.has(String(x.id))){seen.add(String(x.id));if(x.mortgage===true)return true;x=x.parentId?account(x.parentId):null;}return false;};
 const isExpense=a=>!!a&&(a.type==='EXPENSE'||(a.classification==='Patrimoniale'&&(a.includeInBudget===true||isMortgage(a))));
 function periodRange(){
  const [y,m]=selectedMonth.split('-').map(Number);
  if(periodMode==='month')return {start:y+'-'+String(m).padStart(2,'0')+'-01',end:y+'-'+String(m).padStart(2,'0')+'-'+String(new Date(y,m,0).getDate()).padStart(2,'0'),label:new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(y,m-1,1))};
  const endMonth=y===new Date().getFullYear()?new Date().getMonth()+1:12;
  return {start:y+'-01-01',end:y+'-'+String(endMonth).padStart(2,'0')+'-'+String(new Date(y,endMonth,0).getDate()).padStart(2,'0'),label:'Anno '+y};
 }
 function transactionsIn(range){const f=state.reportAccountId||state.bankAccountId||'all';return state.transactions.filter(t=>t.date>=range.start&&t.date<=range.end&&t.status!=='duplicate'&&(f==='all'||!f||String(t.bankAccountId)===String(f)));}
 function flowTotals(rows){let income=0,expense=0;for(const t of rows){if(num(t.amount)>0)income+=num(t.amount);else expense+=Math.abs(num(t.amount));}return{income,expense,net:income-expense};}
 function expenseTotals(rows){
  const totals=new Map();
  const add=(id,value)=>{let a=account(id),seen=new Set();while(a&&!seen.has(String(a.id))){seen.add(String(a.id));if(isExpense(a))totals.set(String(a.id),(totals.get(String(a.id))||0)+Math.abs(num(value)));a=a.parentId?account(a.parentId):null;}};
  for(const t of rows){if(Array.isArray(t.counterpartSplits)&&t.counterpartSplits.length)t.counterpartSplits.forEach(s=>add(s.accountId,s.value));else add(t.counterpartAccountId,t.amount);}
  return [...totals.entries()].map(([id,value])=>({id,name:accountName(id),value})).sort((a,b)=>b.value-a.value);
 }
 function balanceFor(filter,cutoff){const base=filter==='all'||String(filter)===String(state.bankAccountId)?num(state.openingBalance):0;return base+state.transactions.filter(t=>t.date<=cutoff&&t.status!=='duplicate'&&(filter==='all'||String(t.bankAccountId)===String(filter))).reduce((sum,t)=>sum+num(t.amount),0);}
 function previousPeriodRows(){
  const [y,m]=selectedMonth.split('-').map(Number),today=new Date();
  return [1,2,3].map(back=>{
   let start,end,label;
   if(periodMode==='month'){const yy=y-back;start=yy+'-'+String(m).padStart(2,'0')+'-01';end=yy+'-'+String(m).padStart(2,'0')+'-'+String(new Date(yy,m,0).getDate()).padStart(2,'0');label=String(yy);}
   else {const yy=y-back;start=yy+'-01-01';end=yy+'-12-31';label=String(yy);}
   const rows=transactionsIn({start,end});return{label,data:flowTotals(rows)};
  });
 }
 function setMoney(el,value){el.textContent=money.format(value);el.classList.toggle('masked',hideAmounts);}
 function render(){
  const range=periodRange(),rows=transactionsIn(range),totals=flowTotals(rows),now=dateKey(new Date()),cutoff=range.end>now?now:range.end;
  $('periodLabel').textContent=range.label;$('periodNext').disabled=selectedMonth>=now.slice(0,7);
  $('periodPrev').disabled=false;
  setMoney($('balanceValue'),balanceFor(state.reportAccountId||state.bankAccountId||'all',cutoff));
  setMoney($('incomeValue'),totals.income);setMoney($('expenseValue'),totals.expense);setMoney($('netValue'),totals.net);
  $('incomeCompare').textContent='Nel periodo selezionato';$('expenseCompare').textContent='Nel periodo selezionato';
  $('accountCaption').textContent=state.reportAccountId==='all'?'Tutti i conti liquidi':accountName(state.reportAccountId||state.bankAccountId);
  $('asOfCaption').textContent='Aggiornato al '+new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(cutoff+'T12:00:00'));
  const max=Math.max(1,totals.income,totals.expense);
  $('flowBars').innerHTML=[['Entrate',totals.income,'income'],['Uscite',totals.expense,'expense']].map(([label,value,kind])=>'<div class="flow-row"><span>'+label+'</span><div class="flow-track"><div class="flow-fill '+kind+'" style="width:'+Math.max(value?2:0,value/max*100)+'%"></div></div><strong class="money">'+money.format(value)+'</strong></div>').join('');
  const recent=[...rows].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
  $('recentTransactions').innerHTML=recent.length?recent.map(transactionHtml).join(''):'<div class="empty">Nessun movimento nel periodo</div>';
  renderCategories(rows);renderComparison(totals);renderTransactions(rows);renderAccounts(cutoff);applyPrivacy();
 }
 function transactionHtml(t){
  const title=t.description||t.payee||t.causale||'Movimento';
  const category=t.counterpartSplits?.length?'Movimento ripartito':accountName(t.counterpartAccountId);
  const sign=num(t.amount)>=0?'+':'−';
  return '<div class="transaction-row"><div><div class="tx-title">'+esc(title)+'</div><div class="tx-meta">'+esc(t.date||'')+' · '+esc(category)+(t.status==='pending'?' · Da classificare':'')+'</div></div><strong class="tx-amount '+(num(t.amount)>=0?'amount-in':'amount-out')+'">'+sign+money.format(Math.abs(num(t.amount)))+'</strong></div>';
 }
 function renderCategories(rows){
  const cats=expenseTotals(rows),total=cats.reduce((s,c)=>s+c.value,0),top=cats.slice(0,12);
  $('categoryList').innerHTML=top.length?top.map(c=>'<div class="category-item"><div class="category-top"><span>'+esc(c.name)+'</span><strong class="money">'+money.format(c.value)+'</strong></div><span class="category-share">'+(total?Math.round(c.value/total*100):0)+'% delle uscite</span><div class="category-track"><div class="category-fill" style="width:'+(total?c.value/total*100:0)+'%"></div></div></div>').join(''):'<div class="empty">Nessuna spesa categorizzata nel periodo</div>';
 }
 function renderComparison(current){
  const previous=previousPeriodRows();
  $('expenseComparison').innerHTML=previous.map(p=>'<div class="comparison-row"><span>'+p.label+'</span><strong class="money">'+money.format(p.data.expense)+'</strong></div>').join('')||'<div class="empty">Dati di confronto non disponibili</div>';
 }
 function renderTransactions(rows){
  const filter=$('transactionFilter').value;
  const filtered=rows.filter(t=>filter==='all'||(filter==='income'&&num(t.amount)>0)||(filter==='expense'&&num(t.amount)<0)||(filter==='pending'&&t.status==='pending')).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $('transactionCount').textContent=filtered.length+' movimenti';
  $('transactionList').innerHTML=filtered.length?filtered.map(transactionHtml).join(''):'<div class="empty">Nessun movimento corrispondente</div>';
 }
 function renderAccounts(cutoff){
  const accounts=state.accounts.filter(a=>['BANK','CASH','ASSET'].includes(a.type)&&!a.parentId||(['BANK','CASH'].includes(a.type)&&a.hierarchyType!=='Mastro'));
  const rows=accounts.filter(a=>!a.parentId||a.hierarchyType==='Conto'||a.hierarchyType==='Mastro e conto');
  $('accountList').innerHTML=rows.map(a=>'<div class="account-row"><span>'+esc(a.path||a.name)+'</span><strong class="money">'+money.format(balanceFor(a.id,cutoff))+'</strong></div>').join('')||'<div class="empty">Nessun conto disponibile</div>';
 }
 function applyPrivacy(){document.querySelectorAll('.money').forEach(el=>el.classList.toggle('masked',hideAmounts));$('privacyButton').textContent=hideAmounts?'◎':'◉';$('privacyButton').setAttribute('aria-label',hideAmounts?'Mostra importi':'Nascondi importi');}
 function setScreen(name){activeScreen=name;document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id==='screen-'+name));document.querySelectorAll('.bottom-item').forEach(el=>el.classList.toggle('active',el.dataset.screen===name));window.scrollTo({top:0,behavior:'smooth'});}
 function setPeriod(mode){periodMode=mode;document.querySelectorAll('.period-tab').forEach(el=>el.classList.toggle('active',el.dataset.period===mode));render();}
 function shiftPeriod(delta){const [y,m]=selectedMonth.split('-').map(Number),d=new Date(y,m-1+(periodMode==='year'?delta*12:delta),1);selectedMonth=dateKey(d).slice(0,7);if(selectedMonth>new Date().toISOString().slice(0,7))selectedMonth=new Date().toISOString().slice(0,7);render();}
 async function logout(){try{await fetch('/api/mobile/logout',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:'{}'});}finally{location.replace('/mobile/login');}}
 async function init(){
  try{
   const response=await fetch('/api/mobile/state',{credentials:'same-origin',cache:'no-store'});
   if(response.status===401){location.replace('/mobile/login');return;}
   if(!response.ok)throw new Error('Errore server ('+response.status+')');
   const data=await response.json();state=data.state;csrf=data.csrf||'';
   if(!state)throw new Error('Archivio non inizializzato.');
   $('mobileLoading').hidden=true;$('mobileApp').hidden=false;
   document.querySelectorAll('[data-screen]').forEach(el=>el.addEventListener('click',()=>setScreen(el.dataset.screen)));
   document.querySelectorAll('[data-period]').forEach(el=>el.addEventListener('click',()=>setPeriod(el.dataset.period)));
   $('periodPrev').addEventListener('click',()=>shiftPeriod(-1));$('periodNext').addEventListener('click',()=>shiftPeriod(1));
   $('transactionFilter').addEventListener('change',()=>renderTransactions(transactionsIn(periodRange())));
   $('privacyButton').addEventListener('click',()=>{hideAmounts=!hideAmounts;applyPrivacy();});
   $('logoutButton').addEventListener('click',logout);
   if('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(()=>{});
   $('retryMobile').addEventListener('click',()=>location.reload());
   render();
  }catch(e){$('mobileLoading').hidden=true;$('mobileError').hidden=false;$('mobileErrorText').textContent=e.message||String(e);}
 }
 document.addEventListener('DOMContentLoaded',init);
})();