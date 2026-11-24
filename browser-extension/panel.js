import {STATUSES,TAGS,number,point,estimateKm,clientKey,offerKey,profitability,matchDrivers,parseText} from './core.js';
const ext=location.protocol==='chrome-extension:'&&globalThis.chrome?.runtime;
const $=selector=>document.querySelector(selector);
const form=id=>Object.fromEntries(new FormData($(id)));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={async get(){return ext?(await chrome.storage.local.get('tdAssistant')).tdAssistant:JSON.parse(localStorage.getItem('tdAssistantDemo')||'null');},async set(value){if(ext)await chrome.storage.local.set({tdAssistant:value});else localStorage.setItem('tdAssistantDemo',JSON.stringify(value));}};
let local=(await store.get())||{offers:[],clients:[],draft:{},costs:{}};
let templates=ext?(await chrome.storage.sync.get('tdSnippets')).tdSnippets||{'=1':'TEST'}:JSON.parse(localStorage.getItem('tdSnippetsDemo')||'{"=1":"TEST"}');
let snapshot={drivers:[],routes:[],clients:[],history:[]},shared=[],sharedAvailable=false,actor=null,branchId='',tmsTabId=0,lastMatches=null;
function feedback(text,type=''){ $('#feedback').textContent=text;$('#feedback').className=type; }
function fill(selector,data){const target=$(selector);for(const [key,value]of Object.entries(data||{})){const field=target.elements.namedItem(key);if(field){if(field.type==='checkbox')field.checked=Boolean(value);else field.value=value??'';}}}
function coords(text){return point(String(text||'').split(/[,;]\s*/));}
function offer(){const v=form('#offer-form');return {...v,loadPoint:coords(v.loadCoords),unloadPoint:coords(v.unloadCoords),polish:$('#offer-form [name=polish]').checked,noVolvo:$('#offer-form [name=noVolvo]').checked,examples:$('#offer-form [name=examples]').checked};}
function costs(){return form('#cost-form');}
function currentRecord(){return shared.find(row=>row.kind==='offer'&&row.record_key===offerKey(offer()));}
function money(value,currency){return Number.isFinite(value)?value.toLocaleString('pl-PL',{maximumFractionDigits:2,minimumFractionDigits:2})+' '+currency:'—';}
function date(value){return value?new Date(value).toLocaleString('pl-PL'):'—';}
function km(value){return Number.isFinite(value)?Math.round(value)+' km':'—';}
function matchingHistory(v=offer()){
  const key=clientKey(v);
  const found=(snapshot.clients||[]).filter(c=>clientKey(c)===key||(!v.nip&&!v.transId&&String(c.client||'').trim().toLowerCase()===String(v.client||'').trim().toLowerCase()));
  const ids=new Set(found.map(c=>c.id));
  const history=(snapshot.history||[]).filter(r=>ids.has(r.clientId)||(!v.nip&&!v.transId&&String(r.client||'').trim().toLowerCase()===String(v.client||'').trim().toLowerCase()&&v.client));
  return {found,history};
}
function renderDecision(){
  const result=lastMatches||matchDrivers(offer(),snapshot),best=result.rows?.[0],profit=profitability(costs()),history=matchingHistory().history,row=currentRecord();
  const driver=result.error?'Uzupełnij dane':best?best.name:'Brak dopasowania';
  const moneyResult=profit.error?'Uzupełnij koszty':money(profit.result,costs().currency);
  const owner=row?.owner_name||'Wolna';
  $('#decision').innerHTML=`<div class="decision-item"><small>Najlepsze auto</small><b>${esc(driver)}</b></div><div class="decision-item"><small>Wynik</small><b class="${profit.error?'':profit.result>=0?'good':'bad'}">${esc(moneyResult)}</b></div><div class="decision-item"><small>Zespół</small><b>${esc(owner)}</b></div><div class="decision-item"><small>Historia klienta</small><b>${history.length?history.length+' relacji':'Brak danych'}</b></div><div class="decision-item"><small>Status</small><b>${esc(STATUSES[row?.payload?.work?.status]||'Nowa')}</b></div><div class="decision-item"><small>Puste km</small><b>${best?(best.deltaEmptyKm>=0?'+':'')+km(best.deltaEmptyKm):'—'}</b></div>`;
}
function renderOwner(){const row=currentRecord(),canWrite=sharedAvailable&&['admin','dispatcher','branch_manager'].includes(actor?.role);$('#owner').textContent=row?.owner_name?`Zajmuje się tym ${row.owner_name} · aktualizacja ${date(row.updated_at)}`:sharedAvailable?'Oferta nie jest zajęta w zespole.':'Brak potwierdzenia stanu zespołu — połącz i odśwież dane.';$('#release').disabled=!canWrite||!row?.owner_id||(row.owner_id!==actor?.id&&actor?.role!=='admin');$('#claim').disabled=!canWrite||Boolean(row?.owner_id&&row.owner_id!==actor?.id);$('#save-shared').disabled=!canWrite;$('#client-shared').disabled=!canWrite;renderDecision();}
function renderLists(){
  const filter=$('#team-filter').value;
  const merged=[...shared.filter(r=>r.kind==='offer'),...local.offers.filter(r=>!shared.some(s=>s.kind==='offer'&&s.record_key===r.record_key))];
  $('#team-list').innerHTML=merged.filter(row=>filter==='all'||filter==='mine'&&row.owner_id===actor?.id||filter==='due'&&row.payload.work?.followUp&&Date.parse(row.payload.work.followUp)<=Date.now()).map(row=>`<article class="card"><b>${esc(row.payload.offer?.client||row.record_key)}</b><p>${esc(row.payload.offer?.load)} → ${esc(row.payload.offer?.unload)}</p><span class="badge">${esc(STATUSES[row.payload.work?.status]||'Nowa')}</span> <span class="badge">${row.local?'Tylko lokalnie':esc(row.owner_name||'Wolna')}</span><p>${esc(row.payload.work?.note||'')}</p><small>Propozycja: ${esc(row.payload.work?.proposedPrice||'—')} ${esc(row.payload.costs?.currency||'')} · Kontakt: ${esc(date(row.payload.work?.followUp))}</small><button class="secondary" data-open-offer="${esc(row.record_key)}">Otwórz</button></article>`).join('')||'<p class="empty">Brak zapisanych spraw. Dane zespołu pojawią się po połączeniu i uruchomieniu zapisu centralnego.</p>';
  const clients=[...shared.filter(r=>r.kind==='client'),...local.clients.filter(r=>!shared.some(s=>s.kind==='client'&&s.record_key===r.record_key))];
  $('#client-list').innerHTML=clients.map(row=>`<article class="card ${esc(Object.hasOwn(TAGS,row.payload.tag)?row.payload.tag:'normal')}"><b>${esc(row.payload.client)}</b> <span class="badge">${esc(TAGS[row.payload.tag]||'Standard')}</span><small>${esc(row.record_key)} · ${row.local?'Tylko lokalnie':'Zespół'}</small><p>${esc(row.payload.note)}</p><button class="secondary" data-open-client="${esc(row.record_key)}">Edytuj</button></article>`).join('')||'<p class="empty">Dodaj własne oznaczenie klienta.</p>';
  renderOwner();
}
function renderSnippets(){ $('#snippet-list').innerHTML=Object.entries(templates).map(([trigger,text])=>`<article class="card"><b>${esc(trigger)}</b><p>${esc(text)}</p><button class="secondary" data-edit-snippet="${esc(trigger)}">Edytuj</button> <button class="secondary" data-remove-snippet="${esc(trigger)}">Usuń</button></article>`).join(''); }
function show(view){document.querySelectorAll('[data-section]').forEach(el=>el.hidden=el.dataset.section!==view);document.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.view===view)));}
async function rpc(action,payload={}){
  if(!ext)return {ok:false,message:'Podgląd testowy: połączenie z rzeczywistym kontem wymaga zainstalowania rozszerzenia.'};
  return chrome.runtime.sendMessage({action,payload,tmsTabId});
}
async function call(action,payload){const result=await rpc(action,payload);if(result?.tabs){const select=$('#tms-tab');select.hidden=false;select.innerHTML='<option value="">Wybierz kartę TOP DRAGON</option>'+result.tabs.map(t=>`<option value="${t.id}">${esc(t.title)} (${t.id})</option>`).join('');}if(!result?.ok)throw new Error(result?.message||'Nie udało się wykonać operacji.');return result.data;}
async function refresh(){
  const data=await call('shared',{branchId});shared=data.rows||[];sharedAvailable=true;
  ['#claim','#save-shared','#client-shared'].forEach(id=>$(id).disabled=false);
  renderLists();feedback('Wczytano wspólne oznaczenia i negocjacje.','success');
}
async function connect(){
  sharedAvailable=false;renderOwner();
  feedback('Pobieranie wskazanego planu z TOP DRAGON…');
  const data=await call('context',{offer:offer()});snapshot=data;actor=data.actor;
  const select=$('#branch');select.hidden=false;
  select.innerHTML=(data.branches||[]).map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
  branchId=branchId||actor.branchId||(data.branches?.length===1?data.branches[0].id:'');
  if(!branchId)select.insertAdjacentHTML('afterbegin','<option value="">Wybierz oddział</option>');select.value=branchId;
  $('#connection').textContent=`Połączono: ${actor.name}`;
  const v=offer();if(!v.loadPoint&&point(data.offerPoints?.load))$('#offer-form [name=loadCoords]').value=data.offerPoints.load.join(', ');if(!v.unloadPoint&&point(data.offerPoints?.unload))$('#offer-form [name=unloadCoords]').value=data.offerPoints.unload.join(', ');
  renderHistory();if(branchId){try{await refresh();}catch(error){shared=[];renderLists();feedback(error.message,'error');}}else feedback('Wybierz oddział, aby wczytać oznaczenia zespołu.');
}
function renderHistory(v=offer()){
  const {found,history}=matchingHistory(v);
  $('#client-history').innerHTML='<h3>Historia wybranego klienta</h3>'+(found.map(c=>`<article class="card"><b>${esc(c.client)}</b><p>Opiekunowie: ${esc(c.dispatcher||'—')}</p><small>${esc(c.nip||c.transId||'Dopasowanie po nazwie — sprawdź tożsamość')}</small></article>`).join(''))+(history.slice(0,20).map(r=>`<article class="card"><b>${esc(r.date)}</b><p>${esc(r.load)} → ${esc(r.unload)}</p><small>${esc(r.price||'Brak zapisanej stawki')} ${esc(r.currency||'')}</small></article>`).join('')||'<p class="empty">Brak pasującej historii w pobranym zakresie TOP DRAGON.</p>');
  renderDecision();
}
function matchCard(row){
  return `<article class="card"><b>${esc(row.name)}</b> <span class="badge">${esc(row.dispatcher||'—')}</span><div class="numbers"><b>Dojazd ${km(row.approachKm)}</b><b>Po rozładunku ${km(row.afterKm)}</b><b>Puste km: ${row.deltaEmptyKm>=0?'+':''}${km(row.deltaEmptyKm)}</b></div><small>Przed: ${esc(row.previous)}<br>Po: ${esc(row.next)}</small>${row.warnings.map(w=>`<p class="warning">${esc(w)}</p>`).join('')}<button class="secondary" data-match="${esc(row.driverId)}">Użyj kilometrów</button></article>`;
}
function renderMatches(){
  const result=lastMatches=matchDrivers(offer(),snapshot);
  if(result.error)$('#matches').innerHTML=`<p class="warning">${esc(result.error)}</p>`;
  else if(!result.rows.length)$('#matches').innerHTML='<p class="empty">Brak dopasowań z kompletnymi danymi w pobranym planie.</p>';
  else $('#matches').innerHTML='<small>Najlepsze dopasowanie. Kilometry są szacunkowe.</small>'+matchCard(result.rows[0])+(result.rows.length>1?`<details><summary>Pozostałe auta (${result.rows.length-1})</summary>${result.rows.slice(1).map(matchCard).join('')}</details>`:'');
  renderDecision();
  return result;
}
function calculate(){const v=costs();document.querySelectorAll('[data-fleet]').forEach(el=>el.hidden=v.mode==='broker');document.querySelectorAll('[data-broker]').forEach(el=>el.hidden=v.mode!=='broker');const r=profitability(v);$('#profit').innerHTML=r.error?`<p class="warning">${esc(r.error)}</p>`:`<div class="numbers"><b>${km(r.totalKm)}</b><b>${money(r.perKm,v.currency)}/km</b><b class="${r.result>=0?'good':'bad'}">Wynik: ${money(r.result,v.currency)}</b></div><small>Koszt: ${money(r.costs,v.currency)} · Marża: ${r.margin===null?'—':r.margin.toFixed(1)+'%'}</small>`;renderDecision();}
async function persistDraft(){local.draft=offer();local.costs=costs();await store.set(local);}
async function save(kind,central,action='write'){
  const v=kind==='client'?form('#client-form'):offer();const key=kind==='client'?clientKey(v):offerKey(v);
  if(kind==='client'&&!String(v.client||'').trim())throw new Error('Podaj nazwę klienta.');
  if(!key)throw new Error(kind==='offer'?'Podaj numer oferty. Ten sam numer pozwala zespołowi rozpoznać tę samą sprawę.':'Podaj klienta.');
  const payload=kind==='client'?v:{offer:v,work:form('#work-form'),costs:costs()};
  if(central){
    const current=shared.find(r=>r.kind===kind&&r.record_key===key);
    const row=await call('save',{branchId,kind,key,payload,version:current?.version||0,action});
    shared=shared.filter(r=>r.kind!==kind||r.record_key!==key).concat(row);
    if(kind==='offer'&&action!=='write'){fill('#offer-form',row.payload.offer);fill('#work-form',row.payload.work);fill('#cost-form',row.payload.costs);}
    feedback('Zapisano centralnie — dane są dostępne dla zespołu.','success');
  }else{
    const field=kind==='client'?'clients':'offers';local[field]=local[field].filter(r=>r.record_key!==key).concat({kind,record_key:key,payload,local:true,updated_at:new Date().toISOString()});await store.set(local);
    feedback('Zapisano wyłącznie na tym komputerze. Zespół nie widzi tej zmiany.','success');
  }
  await persistDraft();renderLists();
}
function handle(fn){return async event=>{event?.preventDefault();const button=event?.currentTarget instanceof HTMLButtonElement?event.currentTarget:null;if(button)button.disabled=true;try{await fn(event);}catch(error){feedback(error.message,'error');}finally{if(button)button.disabled=false;renderOwner();}};}
$('#work-form [name=status]').innerHTML=Object.entries(STATUSES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
$('#client-form [name=tag]').innerHTML=Object.entries(TAGS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
fill('#offer-form',local.draft);fill('#cost-form',local.costs);
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.view)));
$('#connect').addEventListener('click',handle(connect));$('#tms-tab').addEventListener('change',handle(async()=>{tmsTabId=Number($('#tms-tab').value);shared=[];sharedAvailable=false;await connect();}));
$('#branch').addEventListener('change',handle(async()=>{branchId=$('#branch').value;shared=[];sharedAvailable=false;['#claim','#release','#save-shared','#client-shared'].forEach(id=>$(id).disabled=true);renderLists();if(branchId)await refresh();}));
$('#parse').addEventListener('click',handle(async()=>{
  if(!$('#source').value.trim())throw new Error('Wklej najpierw treść oferty.');
  const parsed=parseText($('#source').value),before=offer();
  if(parsed.load)fill('#offer-form',{load:parsed.load,loadCoords:parsed.load===before.load?before.loadCoords:''});
  if(parsed.unload)fill('#offer-form',{unload:parsed.unload,unloadCoords:parsed.unload===before.unload?before.unloadCoords:''});
  fill('#offer-form',parsed);fill('#cost-form',parsed);
  lastMatches=null;$('#matches').replaceChildren();$('#profit').replaceChildren();
  if(ext)await connect();
  const result=renderMatches(),best=result.rows?.[0],v=offer();
  if(best)fill('#cost-form',{approachKm:best.approachKm.toFixed(1),afterKm:best.afterKm.toFixed(1)});
  const loaded=estimateKm(v.loadPoint,v.unloadPoint);if(loaded!==null)fill('#cost-form',{loadedKm:loaded.toFixed(1)});
  calculate();renderHistory();await persistDraft();
  feedback(result.error?'Uzupełnij wskazane dane, aby dokończyć ocenę.':'Ocena gotowa. Najważniejsze wyniki są widoczne powyżej.',result.error?'':'success');
}));
for(const field of ['load','unload'])$('#offer-form [name='+field+']').addEventListener('input',()=>{$('#offer-form [name='+field+'Coords]').value='';});
$('#offer-form').addEventListener('input',()=>{lastMatches=null;$('#matches').replaceChildren();renderDecision();});
$('#client-form').addEventListener('input',()=>renderHistory(form('#client-form')));
$('#offer-form').addEventListener('submit',handle(async()=>{if(ext)await connect();renderMatches();renderHistory();calculate();await persistDraft();}));
$('#offer-form [name=offerId]').addEventListener('change',()=>{const record=currentRecord();$('#work-form').reset();if(record)fill('#work-form',record.payload.work);renderOwner();});
$('#clear').addEventListener('click',handle(async()=>{$('#source').value='';$('#offer-form').reset();$('#work-form').reset();$('#cost-form').reset();lastMatches=null;$('#matches').replaceChildren();$('#profit').replaceChildren();await persistDraft();renderOwner();feedback('Wklej kolejną ofertę i wybierz „Oceń ofertę”.');}));
$('#cost-form').addEventListener('submit',handle(async()=>{calculate();await persistDraft();}));$('#cost-form [name=mode]').addEventListener('change',calculate);
$('#save-local').addEventListener('click',handle(()=>save('offer',false)));$('#save-shared').addEventListener('click',handle(()=>save('offer',true)));$('#claim').addEventListener('click',handle(()=>save('offer',true,'claim')));$('#release').addEventListener('click',handle(()=>save('offer',true,'release')));
$('#client-form').addEventListener('submit',handle(()=>save('client',false)));$('#client-shared').addEventListener('click',handle(()=>save('client',true)));$('#refresh').addEventListener('click',handle(refresh));$('#team-filter').addEventListener('change',renderLists);
document.addEventListener('click',event=>{
  if(!event.target.closest('button[data-open-offer],button[data-open-client],button[data-match],button[data-edit-snippet],button[data-remove-snippet]'))return;
  return handle(async event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.openOffer){const row=[...shared,...local.offers].find(r=>r.kind==='offer'&&r.record_key===target.dataset.openOffer);fill('#offer-form',row.payload.offer);$('#work-form').reset();fill('#work-form',row.payload.work);fill('#cost-form',row.payload.costs);show('offer');renderOwner();}
  if(target.dataset.openClient){const row=[...shared,...local.clients].find(r=>r.kind==='client'&&r.record_key===target.dataset.openClient);fill('#client-form',row.payload);renderHistory(row.payload);}
  if(target.dataset.match){const row=matchDrivers(offer(),snapshot).rows.find(r=>r.driverId===target.dataset.match);fill('#cost-form',{approachKm:row.approachKm.toFixed(1),afterKm:row.afterKm.toFixed(1)});const loaded=estimateKm(offer().loadPoint,offer().unloadPoint);if(loaded!==null)fill('#cost-form',{loadedKm:loaded.toFixed(1)});calculate();feedback('Wstawiono szacunkowe kilometry ze współrzędnych. Możesz zastąpić je kilometrami drogowymi.');}
  if(target.dataset.editSnippet)fill('#snippet-form',{trigger:target.dataset.editSnippet,text:templates[target.dataset.editSnippet]});
  if(target.dataset.removeSnippet){delete templates[target.dataset.removeSnippet];await saveTemplates();renderSnippets();}
  })(event);
});
async function saveTemplates(){if(ext)await chrome.storage.sync.set({tdSnippets:templates});else localStorage.setItem('tdSnippetsDemo',JSON.stringify(templates));}
$('#snippet-form').addEventListener('submit',handle(async()=>{const v=form('#snippet-form');if(!/^=[a-z0-9]{1,8}$/i.test(v.trigger))throw new Error('Skrót musi zaczynać się od = i zawierać od 1 do 8 liter lub cyfr.');if(Object.keys(templates).some(t=>t!==v.trigger&&(t.startsWith(v.trigger)||v.trigger.startsWith(t))))throw new Error('Ten skrót jest początkiem innego skrótu. Wybierz jednoznaczną sekwencję.');templates[v.trigger]=v.text;await saveTemplates();renderSnippets();feedback('Zapisano skrót. Wpisanie tekstu nie wysyła wiadomości.','success');}));
$('#enable-site').addEventListener('click',handle(async()=>{if(!ext)throw new Error('Ta funkcja wymaga zainstalowania rozszerzenia.');const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const url=new URL(tab.url||'');if(!['http:','https:'].includes(url.protocol))throw new Error('Skróty można włączyć na zwykłej stronie HTTP/HTTPS.');const origin=url.origin+'/*';if(!await chrome.permissions.request({origins:[origin]}))throw new Error('Nie udzielono dostępu do tej strony.');const id='td-snippets-'+url.hostname.replace(/[^a-z0-9]/gi,'-');await chrome.scripting.unregisterContentScripts({ids:[id]}).catch(()=>{});await chrome.scripting.registerContentScripts([{id,matches:[origin],js:['snippets.js'],allFrames:true,runAt:'document_idle',persistAcrossSessions:true}]);await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},files:['snippets.js']});feedback('Włączono skróty na tej stronie. Uprawnienie możesz odebrać w ustawieniach rozszerzenia.','success');}));
$('#highlight').addEventListener('click',handle(async()=>{if(!ext)throw new Error('Wyróżnianie innej karty wymaga zainstalowania rozszerzenia.');const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!/^https:\/\/([a-z0-9-]+\.)*trans\.eu\//i.test(tab.url||''))throw new Error('Otwórz kartę Trans.eu i kliknij ikonę dodatku, aby udzielić dostępu do tej karty.');const names=[...shared.filter(r=>r.kind==='client'),...local.clients].filter(r=>['favorite','prospect','caution'].includes(r.payload.tag)).map(r=>r.payload.client);if(!names.length)throw new Error('Dodaj najpierw oznaczonego klienta.');await chrome.scripting.executeScript({target:{tabId:tab.id},files:['highlights.js']});await chrome.scripting.insertCSS({target:{tabId:tab.id},css:'::highlight(top-dragon-clients){background:#fef08a;color:#713f12;}'});const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:async names=>tdHighlightClients(names),args:[names]});feedback(`Wyróżniono ${result[0]?.result?.count||0} nazw. Wyróżnienie po nazwie nie potwierdza tożsamości firmy.`);}));
if(!ext){feedback('PODGLĄD TESTOWY — dane przykładowe, bez połączenia z kontem i zespołem.');snapshot={drivers:[{id:'demo',name:'Kierowca przykładowy',dispatcher:'DEMO',basePoint:[52.23,21.01],maxHeight:3,nationality:'PL'}],routes:[],clients:[],history:[]};fill('#offer-form',{load:'Warszawa',unload:'Łódź',loadCoords:'52.23, 21.01',unloadCoords:'51.76, 19.46',start:'2026-11-24T10:00',end:'2026-11-24T15:00'});}
renderSnippets();renderLists();
if(ext)setInterval(()=>{if(sharedAvailable&&branchId&&document.visibilityState==='visible')refresh().catch(error=>{sharedAvailable=false;renderOwner();feedback('Nie odświeżono danych zespołu. '+error.message,'error');});},15000);
