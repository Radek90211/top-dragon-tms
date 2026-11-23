const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const html = fs.readFileSync('public/tms.html', 'utf8').replace(/\r\n/g,'\n');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Brak fragmentu ${start}`);
  return html.slice(a, b);
}
const routes = Array.from({ length:3360 }, (_, i) => ({
  id:`r${i}`, driverId:`d${i % 60}`, date:`day${Math.floor(i / 60)}`,
  start:Math.floor(i / 60) * 24, end:Math.floor(i / 60) * 24 + 20, load:'Ładunek'
}));
let examined = 0;
const tracked = routes.map(route => new Proxy(route, {get(target, key) {if (key === 'driverId') examined++; return target[key];}}));
const ctx = {
  state:{ routes:tracked }, Map, Infinity, Number, String,
  dateList:()=>['2026-01-01'], activeRoutes:()=>tracked,
  isFreeDayRoute:route=>Boolean(route.freeDay), routeGlobalStart:route=>route.start,
  routeGlobalEnd:route=>route.end, routeEndDate:route=>route.date,
  routeHasPlannedLoad:route=>Boolean(route.load)
};
vm.createContext(ctx);
vm.runInContext(section('    var mapRouteCalculationContext = null;', '    function nextRouteGapHours('), ctx);
const expected = id => {
  const current = routes.find(r=>r.id===id);
  return routes.filter(r=>r.id!==current.id && r.driverId===current.driverId && r.approvalStatus!=='rejected' && !r.freeDay &&
    (r.start>=current.end || (!r.load && r.date===current.date)))
    .sort((a,b)=>a.start-b.start)[0]?.id || null;
};
const ids = Array.from({length:60},(_,i)=>`r${54*60+i}`);
const baseline = ids.map(expected);
examined=0;
const start=performance.now();
const actual=ctx.withMapRouteCalculationContext(()=>ids.map(id=>ctx.nextRouteAfterRoute(id)?.id || null));
const elapsed=performance.now()-start;
const reads=examined;
assert.deepEqual(Array.from(actual),baseline,'Nowy indeks musi zwracać te same kolejne relacje');
assert.ok(examined < 15000, `Odświeżenie nie może przeszukiwać całego planu dla każdego pojazdu: ${examined}`);
const first = tracked.find(route=>route.id===ids[0]);
const next = tracked.find(route=>route.id===baseline[0]);
next.approvalStatus='rejected';
assert.notEqual(ctx.withMapRouteCalculationContext(()=>ctx.nextRouteAfterRoute(first.id)?.id || null),baseline[0], 'Kolejne odświeżenie musi uwzględnić zmianę planu');
next.approvalStatus='accepted';
assert.equal(ctx.withMapRouteCalculationContext(()=>ctx.nextRouteAfterRoute(first.id)?.id || null),baseline[0]);
let frames=[],refreshes=0;
const geocodeCtx={state:{unloadPanelCollapsed:false},requestAnimationFrame:callback=>{frames.push(callback);return frames.length;},syncUnloadMapCard:()=>refreshes++};
vm.createContext(geocodeCtx);
vm.runInContext(section('    let mapGeocodeRefreshFrame = 0;', '    function syncUnloadMapCard()'),geocodeCtx);
for(let i=0;i<30;i++) geocodeCtx.scheduleMapGeocodeRefresh();
assert.equal(frames.length,1,'Wyniki geokodowania łączą się w jedno odświeżenie');
frames[0](); assert.equal(refreshes,1);
const syncStart=html.indexOf('    function syncLeafletMap(points, signature, renderToken)');
const syncTry=html.indexOf('      try {\n        const freshMap',syncStart);
assert.ok(syncStart>=0 && syncTry>syncStart,'Brak inicjalizacji mapy');
let resolveRuntime;
const ready=new Promise(resolve=>{resolveRuntime=resolve;});
const element={};
let loadingDraws=0;
const syncCtx={state:{leafletRenderToken:1},document:{getElementById:()=>element},window:{},
  ensureLeafletRuntime:()=>ready,renderLeafletLoadingState(){loadingDraws++;},renderNativeMapFallback(){throw Error('Nieoczekiwany tryb awaryjny');}};
vm.createContext(syncCtx);
vm.runInContext(html.slice(syncStart,syncTry)+'    }',syncCtx);
syncCtx.syncLeafletMap([{id:'stara data'}],'old',1);
syncCtx.state.leafletRenderToken=2;
resolveRuntime();
setImmediate(()=>{
  assert.equal(loadingDraws,1,'Poprzednie ładowanie biblioteki nie może nadpisać nowej daty');
  console.log('Zmiana daty podczas ładowania mapy: nieaktualne odświeżenie pominięte');
});
console.log(`Mapa: 60 pojazdów, 3360 relacji, ${reads} odczytów kierowcy, ${elapsed.toFixed(1)} ms; aktualizacja i geokodowanie: OK`);
