/* Mis Décimos - primera versión. Datos locales en IndexedDB. */
const DB_NAME = 'mis-decimos-db';
const DB_VERSION = 1; // No cambia el esquema: drawId ya relaciona cada número con su sorteo.
const STORES = ['draws','numbers','purchases','owners','shares'];
let db;
let currentDrawId = null;
let currentNumberId = null;
let toastTimer;

const $ = id => document.getElementById(id);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const today = () => new Date().toISOString().slice(0,10);
const eur = n => (Number(n)||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
const cents = n => Math.round((Number(n)||0)*100)/100;

function toast(message){
  const el=$('toast'); el.textContent=message; el.style.display='block';
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.style.display='none',3000);
}
function openDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{
   const d=req.result;
   if(!d.objectStoreNames.contains('draws')) d.createObjectStore('draws',{keyPath:'id'});
   if(!d.objectStoreNames.contains('numbers')){const s=d.createObjectStore('numbers',{keyPath:'id'});s.createIndex('drawId','drawId',{unique:false});}
   if(!d.objectStoreNames.contains('purchases')){const s=d.createObjectStore('purchases',{keyPath:'id'});s.createIndex('numberId','numberId',{unique:false});}
   if(!d.objectStoreNames.contains('owners')) d.createObjectStore('owners',{keyPath:'id'});
   if(!d.objectStoreNames.contains('shares')){const s=d.createObjectStore('shares',{keyPath:'id'});s.createIndex('numberId','numberId',{unique:false});s.createIndex('ownerId','ownerId',{unique:false});}
  };
  req.onsuccess=()=>{db=req.result;resolve(db)};req.onerror=()=>reject(req.error);
 });
}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
function all(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function get(store,id){return new Promise((res,rej)=>{const r=tx(store).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(store,value){return new Promise((res,rej)=>{const r=tx(store,'readwrite').put(value);r.onsuccess=()=>res(value);r.onerror=()=>rej(r.error)})}
function del(store,id){return new Promise((res,rej)=>{const r=tx(store,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function clearStore(store){return new Promise((res,rej)=>{const r=tx(store,'readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function queryIndex(store,index,value){return new Promise((res,rej)=>{const r=tx(store).index(index).getAll(value);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}

async function init(){
 await openDB();
 let draws=await all('draws');
 const year=new Date().getFullYear();
 if(!draws.some(d=>d.year===year)){const d={id:uid(),year,name:`Lotería de Navidad ${year}`,drawDate:`${year}-12-22`};await put('draws',d);draws.push(d)}
 currentDrawId=(draws.find(d=>d.year===year)||draws.sort((a,b)=>b.year-a.year)[0]).id;
 await refreshAll();
 if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
async function selectedDraw(){return get('draws',currentDrawId)}
async function drawNumbers(){return (await queryIndex('numbers','drawId',currentDrawId)).sort((a,b)=>a.number.localeCompare(b.number))}
async function purchasesFor(numberId){return queryIndex('purchases','numberId',numberId)}
async function sharesFor(numberId){return queryIndex('shares','numberId',numberId)}
async function ownerFor(ownerId){return get('owners',ownerId)}
function purchaseTotals(purchases){
 return purchases.reduce((t,p)=>({cost:cents(t.cost+p.quantity*p.price),played:cents(t.played+p.quantity*p.played),whole:t.whole+(p.type==='whole'?p.quantity:0),participations:t.participations+(p.type==='participation'?p.quantity:0)}),{cost:0,played:0,whole:0,participations:0});
}
async function numberTotals(numberId){return purchaseTotals(await purchasesFor(numberId))}
async function shareState(share,totalCost){
 const due=cents(totalCost*(share.costPercentage ?? share.percentage)/100);
 const paid=cents(Math.min(share.paidAmount||0,due));
 const pending=cents(Math.max(0,due-paid));
 const status=due<=0?'zero':pending<=0?'paid':paid>0?'partial':'pending';
 return {due,paid,pending,status};
}
function statusPill(status){const labels={paid:'Pagado',pending:'Pendiente',partial:'Pago parcial',zero:'No tiene que pagar'};return `<span class="pill ${status}">${labels[status]||status}</span>`}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function refreshAll(){
 const numbers=await drawNumbers();const owners=await all('owners');
 let myCost=0,myPlayed=0,pending=0;
 for(const n of numbers){
  const ps=await purchasesFor(n.id),tot=purchaseTotals(ps),shares=await sharesFor(n.id);
  const mineCostPct=Math.max(0,100-shares.filter(s=>!s.isMe).reduce((sum,s)=>sum+(s.costPercentage ?? s.percentage),0));
  myCost+=tot.cost*mineCostPct/100;myPlayed+=tot.played*mineCostPct/100;
  for(const s of shares){if(!s.isMe){const state=await shareState({...s,costPercentage:s.costPercentage ?? s.percentage},tot.cost);pending+=state.pending}}
 }
 $('statMine').textContent=eur(myCost);$('statPlayed').textContent=eur(myPlayed);$('statNumbers').textContent=numbers.length;$('statPending').textContent=eur(pending);
 $('homeNumbers').innerHTML=numbers.length?numbers.map(n=>numberCard(n)).join(''):'<div class="empty">Todavía no has registrado números.<br>Añade el primero para empezar.</div>';
 $('numberList').innerHTML=numbers.length?numbers.map(n=>numberCard(n)).join(''):'<div class="empty">No hay números para este sorteo.</div>';
 $('ownerList').innerHTML=owners.length?owners.map(o=>`<div class="item"><div class="itemhead"><div><b>${esc(o.name)}</b><div class="smalltext">${esc(o.notes||'')}</div></div><button class="secondary small" onclick="deleteOwner('${o.id}')">Eliminar</button></div></div>`).join(''):'<div class="empty">Añade aquí a las personas con las que compartes números.</div>';
 const draws=(await all('draws')).slice().sort((a,b)=>b.year-a.year);
 const drawOptions=draws.map(d=>`<option value="${d.id}" ${d.id===currentDrawId?'selected':''}>${esc(d.name)}</option>`).join('');
 for(const selectorId of ['drawYear','drawSelectHome','drawSelectNumbers']){
  const selector=$(selectorId);if(selector)selector.innerHTML=drawOptions;
 }
 const numberDraw=$('numberDraw');if(numberDraw){const selected=numberDraw.value||currentDrawId;numberDraw.innerHTML=draws.map(d=>`<option value="${d.id}" ${d.id===selected?'selected':''}>${esc(d.name)}</option>`).join('');}
}
function numberCard(n){
 return `<div class="item"><div class="itemhead"><div style="min-width:0"><div class="number">${esc(n.number)}</div><div class="smalltext">${esc(n.notes||'Sin notas')}</div></div><button class="secondary small" onclick="openDetail('${n.id}')">Ver detalle →</button></div></div>`;
}
function showView(id){
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
 if(id==='home'||id==='numbers'||id==='owners'||id==='settings')refreshAll();
 window.scrollTo({top:0,behavior:'smooth'});
}
async function changeDraw(){
 const id=$('drawYear').value;if(id)currentDrawId=id;await refreshAll();showView('home');toast('Sorteo seleccionado');
}
async function selectDrawFromTab(id){
 if(!id||id===currentDrawId)return;
 currentDrawId=id;
 await refreshAll();
 toast('Sorteo cambiado');
}
function toggleDrawForm(force){
 const wrap=$('drawFormWrap');const shouldShow=typeof force==='boolean'?force:wrap.classList.contains('hidden');
 wrap.classList.toggle('hidden',!shouldShow);
 if(shouldShow){$('newDrawName').dataset.edited='';$('newDrawYear').value=new Date().getFullYear()+1;$('newDrawName').value=`Lotería de Navidad ${$('newDrawYear').value}`;$('newDrawDate').value=`${$('newDrawYear').value}-12-22`;}
}
$('newDrawYear').addEventListener('input',()=>{const year=$('newDrawYear').value;if(!$('newDrawName').dataset.edited)$('newDrawName').value=year?`Lotería de Navidad ${year}`:'';if(/^\d{4}$/.test(year))$('newDrawDate').value=`${year}-12-22`;});
$('newDrawName').addEventListener('input',()=>{$('newDrawName').dataset.edited='1'});
$('drawForm').addEventListener('submit',async e=>{
 e.preventDefault();const year=Number($('newDrawYear').value);let name=$('newDrawName').value.trim();const drawDate=$('newDrawDate').value||'';
 if(!Number.isInteger(year)||year<1900||year>2200){toast('Introduce un año válido.');return}
 const draws=await all('draws');if(draws.some(d=>d.year===year&&d.name.toLocaleLowerCase()===name.toLocaleLowerCase())){toast('Ya existe un sorteo con ese nombre y año.');return}
 if(!name)name=`Lotería de Navidad ${year}`;const d={id:uid(),year,name,drawDate,createdAt:new Date().toISOString()};await put('draws',d);currentDrawId=d.id;$('newDrawName').dataset.edited='';toggleDrawForm(false);await refreshAll();showView('home');toast('Nuevo sorteo creado. Los números nuevos se vincularán a este sorteo.');
});
async function openNumberForm(id=null){
 const n=id?await get('numbers',id):null;
 $('editNumberId').value=n?.id||'';$('numValue').value=n?.number||'';$('numNotes').value=n?.notes||'';
 $('numberFormTitle').textContent=n?'Editar número':'Añadir número';
 await refreshAll();$('numberDraw').value=n?.drawId||currentDrawId;showView('numberFormView');
}
$('numberForm').addEventListener('submit',async e=>{
 e.preventDefault();const number=$('numValue').value.trim();if(!/^\d{5}$/.test(number)){toast('Introduce exactamente cinco cifras.');return}
 const id=$('editNumberId').value;const drawId=$('numberDraw').value;if(!drawId){toast('Selecciona el sorteo.');return}
 const existing=(await queryIndex('numbers','drawId',drawId)).find(n=>n.number===number&&n.id!==id);
 if(existing){toast('Ese número ya está registrado en este sorteo.');return}
 const n={id:id||uid(),drawId,number,notes:$('numNotes').value.trim(),updatedAt:new Date().toISOString()};
 await put('numbers',n);currentNumberId=n.id;currentDrawId=drawId;await refreshAll();openDetail(n.id);toast('Número guardado en el sorteo seleccionado');
});
async function openDetail(id){
 currentNumberId=id;const n=await get('numbers',id);if(!n)return showView('numbers');
 const d=await get('draws',n.drawId);const totals=await numberTotals(id);
 $('detailYear').textContent=d?.name||'';$('detailNumber').textContent=n.number;$('detailNotes').textContent=n.notes||'';
 $('detailCost').textContent=eur(totals.cost);
 const shares=await sharesFor(id);
 const mineCostPct=Math.max(0,100-shares.filter(s=>!s.isMe).reduce((sum,s)=>sum+(s.costPercentage ?? s.percentage),0));
 $('detailMine').textContent=eur(totals.cost*mineCostPct/100);
 const purchases=await purchasesFor(id);
 $('purchaseList').innerHTML=purchases.length?purchases.map(p=>`<div class="item"><div class="itemhead"><div><b>${p.type==='whole'?'Décimo entero':'Participación'} · ${p.quantity} ud.</b><div class="smalltext">${p.date?esc(p.date)+' · ':''}${esc(p.seller||'')}${p.notes?' · '+esc(p.notes):''}</div><div class="smalltext">Juega ${eur(p.played)} por unidad</div></div><div style="text-align:right"><div class="money">${eur(p.quantity*p.price)}</div><button class="secondary small" onclick="editPurchase('${p.id}')">Editar</button> <button class="danger small" onclick="deletePurchase('${p.id}')">×</button></div></div></div>`).join(''):'<div class="empty">Aún no hay compras registradas.</div>';
 await renderShares(id,totals.cost);showView('detail');
}
async function renderShares(numberId,cost){
 const shares=await sharesFor(numberId);const owners=await all('owners');
 const otherShares=shares.filter(s=>!s.isMe);
 const myPrizePct=Math.max(0,100-otherShares.reduce((sum,s)=>sum+s.percentage,0));
 const myCostPct=Math.max(0,100-otherShares.reduce((sum,s)=>sum+(s.costPercentage ?? s.percentage),0));
 let html=`<div class="item"><div class="itemhead"><div><b>Yo</b> <span class="pill">Comprador</span><div class="smalltext">Premio: ${cents(myPrizePct)}% · Coste: ${cents(myCostPct)}%</div></div><div style="text-align:right"><div class="money">${eur(cost*myCostPct/100)}</div><div class="smalltext">Tu coste estimado</div></div></div></div>`;
 for(const s of otherShares){
  const o=owners.find(x=>x.id===s.ownerId)||{name:'Persona eliminada'};
  const state=await shareState({...s,costPercentage:s.costPercentage ?? s.percentage},cost);
  html+=`<div class="item"><div class="itemhead"><div><b>${esc(o.name)}</b><div class="smalltext">Premio: ${s.percentage}% · Coste: ${s.costPercentage ?? s.percentage}%</div><div style="margin-top:7px">${statusPill(state.status)}</div></div><div style="text-align:right"><div class="money">${eur(state.due)}</div><div class="smalltext">Pagado: ${eur(state.paid)}<br>Pendiente: ${eur(state.pending)}</div><div class="actions" style="justify-content:flex-end;margin-top:8px"><button class="secondary small" onclick="editShare('${s.id}')">Editar</button><button class="danger small" onclick="removeShare('${s.id}')">Quitar</button></div></div></div></div>`;
 }
 $('shareList').innerHTML=otherShares.length?html:'<div class="empty">Aún no has definido personas para este número. Tu coste estimado será el coste completo.</div>';
}
async function editCurrentNumber(){openNumberForm(currentNumberId)}
async function deleteCurrentNumber(){
 if(!confirm('¿Eliminar este número, sus compras y su reparto?'))return;
 for(const p of await purchasesFor(currentNumberId))await del('purchases',p.id);
 for(const s of await sharesFor(currentNumberId))await del('shares',s.id);
 await del('numbers',currentNumberId);currentNumberId=null;await refreshAll();showView('numbers');toast('Número eliminado');
}
function openPurchaseForm(){ $('editPurchaseId').value='';$('purchaseFormTitle').textContent='Añadir compra';$('purchaseType').value='whole';$('purchaseQty').value=1;$('purchasePrice').value=20;$('purchasePlayed').value=20;$('purchaseDate').value=today();$('purchaseSeller').value='';$('purchaseNotes').value='';showView('purchaseFormView');}
$('purchaseType').addEventListener('change',()=>{const whole=$('purchaseType').value==='whole';$('purchasePrice').value=whole?20:5;$('purchasePlayed').value=whole?20:5});
$('purchaseForm').addEventListener('submit',async e=>{
 e.preventDefault();const type=$('purchaseType').value,quantity=Number($('purchaseQty').value),price=Number($('purchasePrice').value),played=Number($('purchasePlayed').value);
 if(!Number.isInteger(quantity)||quantity<1||price<=0||played<0){toast('Revisa cantidad e importes.');return}
 if(type==='whole'&&(price!==20||played!==20)){if(!confirm('Un décimo entero estándar cuesta 20 € y juega 20 €. ¿Quieres guardar valores diferentes?'))return}
 const id=$('editPurchaseId').value||uid();
 await put('purchases',{id,numberId:currentNumberId,type,quantity,price:cents(price),played:cents(played),date:$('purchaseDate').value||'',seller:$('purchaseSeller').value.trim(),notes:$('purchaseNotes').value.trim(),updatedAt:new Date().toISOString()});
 await openDetail(currentNumberId);toast('Compra guardada');
});
async function editPurchase(id){
 const p=await get('purchases',id);if(!p)return;
 $('editPurchaseId').value=p.id;$('purchaseFormTitle').textContent='Editar compra';$('purchaseType').value=p.type;$('purchaseQty').value=p.quantity;$('purchasePrice').value=p.price;$('purchasePlayed').value=p.played;$('purchaseDate').value=p.date||'';$('purchaseSeller').value=p.seller||'';$('purchaseNotes').value=p.notes||'';showView('purchaseFormView');
}
async function deletePurchase(id){if(!confirm('¿Eliminar esta compra?'))return;await del('purchases',id);await openDetail(currentNumberId);toast('Compra eliminada')}
$('ownerForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('ownerName').value.trim();if(!name)return;await put('owners',{id:uid(),name,notes:$('ownerNotes').value.trim(),createdAt:new Date().toISOString()});$('ownerName').value='';$('ownerNotes').value='';await refreshAll();toast('Persona guardada')});
async function deleteOwner(id){
 const related=await queryIndex('shares','ownerId',id);
 const message=related.length?`Esta persona está incluida en ${related.length} reparto(s). Si la eliminas, también se quitará de esos números. ¿Continuar?`:'¿Eliminar esta persona?';
 if(confirm(message)){for(const s of related)await del('shares',s.id);await del('owners',id);await refreshAll();if(currentNumberId)await openDetail(currentNumberId);toast('Persona eliminada y quitada de sus repartos')}
}
async function removeShare(id){
 const s=await get('shares',id);if(!s)return;
 const owner=await get('owners',s.ownerId);
 if(!confirm(`¿Quitar a ${owner?.name||'esta persona'} del reparto de este número? Se eliminará también el registro de pagos asociado a este número.`))return;
 await del('shares',id);const shares=await sharesFor(currentNumberId);const sum=shares.filter(x=>!x.isMe).reduce((a,x)=>a+x.percentage,0);const my=shares.find(x=>x.isMe);
 if(sum<100){await put('shares',{id:my?.id||uid(),numberId:currentNumberId,ownerId:null,percentage:cents(100-sum),costPercentage:cents(100-shares.filter(x=>!x.isMe).reduce((a,x)=>a+(x.costPercentage ?? x.percentage),0)),paidAmount:0,paidDate:'',notes:'Parte propia calculada automáticamente',isMe:true,updatedAt:new Date().toISOString()})}else if(my)await del('shares',my.id);
 await openDetail(currentNumberId);toast('Persona quitada del reparto')
}
async function openOwnersForNumber(){
 const owners=await all('owners');const shares=await sharesFor(currentNumberId);
 $('shareOwner').innerHTML=owners.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('');
 if(!owners.length){toast('Primero añade personas en la pestaña Personas.');showView('owners');return}
 $('shareOwner').value=owners[0].id;$('sharePercent').value='';$('shareCostPercent').value='50';$('sharePaid').value='0';$('sharePayDate').value='';$('shareNotes').value='';
 $('shareFormIntro').textContent='Configura el porcentaje de cada persona y registra cuánto ha pagado para este número. También se añadirá automáticamente tu propia parte al guardar el primer reparto.';
 showView('shareFormView');
}
async function editShare(id){
 const s=await get('shares',id);if(!s)return;const owners=await all('owners');
 $('shareOwner').innerHTML=owners.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('');
 $('shareOwner').value=s.ownerId;$('sharePercent').value=s.percentage;$('shareCostPercent').value=s.costPercentage ?? s.percentage;$('sharePaid').value=s.paidAmount||0;$('sharePayDate').value=s.paidDate||'';$('shareNotes').value=s.notes||'';$('shareFormIntro').textContent='Edita el porcentaje y los pagos registrados de esta persona.';showView('shareFormView');
}
$('shareForm').addEventListener('submit',async e=>{
 e.preventDefault();const ownerId=$('shareOwner').value,percentage=Number($('sharePercent').value),costPercentage=Number($('shareCostPercent').value),paidAmount=Number($('sharePaid').value);
 if(!ownerId||percentage<=0||percentage>100||costPercentage<0||costPercentage>100||paidAmount<0){toast('Revisa persona, porcentajes e importe pagado.');return}
 const allShares=await sharesFor(currentNumberId);const existing=allShares.find(s=>s.ownerId===ownerId&&!s.isMe);
 const otherShares=allShares.filter(s=>!s.isMe&&s.id!==existing?.id);
 const sumOthers=otherShares.reduce((sum,s)=>sum+s.percentage,0);
 const sumCostOthers=otherShares.reduce((sum,s)=>sum+(s.costPercentage ?? s.percentage),0);
 if(sumOthers+percentage>100.0001){toast('Los porcentajes de premio superarían el 100 %.');return}
 if(sumCostOthers+costPercentage>100.0001){toast('Los porcentajes de coste superarían el 100 %.');return}
 const totals=await numberTotals(currentNumberId);if(paidAmount>totals.cost*costPercentage/100+0.01){if(!confirm('El importe pagado supera la deuda calculada para esta persona. ¿Guardarlo de todos modos?'))return}
 const share={id:existing?.id||uid(),numberId:currentNumberId,ownerId,percentage,costPercentage,paidAmount:cents(paidAmount),paidDate:$('sharePayDate').value||'',notes:$('shareNotes').value.trim(),isMe:false,updatedAt:new Date().toISOString()};
 await put('shares',share);
 // My share is the remainder. It is a bookkeeping share, not a debt.
 const updated=await sharesFor(currentNumberId);const my=updated.find(s=>s.isMe);const sum=updated.filter(s=>!s.isMe).reduce((a,s)=>a+s.percentage,0);const costSum=updated.filter(s=>!s.isMe).reduce((a,s)=>a+(s.costPercentage ?? s.percentage),0);
 if(sum<100||costSum<100){await put('shares',{id:my?.id||uid(),numberId:currentNumberId,ownerId:null,percentage:cents(Math.max(0,100-sum)),costPercentage:cents(Math.max(0,100-costSum)),paidAmount:0,paidDate:'',notes:'Parte propia calculada automáticamente',isMe:true,updatedAt:new Date().toISOString()})}
 else if(my) await del('shares',my.id);
 await openDetail(currentNumberId);toast('Reparto y pago guardados');
});
async function updateApp(){
 try{
  if('serviceWorker' in navigator){
   const regs=await navigator.serviceWorker.getRegistrations();
   await Promise.all(regs.map(r=>r.update().catch(()=>{})));
  }
  if('caches' in window){
   const keys=await caches.keys();
   await Promise.all(keys.filter(k=>k.startsWith('mis-decimos-')).map(k=>caches.delete(k)));
  }
  toast('Actualizando aplicación…');
  setTimeout(()=>location.reload(),350);
 }catch(err){location.reload()}
}

async function exportBackup(){
 const data={app:'Mis Décimos',schemaVersion:1,exportedAt:new Date().toISOString(),draws:await all('draws'),numbers:await all('numbers'),purchases:await all('purchases'),owners:await all('owners'),shares:await all('shares')};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`mis-decimos-copia-${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Copia preparada para guardar');
}
async function importBackup(){
 const file=$('backupFile').files[0];if(!file){toast('Selecciona primero un archivo JSON.');return}
 try{
  const data=JSON.parse(await file.text());
  if(data.app!=='Mis Décimos'||data.schemaVersion!==1||!['draws','numbers','purchases','owners','shares'].every(k=>Array.isArray(data[k])))throw new Error('Formato de copia no válido.');
  const drawIds=new Set(data.draws.map(x=>x.id)),numberIds=new Set(data.numbers.map(x=>x.id)),ownerIds=new Set(data.owners.map(x=>x.id));
  if(data.numbers.some(x=>!drawIds.has(x.drawId)||!/^\d{5}$/.test(x.number)))throw new Error('Hay números con sorteo o formato incorrecto.');
  if(data.purchases.some(x=>!numberIds.has(x.numberId)||!Number.isFinite(x.quantity)||x.quantity<1))throw new Error('Hay compras no válidas.');
  if(data.shares.some(x=>!numberIds.has(x.numberId)||(!x.isMe&&!ownerIds.has(x.ownerId))||x.percentage<=0||x.percentage>100))throw new Error('Hay repartos no válidos.');
  if(!confirm('La copia reemplazará todos los datos de esta aplicación. ¿Has guardado una copia de los datos actuales y quieres continuar?'))return;
  for(const k of STORES)await clearStore(k);
  for(const k of STORES)for(const item of data[k])await put(k,item);
  const draws=await all('draws');currentDrawId=(draws.sort((a,b)=>b.year-a.year)[0]||{}).id||null;
  if(!currentDrawId){const year=new Date().getFullYear(),d={id:uid(),year,name:`Lotería de Navidad ${year}`,drawDate:`${year}-12-22`};await put('draws',d);currentDrawId=d.id}
  await refreshAll();showView('home');toast('Copia restaurada correctamente');
 }catch(err){alert('No se ha podido restaurar la copia: '+err.message)}
}
async function clearAll(){if(!confirm('Esto borrará todos los sorteos, números, compras, personas y pagos. ¿Continuar?'))return;if(!confirm('Última confirmación: esta acción no se puede deshacer.'))return;for(const s of STORES)await clearStore(s);currentDrawId=null;await init();showView('home');toast('Datos borrados')}
init().catch(err=>{console.error(err);alert('No se pudo iniciar la base de datos local. Comprueba que estás usando la aplicación desde HTTPS en Safari.')});
