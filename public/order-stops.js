// Ordered operational stops are retained separately from the legacy two-stop fields.
function orderStopLabel(point) {
  return [point.city, point.postalCode].filter(Boolean).join(' ') || point.fullAddress || point.address || '';
}
function stableQueueJson(value) {
  if (Array.isArray(value)) return '['+value.map(stableQueueJson).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableQueueJson(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function orderStopsSummary(route) {
  const pending = route?._centralLocalCreatedAt ? '<div class="small" role="status" style="color:#b45309">Oczekuje na potwierdzenie zapisu</div>' : '';
  const expired = pending + (queueLoadDateIso(route) && queueLoadDateIso(route) < queueTodayIsoWarsaw() ? '<div class="small" style="color:#b45309;font-weight:700">Termin minął — sprawdź</div>' : '');
  if (!route?.orderStops?.length) return expired;
  return expired+`<div class="small" style="white-space:normal">${route.orderStops.map((p,i)=>`${i+1}. ${p.type==='pickup'?'Zał.':'Rozł.'} ${esc(orderStopLabel(p))}`).join(' → ')}</div>`;
}
function orderStopFields(value = {}) {
  const source = value.orderStops || value.stops;
  const orderStops = (Array.isArray(source) ? source : []).filter(p => p && ['pickup','delivery'].includes(p.type)).map(p => ({
    type:p.type, ...Object.fromEntries(['city','postalCode','address','fullAddress','date','time'].map(k => [k,String(p[k] || '')]))
  }));
  const pickups = orderStops.filter(p => p.type === 'pickup'), deliveries = orderStops.filter(p => p.type === 'delivery');
  const result = {orderStops};
  for (const [field,point] of [['secondLoad',pickups[1]],['secondUnload',deliveries[1]]]) {
    result[field] = point ? orderStopLabel(point) : (value[field] || '');
    result[field+'Address'] = point ? point.fullAddress || point.address : (value[field+'Address'] || '');
  }
  return result;
}
function reconcileOrderStops(route) {
  if (!route.orderStops?.length) return;
  for (const [type,fields] of [['pickup',['load','secondLoad']],['delivery',['unload','secondUnload']]]) {
    const points = route.orderStops.filter(p => p.type === type);
    fields.forEach((field,i) => {
      const point = points[i]; if (!point) return;
      if (String(route[field] || '') !== orderStopLabel(point) && String(route[field] || '') !== normalizeLocation(orderStopLabel(point))) { point.city=String(route[field] || ''); point.postalCode=''; }
      const address=String(route[field+'Address'] || '');
      if (address !== (point.fullAddress || point.address)) { point.address=address; point.fullAddress=address; }
    });
  }
}
function renderOrderStops(route, routeId = '') {
  if (!route?.orderStops?.length) return '';
  const editable = !routeId || canEditBoardRoute(route);
  return `<details class="section order-stops-editor" open><summary><b>Punkty zlecenia (${route.orderStops.length})</b></summary><div class="small">Kolejność wykonania według zlecenia. Sprawdź każdy adres i termin.</div>${route.orderStops.map((p,i) => `<div style="padding:8px;margin-top:8px;border:1px solid #eab308;border-radius:10px;background:#fffbea;color:#422006"><b>${i+1}. ${p.type==='pickup'?'Załadunek':'Rozładunek'}</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${[['city','Miejscowość','text'],['postalCode','Kod pocztowy','text'],['fullAddress','Dokładny adres','text'],['date','Data','date'],['time','Godzina','time']].map(([key,label,type]) => `<label>${label}<input class="input" type="${type}" value="${attr(p[key] || (key==='fullAddress'?p.address:''))}" ${editable?'':'disabled'} onchange="changeOrderStop('${attr(routeId)}',${i},'${key}',this.value)"></label>`).join('')}</div></div>`).join('')}</details>`;
}
function changeOrderStop(routeId,index,key,value) {
  const route = routeId ? state.routes.find(r => r.id === routeId) : state.prefill;
  if (!route || (routeId && !canEditBoardRoute(route)) || !route.orderStops?.[index]) return;
  route.orderStops[index][key]=value;
  const point=route.orderStops[index], siblings=route.orderStops.filter(p=>p.type===point.type), position=siblings.indexOf(point);
  if (key==='fullAddress') point.address=value;
  const firstPickup=route.orderStops.find(p=>p.type==='pickup');
  const lastDelivery=route.orderStops.filter(p=>p.type==='delivery').at(-1);
  if ((key==='date' || key==='time') && (point===firstPickup || point===lastDelivery)) {
    const pickup=point===firstPickup;
    const field=key==='date'?(pickup?'date':'endDate'):(pickup?'startHour':'endHour');
    if (key==='date') { route[field]=value;if(pickup)route.loadDate=value; }
    else if (/^\d{2}:\d{2}$/.test(value)) route[field]=Number(value.slice(0,2))+Number(value.slice(3))/60;
    if (!routeId) {
      const id=key==='date'?(pickup?'new-date':'order-entry-end-date'):(pickup?'order-entry-start':'order-entry-end');
      const el=document.getElementById(id);if(el)el.value=value;
    }
  }
  if (position < 2) {
    const field=(position===1?'second':'')+(point.type==='pickup'?(position===1?'Load':'load'):(position===1?'Unload':'unload'));
    route[field]=orderStopLabel(point); route[field+'Address']=point.fullAddress || point.address;
    if (!routeId) {
      const id='new-'+field.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
      const el=document.getElementById(id), address=document.getElementById(id+'-address');
      if(el) el.value=route[field]; if(address) address.value=route[field+'Address'];
    }
  }
  if (routeId) { updateRouteField(routeId,'orderStops',route.orderStops,false); syncDetailsPanel(); }
}
function renderQueueBranchChoice(route) {
  if (!route.futureQueue && !route.proposedLoad) return '';
  if (state.user?.supabaseRole !== 'admin') return '';
  const branches=new Map();
  [...USERS,...DRIVERS].forEach(u=>{if(u.branchId) branches.set(u.branchId,u.branch || u.branchName || u.branchId);});
  const current=route.queueBranchId || route._centralBranchId || state.user?.branchId || '';
  return `<input id="new-queue-branch" type="hidden" value="${attr(current)}" />`;
}
function queueOutboxKey() { return 'tms-queue-outbox-v131:'+String(state.user?.supabaseId || state.user?.login || '')+':'+String(state.user?.branchId || ''); }
const restoredQueueOutboxScopes = new Set();
function persistQueueOutbox() {
  if (!state.user) return;
  // Read pending entries before the first render/ticker can replace their backup.
  restoreQueueOutbox();
  const items=[...(state.futureRoutes || []),...(state.proposedLoads || [])].filter(r=>r._centralLocalCreatedAt)
    .map(r=>({...r,queueBranchId:centralLoadQueueBranchId(r)}));
  try { if(items.length) localStorage.setItem(queueOutboxKey(),JSON.stringify(items)); else localStorage.removeItem(queueOutboxKey()); }
  catch(error) { console.warn('Nie udało się zapisać kopii oczekujących ładunków',error); }
}
function restoreQueueOutbox() {
  if (!state.user) return;
  const scope=queueOutboxKey();
  if (restoredQueueOutboxScopes.has(scope)) return;
  restoredQueueOutboxScopes.add(scope);
  try {
    const items=JSON.parse(localStorage.getItem(scope) || '[]');
    if(!Array.isArray(items)) return;
    for(const item of items) {
      if(!item?.id || !item._centralLocalCreatedAt) continue;
      const list=item.proposedLoad?(state.proposedLoads ||= []):item.futureQueue?(state.futureRoutes ||= []):null;
      if(list && !list.some(r=>r.id===item.id)) list.push(item);
    }
  } catch(error) { console.warn('Nie udało się odczytać oczekujących ładunków',error); }
}
