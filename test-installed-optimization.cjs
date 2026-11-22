const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {performance} = require('node:perf_hooks');
const html = fs.readFileSync('public/tms.html', 'utf8');
const addon = fs.readFileSync('public/tms-route-optimization-v311.js', 'utf8');
const helpers = html.slice(html.indexOf('    function routeSwapTime('), html.indexOf('    async function buildRouteSwapSuggestions('));

function setup(routes, drivers, admin = true) {
  let scheduled=0, yields=0, startReads=0, endReads=0, pointReads=0, current=true;
  const context = {
    state:{user:{role:admin?'admin':'spedytor'},routeSwapSuggestions:[]},
    window:{}, document:{head:{appendChild(){}},createElement:()=>({}),getElementById:()=>null,querySelectorAll:()=>[]},
    performance, console,
    setTimeout:callback=>setImmediate(()=>{yields++;callback();}), clearInterval(){},
    currentAppDate:()=> '2026-11-22',
    addDaysToIso:(value,days)=>new Date(Date.parse(value+'T00:00:00Z')+days*86400000).toISOString().slice(0,10),
    isoDayDifference:(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/86400000),
    activeRoutes:()=>routes,isAdminUser:()=>admin,isFreeDayRoute:()=>false,
    operationalPointForRoute:route=>{pointReads++;return {lat:0,lng:route.loadPoint};},
    routeGlobalStart:route=>{startReads++;return Date.parse(route.date)/3600000+(route.startHour||0);},
    routeGlobalEnd:route=>{endReads++;return Date.parse(route.date)/3600000+(route.endHour||1);},
    driverById:id=>drivers.find(driver=>driver.id===id),routeDispatcherLogin:route=>drivers.find(d=>d.id===route.driverId)?.dispatcher,
    driverLoadCompatibility:()=>({ok:true}),finalUnloadPointForRoute:route=>({lat:0,lng:route.unloadPoint}),
    driverBasePoint:driver=>({coords:[0,driver.basePoint]}),preferredMainRoadKm:(a,b)=>Math.abs(a[1]-b[1]),
    operationalDrivers:()=>drivers,displayCity:value=>value,
    routeSwapSuggestionsForUser:()=>[],syncRouteSwapDock(){},syncBoardOnly(){},
    scheduleRouteSwapAnalysis:()=>{scheduled++;},
    routeSwapRouteSet(){},routeSwapSignature(){},buildRouteSwapSuggestions(){},renderRouteSwapDock(){},renderRouteSwapGuide(){},highlightRouteSwapSuggestion(){},
  };
  vm.createContext(context);
  vm.runInContext(helpers,context);
  vm.runInContext(addon,context);
  assert.equal(scheduled,1,'Instalacja ma zlecać analizę w tle');
  assert.equal(pointReads,0,'Doładowanie dodatku nie może analizować tras w tym samym zadaniu');
  assert.ok(Array.isArray(context.state.routeSwapSuggestions),'Nie wolno umieścić Promise w stanie propozycji');
  return {context,stats:()=>({yields,startReads,endReads,pointReads}),cancel:()=>{current=false;},isCurrent:()=>current};
}

(async()=>{
  const drivers=[{id:'a',driver:'A',dispatcher:'SP1',basePoint:0},{id:'b',driver:'B',dispatcher:'SP2',basePoint:1000}];
  const routes=[
    {id:'one',driverId:'a',date:'2026-11-22',load:'Wschód',unload:'Zachód',loadPoint:1000,unloadPoint:0,sampleRelationV167:true},
    {id:'two',driverId:'b',date:'2026-11-22',load:'Zachód',unload:'Wschód',loadPoint:0,unloadPoint:1000,sampleRelationV167:true},
  ];
  const test=setup(routes,drivers);
  const selected=test.context.routeSwapRouteSet();
  assert.equal(selected.length,2,'Administrator widzi relacje przykładowe');
  const analysis=test.context.buildRouteSwapSuggestions(selected,test.isCurrent);
  assert.equal(typeof analysis.then,'function','Zainstalowany analizator musi działać asynchronicznie');
  let inputHandled=false;
  setImmediate(()=>{inputHandled=true;});
  const suggestions=await analysis;
  assert.equal(inputHandled,true,'Obsługa kliknięcia musi być możliwa podczas obliczeń');
  assert.equal(suggestions[0].kind,'swap');
  assert.equal(suggestions[0].savingKm,2000);
  assert.equal(suggestions[0].sampleOptimization,true);
  assert.ok(test.stats().yields>0);
  assert.equal(setup(routes,drivers,false).context.routeSwapRouteSet().length,0,'Przykłady pozostają ograniczone do administratora');

  // Pełny historyczny plan: geolokalizacja tylko wybranego przyszłego zestawu.
  const fullDrivers=Array.from({length:60},(_,i)=>({id:'d'+i,driver:'Kierowca '+i,dispatcher:'SP'+(i%3),basePoint:i*100}));
  const fullRoutes=Array.from({length:3360},(_,i)=>({id:'r'+i,driverId:'d'+(i%60),date:new Date(Date.UTC(2026,8,28+Math.floor(i/60))).toISOString().slice(0,10),load:'A',unload:'B',loadPoint:(i%60)*100,unloadPoint:0}));
  const full=setup(fullRoutes,fullDrivers);
  const future=full.context.routeSwapRouteSet();
  assert.equal(future.length,60);
  assert.equal(full.stats().pointReads,60,'Relacje archiwalne nie mogą uruchamiać geolokalizacji przy wyborze przyszłych tras');
  const pending=full.context.buildRouteSwapSuggestions(future,full.isCurrent);
  full.cancel();
  assert.equal((await pending).length,0,'Zmiana planu musi anulować nieaktualną analizę');
  assert.ok(full.stats().startReads<=fullRoutes.length*2,'Czasy tras są liczone raz na przebieg');
  console.log('Zainstalowany dodatek: analiza w tle, działająca kolejka zdarzeń, poprawne wyniki, przykłady i anulowanie: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
