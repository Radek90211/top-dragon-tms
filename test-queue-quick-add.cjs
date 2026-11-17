const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('public/tms.html', 'utf8');
const queueCode = html.slice(html.indexOf('    function queueOutboxKey()'), html.indexOf('    function archiveCentralLoadQueueRoute('));
const quickCode = fs.readFileSync('public/tms-ai-quick-add-v312.js', 'utf8');
const storage = new Map();
const sent = [];
const context = {
  console, Date, Math, JSON, Map, Set, Boolean, String, Number, Array, Object,
  state: { user: { login: 'test', branchId: 'branch', branch: 'Oddział', role: 'spedytor' }, futureRoutes: [], proposedLoads: [], reportDate: '2026-11-17' },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  window: { location: { origin: 'http://localhost' }, parent: { postMessage: message => sent.push(message) } },
  document: { getElementById: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, content: {}, set innerHTML(value) {} }), head: { appendChild() {} } },
  EMBEDDED_MODE: true, CENTRAL_LOAD_QUEUE_READY: false,
  CENTRAL_LOAD_QUEUE_BASELINE: new Map(), CENTRAL_LOAD_QUEUE_OWNER: new Map(), CENTRAL_LOAD_QUEUE_PENDING_UPSERT: new Set(), CENTRAL_LOAD_QUEUE_PENDING_DELETE: new Set(), CENTRAL_LOAD_QUEUE_PENDING_SINCE: new Map(),
  USERS: [], cloneData: value => JSON.parse(JSON.stringify(value)),
  renderKeepingScroll() {}, syncProposedPanel() {}, syncFuturePanel() {}, syncFutureButton() {}, scheduleCentralLoadQueueDiff() {}, archiveExpiredProposedLoadsV235() {},
  renderQueueAddControl() {}, renderTextImportModal() {}, analyzeTextOrdersToQueue() {}, renderFutureRouteCard() {}, renderProposedLoadCard() {}, renderAddModal() {}, saveNewRoute() {},
  createProposedLoadFromTextItem: item => ({ ...item }), scheduleSavedRoutePointGeocodes() {},
  saveTextImportState: () => 'Warszawa → Berlin', setAiAnalyzerBusy() {}, syncTextImportUi() {}, showAppMessage() {},
  requestAiAnalyzer: async () => ({}), normalizeTextOrderAnalysis: () => [{ load: 'Warszawa', unload: 'Berlin', date: '2026-11-17' }],
  setTimeout() {}, setInterval() {}, clearInterval() {}, esc: String,
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(queueCode, context);
vm.runInContext(quickCode, context);

(async () => {
  vm.runInContext('applyCentralLoadQueueData({rows: []})', context);
  for (const target of ['proposed', 'future']) {
    context.state.aiImportTarget = target;
    await context.window.analyzeTextOrdersToQueue();
    const list = target === 'proposed' ? context.state.proposedLoads : context.state.futureRoutes;
    assert.equal(list.length, 1, `${target}: entry appears immediately`);
    assert.equal(list[0].dateDisplay, '');
    assert.equal(list[0].dateUnknown, true);
    assert.equal(list[0].date, '');
    assert(sent.some(message => message.type === 'top-dragon-load-queue-upsert' && message.queueType === target));
  }
  const remote = sent.filter(message => message.type === 'top-dragon-load-queue-upsert').map(message => ({ branchId: message.branchId, queueType: message.queueType, payload: message.load }));
  vm.runInContext('applyCentralLoadQueueData({rows: []})', context);
  assert.equal(context.state.proposedLoads.length, 1, 'pending free load survives stale refresh');
  assert.equal(context.state.futureRoutes.length, 1, 'pending planned route survives stale refresh');
  context.state.proposedLoads = [];
  context.state.futureRoutes = [];
  vm.runInContext('CENTRAL_LOAD_QUEUE_READY = false; CENTRAL_LOAD_QUEUE_PENDING_UPSERT.clear(); CENTRAL_LOAD_QUEUE_BASELINE.clear(); applyCentralLoadQueueData({rows: []})', context);
  assert.equal(context.state.proposedLoads.length, 1, 'free load restored after reload');
  assert.equal(context.state.futureRoutes.length, 1, 'planned route restored after reload');
  context.remote = remote;
  vm.runInContext('applyCentralLoadQueueData({rows: remote})', context);
  assert.equal(context.state.proposedLoads.length, 1);
  assert.equal(context.state.futureRoutes.length, 1);
  assert.equal(context.state.proposedLoads[0].dateDisplay, '');
  vm.runInContext(fs.readFileSync('public/tms-queue-dates.js', 'utf8'), context);
  for (const [kind, list] of [['proposed', context.state.proposedLoads], ['future', context.state.futureRoutes]]) {
    const route = list[0];
    const change = value => ({ target: { value }, stopPropagation() {} });
    context.window.saveQueueDateV314(change('2026-12-01'), kind, route.id, 'load');
    assert.equal(route.loadDate, '2026-12-01');
    assert.equal(route.dateUnknown, false);
    context.window.saveQueueDateV314(change('2026-11-30'), kind, route.id, 'unload');
    assert.equal(route.endDate, '', 'unload before load is rejected');
    context.window.saveQueueDateV314(change('2026-12-02'), kind, route.id, 'unload');
    assert.equal(route.endDate, '2026-12-02');
    context.state.user.login = 'other';
    context.window.saveQueueDateV314(change('2026-12-03'), kind, route.id, 'unload');
    assert.equal(route.endDate, '2026-12-02', 'another user cannot edit');
    context.state.user.login = 'test';
  }
  console.log('Both AI queues: add, refresh, restore, author date edit and permissions passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
