const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('public/tms.html','utf8').replace(/\r\n/g,'\n');
const start=html.indexOf('    function syncSampleRoadTiles(');
const end=html.indexOf('    function routeSwapValidPoint(',start);
assert.ok(start>=0&&end>start);
function scenario(fail=false, storage=new Map()) {
  const demo={id:'demo',driverId:'a',sampleRoadDemoV339:true,approachKm:0,loadedKm:0};
  const calls=[];let tileScans=0, statusUpdates=0;
  const meta={textContent:''}, metric={outerHTML:''};
  const tile={
    dataset:{routeId:'demo'},
    classList:new Set(['continuous','route-metric-km-low']),
    querySelector:selector=>selector==='.time-route-meta'?meta:selector==='.time-route-metric-value'?metric:null
  };
  tile.classList.remove=tile.classList.delete.bind(tile.classList);
  const ctx={
    state:{user:{role:'admin'},routes:[demo],appView:'plan',routeTileMetricView:'km',boardStartupV188:{active:false}},EMBEDDED_MODE:true,
    activeRoutes:()=>[demo],routeSwapDriverBuckets:()=>new Map(),driverById:()=>({id:'a'}),
    routeSwapPosition:()=>({coords:[52,19],route:{id:'prior'}}),routeSwapEndpoint:(route,type)=>type==='pickup'?{lat:52.1,lng:19.1}:{lat:53,lng:20},
    routeSwapEndpointLabel:(route,type)=>type,
    routeSwapValidPoint:p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lng),
    requestTruckRouting:async(mode,payload)=>{calls.push({mode,...payload});if(fail)throw Error('offline');return {results:payload.destinations.map(()=>({ok:true,distanceKm:payload.vehicleState==='empty'?64.3:271.6}))};},
    applyAutomaticCarrierCost:route=>{route.cost=route.approachKm+route.loadedKm;},
    document:{activeElement:null,querySelectorAll:()=>{tileScans++;return [tile];}},
    window:{renderRouteMetricValue:route=>`<span>${route.loadedKm+route.approachKm} km</span>`},
    routeDistanceLabel:route=>route.sampleRoadRoutingStatusV339==='unavailable'?'brak km':`${route.loadedKm+route.approachKm} km`,
    money:String,profit:route=>500-(route.cost||0),
    routeStatusClasses:route=>route.cost>200?'route-metric-km-mid':'route-metric-km-low',
    syncRouteCommercialWarning:()=>statusUpdates++,commercialWarningCutoffDate:()=> '2026-11-24',
    syncDetailsPanel(){},scheduleRouteSwapAnalysis(){},setTimeout,clearTimeout,WeakMap,Map,Set,JSON,Number,Math
  };
  ctx.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
  return {demo,calls,ctx,storage,tile,meta,metric,tileScans:()=>tileScans,statusUpdates:()=>statusUpdates};
}
(async()=>{
  const ok=scenario();await ok.ctx.runSampleRoadDemosV339();
  assert.deepEqual(ok.calls.map(c=>c.vehicleState),['empty','loaded']);
  assert.ok(ok.calls.every(c=>c.mode==='matrix'));
  assert.equal(ok.demo.approachKm,64);assert.equal(ok.demo.loadedKm,272);
  assert.equal(ok.demo.sampleRoadRoutingStatusV339,'ready');assert.match(ok.demo.notes,/TomTom/);assert.equal(ok.tileScans(),1);
  assert.equal(ok.statusUpdates(),1);
  assert.equal(ok.meta.textContent,'336 km · 164');
  assert.equal(ok.metric.outerHTML,'<span>336 km</span>');
  assert.ok(ok.tile.classList.has('route-metric-km-mid'));
  assert.ok(!ok.tile.classList.has('route-metric-km-low'));
  await ok.ctx.runSampleRoadDemosV339();
  assert.equal(ok.tileScans(),1,'Gotowe dane nie wymagają kolejnego przejścia po tablicy');
  assert.equal(ok.demo.routeApproachCoords.lat,52);
  assert.equal(ok.demo.routeOriginCoords.lat,52.1);
  assert.equal(ok.demo.routeDestinationCoords.lat,53);
  const reloaded=scenario(false,ok.storage);await reloaded.ctx.runSampleRoadDemosV339();
  assert.equal(reloaded.calls.length,0,'Po odświeżeniu poprawne kilometry powinny wrócić z pamięci, bez zapytania do routera');
  assert.equal(reloaded.demo.approachKm,64);assert.equal(reloaded.demo.loadedKm,272);
  const stale=new Map(ok.storage);
  for(const [key,value] of stale) stale.set(key,JSON.stringify(JSON.parse(value).map(([leg,km])=>[leg,km,Date.now()-25*60*60*1000])));
  const expired=scenario(false,stale);await expired.ctx.runSampleRoadDemosV339();
  assert.equal(expired.calls.length,2,'Przeterminowane dane muszą zostać przeliczone');
  const bad=scenario(true);await bad.ctx.runSampleRoadDemosV339();
  assert.equal(bad.demo.loadedKm,0);assert.equal(bad.demo.sampleRoadRoutingStatusV339,'unavailable');assert.match(bad.demo.notes,/nie potwierdzono/);
  assert.equal(bad.storage.size,0,'Błędy routingu nie są utrwalane');
  assert.equal(bad.meta.textContent,'brak km · 500');
  let today='2026-11-25';
  const warnings={isFreeDayRoute:()=>false,carrierCost:()=>0,currentAppDate:()=>today,attr:String,boardRenderCache:null};
  vm.createContext(warnings);
  const section=(from,to)=>html.slice(html.indexOf(from),html.indexOf(to,html.indexOf(from)));
  vm.runInContext(section('    const COMMERCIAL_WARNING_GRACE_DAYS', '    const BOARD_FUTURE_DAYS'),warnings);
  assert.ok(vm.runInContext('BOARD_PAST_DAYS > COMMERCIAL_WARNING_GRACE_DAYS',warnings));
  vm.runInContext(section('    function addDaysToIso(', '    function isWeekendIso('),warnings);
  vm.runInContext(section('    function routeEndDate(', '    function buildDateIndexMap('),warnings);
  vm.runInContext(section('    function routeMissingCommercialFields(', '    function routeSmsKm('),warnings);
  const route={endDate:'2026-11-23',rate:500,client:'Przykładowy klient'};
  assert.equal(warnings.routeCommercialWarningBadge(route),'','Po dwóch dniach ostrzeżenie jest ukryte');
  today='2026-11-26';
  assert.equal(warnings.routeCommercialWarningBadge(route),'','Dokładnie trzy dni nie przekraczają progu');
  today='2026-11-27';
  assert.match(warnings.routeCommercialWarningBadge(route),/koszt/);
  assert.equal(warnings.routeCommercialWarningBadge({...route,date:'2026-11-23',endDate:'2026-11-24'}),'','Liczy się data rozładunku');
  assert.match(warnings.routeCommercialWarningBadge({...route,date:'2026-11-23',endDate:''}),/koszt/);
  assert.equal(warnings.routeCommercialWarningBadge({...route,endDate:''}),'');
  assert.equal(warnings.routeCommercialWarningBadge({...route,sampleRoadDemoV339:true}),'');
  assert.match(warnings.routeCommercialWarningBadge({...bad.demo,...route}),/koszt/);
  assert.match(warnings.routeCommercialWarningBadge({...bad.demo,...route,rate:0}),/stawka, koszt/);
  today='2026-12-02';
  assert.equal(warnings.routeCommercialWarningBadge({...route,endDate:'2026-11-29'}),'');
  assert.match(warnings.routeCommercialWarningBadge({...route,endDate:'2026-11-28'}),/koszt/);
  console.log('Przykłady, routing i ostrzeżenia po przekroczeniu trzech dni: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
