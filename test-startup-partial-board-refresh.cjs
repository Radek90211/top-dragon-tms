const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/tms.html', 'utf8');

function extract(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from);
  return html.slice(from, to);
}

const driver = { id: 'driver' };
const weeks = ['2026-11-16', '2026-11-23'];
function makeCell(weekStart, matches) {
  return {
    dataset: { weekStart, driverId: driver.id },
    style: { gridRow: '2' },
    isEqualNode: next => matches && next.weekStart === weekStart,
    contains: () => false,
    replaceWith(next) { this.replacement = next; },
  };
}
const unchanged = makeCell(weeks[0], true);
const changed = makeCell(weeks[0], false);
const otherWeek = makeCell(weeks[1], false);
const template = { content: {}, set innerHTML(markup) { this.content.firstElementChild = { weekStart: markup }; } };
const ctx = {
  document: { activeElement: null, createElement: () => template, querySelectorAll: () => [unchanged, changed, otherWeek] },
  window: {}, driverById: () => driver,
  boardWeekSettlementBoundaries: () => weeks.map(weekStart => ({ weekStart })),
  renderWeekSettlementCell: (_, row, boundary) => {
    assert.equal(row, '2');
    return boundary.weekStart;
  },
};
vm.runInNewContext(extract('      window.syncBoardWeekSettlementCells =', '      function statusBox3L50('), ctx);
ctx.window.syncBoardWeekSettlementCells([{ weekStart: weeks[0] }]);
assert.equal(changed.replacement.weekStart, weeks[0]);
assert.equal(unchanged.replacement, undefined);
assert.equal(otherWeek.replacement, undefined);

const makeTile = (id, current) => ({
  dataset: { routeId: id },
  querySelector: () => current && { outerHTML: current, remove: () => { current = ''; } },
  insertAdjacentHTML(_, markup) { current = markup; },
  marker: () => current,
});
const fresh = makeTile('new', '');
const removed = makeTile('old', 'stary');
const same = makeTile('same', 'bez zmian');
ctx.document.querySelectorAll = () => [fresh, removed, same];
ctx.activeRoutes = () => [{ id:'new', marker:'nowy' }, { id:'old' }, { id:'same', marker:'bez zmian' }];
ctx.beginOperationalRenderCycle = () => {};
ctx.renderRouteQueueMatchMarkers = route => route?.marker || '';
vm.runInNewContext(extract('    function syncBoardQueueMatchMarkers()', '    function renderTimelineOverlay('), ctx);
ctx.syncBoardQueueMatchMarkers();
assert.equal(fresh.marker(), 'nowy');
assert.equal(removed.marker(), '');
assert.equal(same.marker(), 'bez zmian');

console.log('Rozliczenia i kolejki aktualizują wybrane elementy bez wymiany siatki planu.');
