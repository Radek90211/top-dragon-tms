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
const drivers=Array.from({length:100},(_,index)=>({id:'driver-'+index,dispatcher:'TEST'}));
const cities=['Warszawa','Poznań','Wrocław','Gdańsk','Kraków','Katowice','Łódź','Szczecin','Lublin','Rzeszów','Białystok','Bydgoszcz','Olsztyn','Opole','Kielce','Toruń','Gorzów Wielkopolski','Zielona Góra','Radom','Gliwice','Częstochowa','Bielsko-Biała'];
const context={
  DRIVERS:drivers, SEPTEMBER_RELATION_CITY_POOL_V167:cities, CARRIER_RATE_PER_KM:4, RELATION_CUTOFF_DATE_V315:'2026-11-22',
  currentAppDate:()=> '2026-11-21',
  addDaysToIso:(iso,days)=>new Date(Date.parse(iso+'T12:00:00Z')+days*86400000).toISOString().slice(0,10),
  deterministicFleetValueV165:(index,seed,max)=>Math.abs(index+seed)%max,
  locationWithPostal:city=>{lookups++;return city+' 00-001';}, sampleRouteStreetAddressV223:()=> 'ul. Testowa',
  displayCity:label=>label.replace(' 00-001',''),
  applySampleTransportProjectV252() {}, applyDailyTransportProjectsV255() {},
};
vm.createContext(context);
vm.runInContext(section('    function sampleRelationDatesV315()', '    const RELATION_CUTOFF_DATE_V315'),context);
vm.runInContext(section('    const SAMPLE_ROUTE_LOCATION_LABELS_V333', '    const SAMPLE_TRANSPORT_PROJECTS_V252'),context);
vm.runInContext(section('    function buildSeptemberRelationsV167(', '    function relationMomentV169('),context);
const routes=vm.runInContext('buildSeptemberRelationsV167()',context);
assert.equal(routes.length,5700);
const roadDemos=routes.filter(route=>route.sampleRoadDemoV339);
assert.equal(roadDemos.length,300);
assert.ok(roadDemos.every(route=>route.date>='2026-11-21' && route.date<='2026-11-23' && route.approachKm===0 && route.loadedKm===0 && /oczekiwanie/.test(route.notes)),'Przykłady nie mogą udawać kilometrów przed odpowiedzią routera');
assert.ok(lookups<=42,'Kod każdej miejscowości obliczamy tylko raz');
assert.ok(routes.every(route=>route.load.endsWith('00-001')&&route.unload.endsWith('00-001')));
assert.ok(routes.every(route=>route.sampleScheduleVersion===348 && route.startHour===0 && route.endHour===24));
assert.ok(roadDemos.every(route=>!route.loadAddress && !route.unloadAddress),'Punkty miast nie mogą udawać konkretnych adresów');
for (const date of ['2026-11-21','2026-11-22','2026-11-23']) {
  const day = roadDemos.filter(route=>route.date===date);
  assert.equal(new Set(day.map(route=>[route.load,route.unload].sort().join('|'))).size, day.length, `Powtórzona relacja ${date}`);
  assert.ok(new Set(day.map(route=>route.unload)).size>=12, `Zbyt mało miast rozładunku ${date}`);
  assert.ok(day.every(route=>route.load!==route.unload), 'Załadunek i rozładunek muszą być różne');
}
assert.equal(new Set(roadDemos.map(route=>[route.load,route.unload].sort().join('|'))).size, roadDemos.length, 'Relacja ani jej odwrotność nie może powtórzyć się w żadnym z trzech dni');
for(let i=1;i<53;i+=2) assert.equal(routes[i+1].load,routes[i].unload,'Co drugi kolejny załadunek rozpoczyna się w mieście ostatniego rozładunku');
assert.equal(routes.at(-1).date,'2026-11-23');
routes[0].load='Zmieniona miejscowość';
const next=vm.runInContext('buildSeptemberRelationsV167()',context);
assert.notEqual(next[0].load,routes[0].load,'Każdy zestaw relacji musi mieć oddzielne obiekty');
assert.ok(lookups<=42,'Kolejne generowanie nie powtarza normalizacji miejscowości');
console.log('300 przykładów: brak powtarzających się par miejscowości także między dniami i w odwrotnym kierunku: OK');
