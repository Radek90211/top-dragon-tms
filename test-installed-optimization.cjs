const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {performance} = require('node:perf_hooks');
const html = fs.readFileSync('public/tms.html', 'utf8');
const addon = fs.readFileSync('public/tms-route-optimization-v311.js', 'utf8');
const helpers = html.slice(html.indexOf('    function routeSwapTime('), html.indexOf('    async function buildRouteSwapSuggestions('));
const signature = html.slice(html.indexOf('    function routeSwapSignature('),html.indexOf('    function routeSwapTime('));
const visibility = html.slice(html.indexOf('    function routeSwapSuggestionsForUser('),html.indexOf('    function routeSwapShortLine('));

function setup(routes, drivers, admin = true) {
  let scheduled=0, yields=0, startReads=0, endReads=0, pointReads=0, current=true;
  const context = {
    state:{user:{role:admin?'admin':'spedytor'},routeSwapSuggestions:[]}, ROUTE_SWAP_MIN_SAVING_KM:49, ROUTE_SWAP_MAX_APPROACH_KM:1000,
    window:{}, document:{head:{appendChild(){}},createElement:()=>({}),getElementById:()=>null,querySelectorAll:()=>[]},
    performance, console,
    setTimeout:callback=>setImmediate(()=>{yields++;callback();}), clearInterval(){},
    currentAppDate:()=> '2026-11-22',
    addDaysToIso:(value,days)=>new Date(Date.parse(value+'T00:00:00Z')+days*86400000).toISOString().slice(0,10),
    isoDayDifference:(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/86400000),
    activeRoutes:()=>routes,isAdminUser:()=>admin,isFreeDayRoute:()=>false,
    operationalPointForRoute:route=>{pointReads++;return {lat:0,lng:route.loadPoint/1000};},
    routeGlobalStart:route=>{startReads++;return Date.parse(route.date)/3600000+(route.startHour||0);},
    routeGlobalEnd:route=>{endReads++;return Date.parse(route.date)/3600000+(route.endHour||1);},
    driverById:id=>drivers.find(driver=>driver.id===id),routeDispatcherLogin:route=>drivers.find(d=>d.id===route.driverId)?.dispatcher,
    driverLoadCompatibility:()=>({ok:true}),finalUnloadPointForRoute:route=>({lat:0,lng:route.unloadPoint/1000}),
    driverBasePoint:driver=>({lat:0,lng:driver.basePoint/1000}),preferredMainRoadKm:(a,b)=>Math.abs(a[1]-b[1])*1000,
    operationalDrivers:()=>drivers,displayCity:value=>value,
    tmsFeatureEnabledV261:()=>true,syncRouteSwapDock(){},syncBoardOnly(){},
    scheduleRouteSwapAnalysis:()=>{scheduled++;},
    routeSwapRouteSet(){},routeSwapSignature(){},buildRouteSwapSuggestions(){},renderRouteSwapDock(){},renderRouteSwapGuide(){},highlightRouteSwapSuggestion(){},
  };
  vm.createContext(context);
  vm.runInContext(helpers,context);
  vm.runInContext(signature+visibility,context);
  vm.runInContext(addon,context);
  assert.equal(scheduled,1,'Instalacja ma zlecać analizę w tle');
  assert.equal(pointReads,0,'Doładowanie dodatku nie może analizować tras w tym samym zadaniu');
  assert.ok(Array.isArray(context.state.routeSwapSuggestions),'Nie wolno umieścić Promise w stanie propozycji');
  return {context,stats:()=>({yields,startReads,endReads,pointReads}),cancel:()=>{current=false;},isCurrent:()=>current};
}

(async()=>{
  const drivers=[{id:'a',driver:'A',dispatcher:'SP1',basePoint:0},{id:'b',driver:'B',dispatcher:'SP2',basePoint:400}];
  const routes=[
    {id:'one',driverId:'a',date:'2026-11-22',load:'Wschód',unload:'Zachód',loadPoint:400,unloadPoint:0,sampleRelationV167:true},
    {id:'two',driverId:'b',date:'2026-11-22',load:'Zachód',unload:'Wschód',loadPoint:0,unloadPoint:400,sampleRelationV167:true},
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
  assert.equal(suggestions[0].savingKm,800);
  assert.equal(suggestions[0].sampleOptimization,true);
  assert.ok(test.stats().yields>0);
  assert.equal(setup(routes,drivers,false).context.routeSwapRouteSet().length,0,'Przykłady pozostają ograniczone do administratora');

  const ctx=test.context;
  for (const [before,after,expected] of [[49,0,null],[50,0,50],[100.4,50.6,null],[100.6,50.4,51],[1000,950,50],[999,0,999],[1000,0,null],[1250,0,null],[NaN,0,null],[100,Infinity,null],[100,-1,null]]) {
    assert.equal(ctx.routeSwapSaving(before,after)?.savingKm??null,expected,`Próg i zaokrąglenia: ${before} → ${after}`);
  }
  assert.equal(ctx.routeSwapDistance({coords:[0,0]},{loadPoint:999}),999);
  assert.ok(Number.isNaN(ctx.routeSwapDistance({coords:[0,0]},{loadPoint:1000})),'Dolot 1000 km nie może zostać obcięty ani pokazany');
  assert.ok(Number.isNaN(ctx.routeSwapDistance({coords:[0,0]},{loadPoint:1250})),'Dolot powyżej 1000 km musi odrzucić propozycję');
  for(const km of [49,50]) {
    const item={id:'threshold',driverId:'a',date:'2026-11-22',load:'X',unload:'Y',loadPoint:km,unloadPoint:km};
    const boundary=setup([item],[drivers[0],{...drivers[1],basePoint:km}]).context;
    const found=await boundary.buildRouteSwapSuggestions([item],()=>true);
    assert.equal(found.length,km===49?0:1,`Zainstalowany analizator: granica ${km} km`);
  }
  ctx.state.routeSwapSuggestions=[{currentKm:100,swappedKm:51,savingKm:49},{currentKm:100,swappedKm:50,savingKm:50},{currentKm:100,swappedKm:50,savingKm:51}];
  assert.equal(ctx.routeSwapSuggestionsForUser().length,1,'Widok odrzuca również stare propozycje poniżej progu i niespójne wyniki');
  ctx.state.routeSwapSuggestions=[{currentKm:1250,swappedKm:0,savingKm:1250}];
  assert.equal(ctx.routeSwapSuggestionsForUser().length,0,'Wcześniejsza zawyżona propozycja nie może pozostać w panelu');
  const oldSignature=ctx.routeSwapSignature(routes);
  drivers[0].basePoint=10;
  assert.notEqual(ctx.routeSwapSignature(routes),oldSignature,'Zmiana bazy wymaga ponownego liczenia');
  drivers[0].basePoint=0;
  // Oszczędność samego dojazdu znika po doliczeniu kolejnego zlecenia.
  const withNext=[
    {id:'move',driverId:'a',date:'2026-11-22',startHour:1,endHour:2,load:'X',unload:'Y',loadPoint:1000,unloadPoint:1000},
    {id:'next',driverId:'a',date:'2026-11-22',startHour:3,endHour:4,load:'Y',unload:'Y',loadPoint:1000,unloadPoint:1000},
  ];
  const nextTest=setup(withNext,drivers);
  const nextSuggestions=await nextTest.context.buildRouteSwapSuggestions([withNext[0]],()=>true);
  assert.equal(nextSuggestions.length,0,'Nie pokazuj pozornej oszczędności kosztem dojazdu do następnej relacji');

  // Niezależne przeliczenie całych planów, w tym zmian godziny i dnia.
  function total(plan,driver) {
    const ordered=plan.filter(r=>r.driverId===driver.id).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.startHour-b.startHour);
    let at=driver.basePoint,km=0;
    for(const r of ordered){km+=Math.abs(at-r.loadPoint);at=r.unloadPoint;}
    return km;
  }
  let seed=917;
  const rand=()=>{seed=(seed*48271)%2147483647;return seed%1000;};
  for(let run=0;run<40;run++) {
    const plan=drivers.flatMap(d=>Array.from({length:3},(_,i)=>{const hour=[1,d.id==='a'||run%2===0?5:9,13][i];return {id:d.id+i,driverId:d.id,date:d.id==='b'&&run%3===0?'2026-11-23':'2026-11-22',startHour:hour,endHour:hour+1,load:'X',unload:'Y',loadPoint:rand(),unloadPoint:rand()};}));
    const a=plan[1],b=plan[4];
    const check=setup(plan,drivers).context;
    const buckets=new Map(drivers.map(d=>[d.id,plan.filter(r=>r.driverId===d.id)]));
    const before=drivers.reduce((sum,d)=>sum+total(plan,d),0);
    const swapped=plan.map(r=>({...r,driverId:r===a?'b':r===b?'a':r.driverId}));
    const after=drivers.reduce((sum,d)=>sum+total(swapped,d),0);
    const cost=check.routeSwapChangeCost(drivers[0],a,drivers[1],b,buckets,new WeakMap());
    assert.ok(Math.abs((cost.currentKm-cost.candidateKm)-(before-after))<1e-8,'Zmiana lokalnych odcinków musi zgadzać się z przeliczeniem całego planu');
    // Przeniesienie na wolnego kierowcę; źródło ma kolejną relację.
    const transferPlan=plan.filter(r=>r.driverId==='a');
    const transferBuckets=new Map([['a',transferPlan],['b',[]]]);
    const transferCost=check.routeSwapChangeCost(drivers[0],a,drivers[1],null,transferBuckets,new WeakMap());
    const transferred=transferPlan.map(r=>({...r,driverId:r===a?'b':'a'}));
    const transferDelta=drivers.reduce((sum,d)=>sum+total(transferPlan,d)-total(transferred,d),0);
    assert.ok(Math.abs(transferCost.currentKm-transferCost.candidateKm-transferDelta)<1e-8,'Przeniesienie musi zgadzać się z przeliczeniem obu pełnych planów');
  }
  const missing=[{...withNext[0],unloadPoint:undefined},withNext[1]];
  const unknown=setup(missing,drivers).context;
  assert.equal(unknown.routeSwapPosition(drivers[0],missing[1],new Map([['a',missing]]),new Set(['next']),new WeakMap()),null,'Nie zastępuj nieznanego ostatniego rozładunku bazą');
  for(const saving of suggestions){assert.ok(saving.savingKm>49);assert.equal(saving.currentKm-saving.swappedKm,saving.savingKm);}
  const historySignature=nextTest.context.routeSwapSignature([withNext[0]]);
  withNext[1].routeOriginCoords=[0,1];
  assert.notEqual(nextTest.context.routeSwapSignature([withNext[0]]),historySignature,'Zmiana następnej relacji wymaga przeliczenia');
  const mixed=setup([...routes,...withNext],drivers).context;
  assert.equal(mixed.routeSwapDriverBuckets(false).get('a').length,2,'Przykłady nie zmieniają rzeczywistego planu');
  assert.equal(mixed.routeSwapDriverBuckets(true).get('a').length,1,'Plan przykładowy jest liczony osobno');

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
  const measured=setup(fullRoutes,fullDrivers);
  const begin=performance.now();
  await measured.context.buildRouteSwapSuggestions(measured.context.routeSwapRouteSet(),()=>true);
  console.log(`Pełna analiza dodatku: ${(performance.now()-begin).toFixed(0)} ms; oddanie sterowania: ${measured.stats().yields} razy`);
  console.log('Zainstalowany dodatek: analiza w tle, działająca kolejka zdarzeń, poprawne wyniki, przykłady i anulowanie: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
