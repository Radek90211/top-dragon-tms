const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/tms.html', 'utf8').replace(/\r\n/g, '\n');
function section(from, to) {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  assert.ok(a >= 0 && b > a, from);
  return html.slice(a, b);
}
const ctx = { Number, Math };
vm.createContext(ctx);
vm.runInContext(section('    function totalKm(route)', '    function routeOversizeCost('), ctx);
assert.equal(ctx.totalKm({ approachKm: 170, loadedKm: 94, baseKm: 80 }), 264);
assert.equal(ctx.totalKm({ approachKm: 0, loadedKm: 94 }), 94);
assert.equal(ctx.totalKm({ approachKm: 170, loadedKm: 94, manualTotalKm: 280 }), 280);

const routes = [
  { id:'old', driverId:'chosen', start:1, end:3 },
  { id:'latest', driverId:'chosen', start:4, end:5 },
  { id:'free', driverId:'chosen', start:5, end:6, free:true },
  { id:'other', driverId:'prefilled', start:4, end:6 },
  { id:'future', driverId:'chosen', start:9, end:10 }
];
const prior = {
  state:{prefill:{driverId:'prefilled',date:'2026-11-23',startHour:8}},
  document:{getElementById:id=>id==='new-driver'?{value:'chosen'}:{value:'2026-11-23'}},
  START_DATE:'2026-11-23', currentAppDate:()=> '2026-11-23',
  clampDateToWorkingWindow:x=>x, parseDateInput:x=>x, isoToDayIndex:()=>0,
  activeRoutes:()=>routes, routeGlobalEnd:r=>r.end, routeGlobalStart:r=>r.start,
  isFreeDayRoute:r=>Boolean(r.free), Number, String
};
vm.createContext(prior);
vm.runInContext(section('    function previousRouteBeforeNewRoute()', '    function setKmInputIfAuto('), prior);
vm.runInContext(section('    function previousRouteBeforeRoute(targetRoute)', '    function routeUsesApproach('), prior);
assert.equal(prior.previousRouteBeforeNewRoute().id, 'latest');
assert.equal(prior.previousRouteBeforeRoute({id:'target',driverId:'chosen',start:8}).id, 'latest');
assert.match(html, /numberInput\(route, "totalKm", "Kilometry relacji"\)/);
assert.doesNotMatch(html, /distanceKm: Number\(routeRoad\.distanceKm \|\| 0\)/);
const warnings={Number,String,isFreeDayRoute:()=>false,carrierCost:r=>r.cost};
vm.createContext(warnings);
vm.runInContext(section('    function routeMissingCommercialFields(', '    function routeCommercialWarningBadge('),warnings);
assert.deepEqual(Array.from(warnings.routeMissingCommercialFields({sampleRoadDemoV339:true,rate:100,cost:0,client:'Firma'})),[]);
assert.deepEqual(Array.from(warnings.routeMissingCommercialFields({sampleRoadDemoV339:true,sampleRoadRoutingStatusV339:'unavailable',rate:100,cost:0,client:'Firma'})),['koszt']);
assert.deepEqual(Array.from(warnings.routeMissingCommercialFields({rate:100,cost:0,client:'Firma'})),['koszt']);
console.log('Kilometry relacji: dolot + załadunek–rozładunek; właściwa poprzednia relacja: OK');
