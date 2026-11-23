const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('public/tms.html', 'utf8');
const start = html.indexOf('    const ROUTE_SWAP_MIN_SAVING_KM = 49;');
const end = html.indexOf('    function routeSwapSuggestionsForUser()', start);
assert.ok(start >= 0 && end > start, 'Nie znaleziono analizatora wymian tras');

const drivers = [
  { id:'a', driver:'A', dispatcher:'spedytor-a' },
  { id:'b', driver:'B', dispatcher:'spedytor-b' }
];
const routes = [
  { id:'previous-a', driverId:'a', date:'2026-11-19', unload:{lat:0,lng:0}, previous:true },
  { id:'previous-b', driverId:'b', date:'2026-11-19', unload:{lat:0,lng:100}, previous:true },
  { id:'one', driverId:'a', date:'2026-11-20', load:{ lat:0, lng:100 }, unload:{ lat:0, lng:100 } },
  { id:'two', driverId:'b', date:'2026-11-20', load:{ lat:0, lng:0 }, unload:{ lat:0, lng:0 } }
];
let yields = 0;
const context = {
  state:{ user:{ role:'admin' } },
  isAdminUser:() => true,
  activeRoutes:() => routes,
  isFreeDayRoute:() => false,
  operationalPointForRoute:(route, kind) => route[kind],
  routeGlobalStart:route => route.previous ? -24 : 0,
  routeGlobalEnd:route => route.previous ? -16 : 8,
  driverById:id => drivers.find(driver => driver.id === id),
  routeDispatcherLogin:route => drivers.find(driver => driver.id === route.driverId)?.dispatcher,
  driverLoadCompatibility:() => ({ ok:true }),
  finalUnloadPointForRoute:route => route.unload,
  driverBasePoint:driver => ({ lat:0, lng:driver.id === 'a' ? 0 : 100 }),
  preferredMainRoadKm:(a, b) => Math.abs(a[1] - b[1]),
  displayCity:() => '',
  operationalDrivers:() => drivers,
  setTimeout:resolve => { yields += 1; resolve(); }
};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

(async () => {
  const suggestions = await vm.runInContext('buildRouteSwapSuggestions(routeSwapRouteSet(), () => true)', context);
  assert.equal(suggestions[0]?.kind, 'swap');
  assert.equal(suggestions[0]?.savingKm, 200);
  assert.ok(yields > 0, 'Analizator powinien oddawać sterowanie');
  console.log('Analiza wymiany tras: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
