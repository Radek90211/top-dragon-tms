const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('public/tms.html','utf8').replace(/\r\n/g,'\n');
const start=html.indexOf('    let sampleRoadDemoTimerV339 = 0;');
const end=html.indexOf('    function routeSwapValidPoint(',start);
assert.ok(start>=0&&end>start);
function scenario(fail=false, storage=new Map()) {
  const demo={id:'demo',driverId:'a',sampleRoadDemoV339:true,approachKm:0,loadedKm:0};
  const calls=[];let renders=0;
  const ctx={
    state:{user:{role:'admin'},routes:[demo],boardStartupV188:{active:false}},EMBEDDED_MODE:true,
    activeRoutes:()=>[demo],routeSwapDriverBuckets:()=>new Map(),driverById:()=>({id:'a'}),
    routeSwapPosition:()=>({coords:[52,19],route:{id:'prior'}}),routeSwapEndpoint:(route,type)=>type==='pickup'?{lat:52.1,lng:19.1}:{lat:53,lng:20},
    routeSwapEndpointLabel:(route,type)=>type, scheduleUiSync(){},
    routeSwapValidPoint:p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lng),
    requestTruckRouting:async(mode,payload)=>{calls.push({mode,...payload});if(fail)throw Error('offline');return {results:payload.destinations.map(()=>({ok:true,distanceKm:payload.vehicleState==='empty'?64.3:271.6}))};},
    applyAutomaticCarrierCost:route=>{route.cost=route.approachKm+route.loadedKm;},
    document:{activeElement:null},syncBoardOnly:()=>renders++,syncDetailsPanel(){},setTimeout,clearTimeout,WeakMap,Map,Set,JSON,Number,Math
  };
  ctx.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
  return {demo,calls,ctx,storage,renders:()=>renders};
}
(async()=>{
  const ok=scenario();await ok.ctx.runSampleRoadDemosV339();
  assert.deepEqual(ok.calls.map(c=>c.vehicleState),['empty','loaded']);
  assert.ok(ok.calls.every(c=>c.mode==='matrix'));
  assert.equal(ok.demo.approachKm,64);assert.equal(ok.demo.loadedKm,272);
  assert.equal(ok.demo.sampleRoadRoutingStatusV339,'ready');assert.match(ok.demo.notes,/TomTom/);assert.equal(ok.renders(),1);
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
  console.log('Przykłady: wynik routingu, identyczne punkty mapy i jawny brak danych przy błędzie: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
