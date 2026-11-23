const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/tms.html', 'utf8').replace(/\r\n/g, '\n');
const host = fs.readFileSync('src/main.js', 'utf8').replace(/\r\n/g, '\n');
function section(source, from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, from);
  return source.slice(start, end);
}
const ctx = { state:{user:{role:'spedytor',supabaseRole:'dispatcher',featurePermissions:{}}}, Boolean, String, Object };
vm.createContext(ctx);
vm.runInContext(section(html, '    function tmsFeatureEnabledV261(', '    function tmsCommercialViewEnabledV261('), ctx);
vm.runInContext(section(html, '    function canUseOperationalAi()', '    function renderPdfImportUi()'), ctx);
assert.equal(ctx.canUseOrderAnalyzer(), false, 'Brak wpisu oznacza wyłączony analizator');
assert.equal(ctx.tmsFeatureEnabledV261('orderNotes'), true, 'Dotychczasowe pola pozostają włączone');
ctx.state.user.featurePermissions = {orderNotes:false, orderAnalyzer:true};
assert.equal(ctx.canUseOrderAnalyzer(), true);
assert.equal(ctx.tmsFeatureEnabledV261('orderNotes'), false);
ctx.state.user = {role:'admin',supabaseRole:'admin',featurePermissions:{orderAnalyzer:false,orderNotes:false}};
assert.equal(ctx.canUseOrderAnalyzer(), true, 'Administrator ma pełny dostęp');
ctx.state.user.permissionPreview = true;
ctx.state.user.role = 'spedytor';
ctx.state.user.supabaseRole = 'dispatcher';
assert.equal(ctx.canUseOrderAnalyzer(), false, 'Podgląd uprawnień respektuje przełącznik');
const adminCtx = {Object, Array};
vm.createContext(adminCtx);
vm.runInContext(section(host, 'const USER_FEATURES = ', 'function renderUserFeatureControls(') + '\nthis.normalize = normalizedFeaturePermissions;', adminCtx);
assert.equal(adminCtx.normalize({}).orderAnalyzer, false);
assert.equal(adminCtx.normalize({orderAnalyzer:true}).orderAnalyzer, true);
assert.equal(adminCtx.normalize({}).orderNotes, true);
const route={id:'r1',driverId:'d1',load:'A',unload:'B',date:'2026-11-23',endDate:'2026-11-24',client:'Firma',notes:'uwaga',routeComment:'komentarz',driverNotes:'zachowane dane'};
const renderCtx={
  state:{routes:[route],selectedRouteId:'r1',detailsOpen:true,user:{role:'spedytor',login:'test'}},
  driverById:()=>({driver:'Kierowca',dispatcher:'test',carrier:'Firma',phone:'123'}),
  routeSms:()=> 'Treść SMS',canEditBoardRoute:()=>true,canDeleteBoardRoute:()=>true,
  formDisabledAttr:()=>'',hydrateRouteOrderImport(){},ROUTE_ORDER_IMPORTS:new Map(),
  canUseOrderAnalyzer:()=>false,attr:v=>String(v||''),esc:v=>String(v||''),
  renderRouteOrderDropzone:()=>'',dispatcherBadgeClass:()=>'',addDaysToIso:()=> '2026-11-24',
  clientOwnerBadge:()=>'',resolveClientForRoute:()=>null,numberInput:()=>'',renderFreightProfitabilityCalculator:()=>'',
  tmsFeatureEnabledV261:()=>renderCtx.enabled,START_DATE:'2026-11-23',encodeURIComponent,String,Number,Boolean,Map
};
vm.createContext(renderCtx);
vm.runInContext(section(html,'    function renderSidePanel()', '    function renderFreightProfitabilityCalculator('),renderCtx);
renderCtx.enabled=true;
const enabled=renderCtx.renderSidePanel();
for (const label of ['Uwagi do zlecenia','Komentarz do relacji','Wiadomość do kierowcy']) assert.ok(enabled.includes(label),label);
assert.ok(!enabled.includes('<summary>Informacje dla kierowcy</summary>'));
renderCtx.enabled=false;
const disabled=renderCtx.renderSidePanel();
for (const label of ['Uwagi do zlecenia','Komentarz do relacji','Wiadomość do kierowcy']) assert.ok(!disabled.includes(label),label);
assert.ok(disabled.includes('<!--relation-transfer-anchor-->'),'Oryginalny tekst i transfer muszą zachować punkt wstawienia');
assert.ok(!html.includes('title="Pokaż lub ukryj mapę i listę rozładunków"'));

async function apiScenario(role, permissions, textMode) {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test';
  process.env.OPENAI_API_KEY = 'test';
  const {default:handler} = await import('./api/openai-order-analysis.js');
  let openaiCalls = 0;
  const savedFetch = global.fetch;
  global.fetch = async url => {
    if (String(url).includes('/auth/v1/user')) return {ok:true,json:async()=>({id:'test-user'})};
    if (String(url).includes('/rest/v1/profiles')) return {ok:true,json:async()=>[{role,active:true,feature_permissions:permissions}]};
    openaiCalls++;
    return {ok:true,json:async()=>({output_text:JSON.stringify({routes:[]})})};
  };
  const req={method:'POST',headers:{authorization:'Bearer test','content-type':textMode?'application/json':'application/pdf'},body:Buffer.from(textMode?'{"text":"Warszawa → Łódź"}':'pdf')};
  const result={setHeader(){},status(value){this.code=value;return this;},json(value){this.body=value;}};
  const savedError=console.error; console.error=()=>{};
  try { await handler(req,result); return {status:result.code,openaiCalls}; }
  finally {global.fetch=savedFetch;console.error=savedError;}
}
(async()=>{
  assert.deepEqual(await apiScenario('dispatcher',{},false),{status:403,openaiCalls:0});
  assert.equal((await apiScenario('dispatcher',{orderAnalyzer:true},false)).openaiCalls,1);
  assert.equal((await apiScenario('admin',{},false)).openaiCalls,1);
  assert.equal((await apiScenario('dispatcher',{},true)).openaiCalls,1,'Analiza tekstu pozostaje dostępna');
  console.log('Uprawnienia pól i analizatora: domyślne wartości, indywidualne ustawienia i kontrola API: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
