const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const html = fs.readFileSync('public/tms.html', 'utf8');
const start = html.indexOf('    function routeSwapRouteSet()');
const end = html.indexOf('    function routeSwapSuggestionsForUser()', start);
assert.ok(start >= 0 && end > start, 'Nie znaleziono wyboru tras do optymalizacji');
const routes = Array.from({ length:3360 }, (_, index) => ({
  id:`route-${index}`, driverId:`driver-${index % 60}`,
  date:new Date(Date.UTC(2026, 8, 28 + Math.floor(index / 60))).toISOString().slice(0, 10),
  load:'Łódź', unload:'Warszawa'
}));
let startReads = 0;
let endReads = 0;
const drivers = Array.from({ length:60 }, (_, index) => ({ id:`driver-${index}`, driver:`Kierowca ${index}`, dispatcher:`Spedytor ${index}` }));
const context = {
  Date, Math, String,
  Map, Set, WeakMap, Number,
  state:{ user:{ role:'admin' } },
  isAdminUser:() => true,
  activeRoutes:() => routes,
  isFreeDayRoute:() => false,
  operationalPointForRoute:route => ({ lat:51, lng:14 + Number(route.driverId.split('-')[1]) / 10 }),
  routeGlobalStart:route => { startReads += 1; return Date.parse(`${route.date}T00:00:00Z`); },
  routeGlobalEnd:route => { endReads += 1; return Date.parse(`${route.date}T00:00:00Z`) + 86400000; },
  driverById:id => drivers.find(driver => driver.id === id),
  routeDispatcherLogin:route => drivers.find(driver => driver.id === route.driverId)?.dispatcher,
  driverLoadCompatibility:() => ({ ok:true }),
  finalUnloadPointForRoute:() => null,
  driverBasePoint:driver => ({ lat:51, lng:14 + Number(driver.id.split('-')[1]) / 10 }),
  preferredMainRoadKm:(from, to) => Math.abs(from[1] - to[1]) * 1000,
  operationalDrivers:() => drivers,
  displayCity:value => value,
  setTimeout:resolve => resolve(),
  ROUTE_SWAP_MAX_ROUTES:80,
  ROUTE_SWAP_MIN_SAVING_KM:49
};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);
const run = vm.runInContext('routeSwapRouteSet', context);
const durations = [];
for (let repeat = 0; repeat < 5; repeat += 1) {
  const startTime = performance.now();
  const selected = run();
  assert.equal(selected.length, 80);
  assert.equal(selected[0].date, '2026-09-28');
  durations.push(performance.now() - startTime);
}
durations.sort((a, b) => a - b);
console.log(`Wybór 80 z 3360 relacji: mediana ${durations[2].toFixed(1)} ms, odczyty czasu ${startReads / 5}`);

(async () => {
  startReads = 0;
  endReads = 0;
  const begin = performance.now();
  const suggestions = await vm.runInContext('buildRouteSwapSuggestions(routeSwapRouteSet(), () => true)', context);
  assert.ok(Array.isArray(suggestions));
  console.log(`Analiza 3360 relacji: ${(performance.now() - begin).toFixed(1)} ms, odczyty początku ${startReads}, końca ${endReads}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
