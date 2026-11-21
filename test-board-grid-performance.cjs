const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const html = fs.readFileSync('public/tms.html', 'utf8');
const start = html.indexOf('    const WEEK_SETTLEMENT_COLUMN_PX = 36;');
const end = html.indexOf('    function normalizedUiScale(', start);
assert.ok(start >= 0 && end > start, 'Nie znaleziono obliczeń siatki planu');

const dates = Array.from({ length:13 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 10, 20 + index));
  return date.toISOString().slice(0, 10);
});
const context = {
  Date, Math, Number, Set, WeakMap,
  dateList:() => dates,
  addDaysToIso:(value, days) => {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

assert.equal(vm.runInContext('boardDayGridColumn(0)', context), 5);
assert.equal(vm.runInContext('boardDayGridColumn(3)', context), 9);
assert.equal(vm.runInContext('boardDayGridColumn(10)', context), 17);
assert.equal(vm.runInContext('boardTimelineHourFromRatio(boardTimelinePercentForHour(72) / 100)', context), 72);

const run = vm.runInContext(`() => {
  let sum = 0;
  for (let driver = 0; driver < 100; driver += 1) {
    for (let day = 0; day < 13; day += 1) sum += boardDayGridColumn(day);
  }
  for (let route = 0; route < 1200; route += 1) {
    sum += boardTimelinePercentForHour((route * 13) % 312);
    sum += boardTimelinePercentForHour((route * 13 + 8) % 312, 'end');
  }
  return sum;
}`, context);
const durations = [];
for (let repeat = 0; repeat < 5; repeat += 1) {
  const startTime = performance.now();
  assert.ok(Number.isFinite(run()));
  durations.push(performance.now() - startTime);
}
durations.sort((a, b) => a - b);
console.log(`Siatka 100 kierowców i 1200 relacji: mediana ${durations[2].toFixed(1)} ms`);
