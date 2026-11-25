const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const html = fs.readFileSync('public/tms.html', 'utf8');
const slice = (from, to) => {
  const start = html.indexOf(from);
  const end = html.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Nie znaleziono ${from}`);
  return html.slice(start, end);
};
const day = index => new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10);
const dates = Array.from({ length:13 }, (_, index) => day(78 + index));
const drivers = Array.from({ length:60 }, (_, index) => `driver-${index}`);
const routes = drivers.flatMap(driverId => Array.from({ length:91 }, (_, index) => ({
  id:`${driverId}-${index}`, driverId, date:day(index), startHour:0, endHour:24
})));
const dateIndex = new Map(dates.map((date, index) => [date, index]));
const offset = date => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / 86400000) * 24;
const context = {
  Date, Map, Set, Math, Number,
  state:{ routes },
  dateList:() => dates,
  commercialWarningCutoffDate:() => dates[0],
  buildDateIndexMap:list => new Map(list.map((date, index) => [date, index])),
  routeStartHour:route => route.startHour,
  cellKey:(driverId, date) => `${driverId}__${date}`,
  routeGlobalStart:route => offset(route.date) + route.startHour,
  routeGlobalEnd:route => offset(route.endDate || route.date) + route.endHour,
  routeOverlapsDate:(route, date) => {
    const index = dateIndex.get(date);
    return index !== undefined && offset(route.date) + route.startHour < (index + 1) * 24 && offset(route.endDate || route.date) + route.endHour > index * 24;
  },
  totalKm:() => 0,
  profit:() => 0
};
vm.createContext(context);
vm.runInContext('let boardRenderCache = null; function activeRoutes() { return boardRenderCache?.activeRoutes || state.routes; }', context);
vm.runInContext(slice('    function routesForCell(driverId, date)', '    function routeFor(driverId, date)'), context);
vm.runInContext(slice('    function createBoardRenderCache(dates)', '    const WEEK_SETTLEMENT_COLUMN_PX = 36;'), context);

const run = vm.runInContext(`() => withBoardRenderCache(dateList(), () => {
  let count = 0;
  for (const driverId of ${JSON.stringify(drivers)}) {
    for (const date of dateList()) count += routesForCell(driverId, date).length;
  }
  return count;
})`, context);
const durations = [];
for (let repeat = 0; repeat < 5; repeat += 1) {
  const startTime = performance.now();
  assert.equal(run(), 60 * 13);
  durations.push(performance.now() - startTime);
}
durations.sort((a, b) => a - b);
console.log(`Komórki 60 kierowców i 5460 relacji: mediana ${durations[2].toFixed(1)} ms`);

routes.push({ id:'kilka-dni', driverId:drivers[0], date:day(80), startHour:12, endDate:day(82), endHour:12 });
const coveredDates = vm.runInContext(`withBoardRenderCache(dateList(), () => dateList().filter(date => routesForCell('${drivers[0]}', date).some(route => route.id === 'kilka-dni')))`, context);
assert.deepEqual(Array.from(coveredDates), [day(80), day(81), day(82)], 'Relacja wielodniowa musi być widoczna w każdym objętym dniu');
