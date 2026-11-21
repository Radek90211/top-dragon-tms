const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/tms.html', 'utf8');
const section = (from, to) => {
  const start=html.indexOf(from), end=html.indexOf(to,start);
  assert.ok(start>=0 && end>start);
  return html.slice(start,end);
};
let lookups=0;
const drivers=Array.from({length:60},(_,index)=>({id:'driver-'+index,dispatcher:'TEST'}));
const cities=['Warszawa','Kraków','Gdańsk','Łódź','Wrocław'];
const context={
  DRIVERS:drivers, SEPTEMBER_RELATION_CITY_POOL_V167:cities, CARRIER_RATE_PER_KM:4,
  currentAppDate:()=> '2026-11-21',
  addDaysToIso:(iso,days)=>new Date(Date.parse(iso+'T12:00:00Z')+days*86400000).toISOString().slice(0,10),
  deterministicFleetValueV165:(index,seed,max)=>Math.abs(index+seed)%max,
  locationWithPostal:city=>{lookups++;return city+' 00-001';}, sampleRouteStreetAddressV223:()=> 'ul. Testowa',
  applySampleTransportProjectV252() {}, applyDailyTransportProjectsV255() {},
};
vm.createContext(context);
vm.runInContext(section('    function sampleRelationDatesV315()', '    const RELATION_CUTOFF_DATE_V315'),context);
vm.runInContext(section('    const SAMPLE_ROUTE_LOCATION_LABELS_V333', '    const SAMPLE_TRANSPORT_PROJECTS_V252'),context);
vm.runInContext(section('    function buildSeptemberRelationsV167(', '    function relationMomentV169('),context);
const routes=vm.runInContext('buildSeptemberRelationsV167()',context);
assert.equal(routes.length,3360);
assert.equal(lookups,cities.length,'Kod miejscowości obliczamy raz zamiast 6720 razy');
assert.ok(routes.every(route=>route.load.endsWith('00-001')&&route.unload.endsWith('00-001')));
assert.ok(routes.every(route=>route.sampleScheduleVersion===315 && route.startHour===0 && route.endHour===24));
assert.equal(routes.at(-1).date,'2026-11-22');
routes[0].load='Zmieniona miejscowość';
const next=vm.runInContext('buildSeptemberRelationsV167()',context);
assert.notEqual(next[0].load,routes[0].load,'Każdy zestaw relacji musi mieć oddzielne obiekty');
assert.equal(lookups,cities.length,'Kolejne generowanie nie powtarza normalizacji miejscowości');
console.log('3360 przykładowych relacji: zgodne daty i niezależne obiekty; lokalizacje obliczane raz: OK');
