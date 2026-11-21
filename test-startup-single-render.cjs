const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/tms.html', 'utf8');
function section(from, to) {
  const start = html.indexOf(from), end = html.indexOf(to, start);
  assert.ok(start >= 0 && end > start, from);
  return html.slice(start, end);
}
const messageStart = html.indexOf('    window.addEventListener("message", event => {');
const messageEnd = html.indexOf('    if (EMBEDDED_MODE) {\r\n      window.parent?.postMessage({ type: "top-dragon-ready"', messageStart);
assert.ok(messageEnd > messageStart);
const fleetStart = html.indexOf('      window.applySupabaseFleetRows = function(rows)');
const fleetEnd = html.indexOf('      window.handleFleetOperationResult', fleetStart);

for (const order of [['users','fleet','relations'], ['relations','fleet','users'], ['fleet','users','relations']]) {
  let handler, renders = 0, ready = 0;
  const parent = {postMessage:message => { if (message.type === 'top-dragon-view-ready') ready++; }};
  const context = {
    state:{user:{role:'admin',supabaseRole:'admin',supabaseId:'admin'}, routes:[],mapVisibleDriverIds:{}},
    USERS:[], DRIVERS:[], DRIVER_HOME_DISPATCHERS:new Map(), CARRIER_RATE_HISTORY_BY_ID:new Map(),
    window:{location:{origin:'http://localhost'},parent,addEventListener:(type, callback) => { if (type === 'message') handler = callback; }},
    document:{querySelector:() => null}, EMBEDDED_MODE:true,
    setTimeout:() => 1, clearTimeout() {},
    render:() => { renders++; }, renderKeepingScroll:() => { renders++; }, syncBoardOnly:() => { renders++; },
    reportEmbeddedStartupPhase() {}, boardRenderCache:null,cachedPlanMainFragment:null,
    internalRoleFromSupabase:role=>role, normalizeEmbeddedLogin:user=>user.displayName,
    syncDispatcherColorStyles() {}, syncUnloadMapCard() {}, invalidateFleetCaches() {},
    applyStoredDriverAssignments() {}, ensureSeptemberRelationsV167:routes=>routes,
    cloneData:value=>({...value}), centralRelationsSetFingerprint:routes=>JSON.stringify(routes),
    centralRouteBranchId:route=>route._centralBranchId, centralRelationKey:(branch,id)=>branch+'|'+id,
    centralRouteFingerprint:route=>JSON.stringify(route), pendingCentralAccountingPatchForKey:()=>null,
    CENTRAL_RELATION_PENDING_DELETE:new Set(),CENTRAL_RELATION_PENDING_UPSERT:new Set(),CENTRAL_RELATION_BASELINE:new Map(),
    invalidateCombinedClientHistoryCache() {},scheduleCentralRelationsDiff() {}, CENTRAL_RELATIONS_READY:false,
  };
  vm.createContext(context);
  vm.runInContext(section('    const BOARD_STARTUP_RECEIVED_V188', '    function applyAuthenticatedUser('), context);
  vm.runInContext(section('    function applyCentralRelationsData(', '    function syncCentralRelationsDiff('), context);
  vm.runInContext(html.slice(fleetStart, fleetEnd), context);
  vm.runInContext(html.slice(messageStart, messageEnd), context);
  vm.runInContext('beginBoardStartupV188()', context);
  const messages = {
    users:{type:'top-dragon-user-directory',profiles:[]},
    fleet:{type:'top-dragon-fleet-data',rows:[]},
    relations:{type:'top-dragon-relations-data',rows:[{id:'route',branchId:'branch',payload:{id:'route',driverId:'driver'}}]},
  };
  order.forEach((part, index) => {
    handler({origin:'http://localhost',source:parent,data:messages[part]});
    assert.equal(renders, index === 2 ? 1 : 0, `Tylko jeden render po komplecie danych: ${order}`);
  });
  assert.equal(ready, 1);
  handler({origin:'http://localhost',source:parent,data:{type:'top-dragon-relations-data',rows:[{id:'new',branchId:'branch',payload:{id:'new',driverId:'driver'}}]}});
  assert.equal(renders, 2, 'Późniejsza aktualizacja Realtime nadal odświeża plan');
}
console.log('Start: jeden pełny render dla każdej kolejności danych; aktualizacje po starcie działają: OK');
