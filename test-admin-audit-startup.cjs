const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/main.js', 'utf8');
const auditStart = source.indexOf('async function loadCentralAudit(');
const auditEnd = source.indexOf('async function syncCentralAuditToTms(', auditStart);
const dashboardStart = source.indexOf('async function renderDashboard(');
const dashboardEnd = source.indexOf('async function routeSession(', dashboardStart);
assert.ok(auditStart >= 0 && auditEnd > auditStart && dashboardEnd > dashboardStart);
assert.doesNotMatch(source.slice(dashboardStart, dashboardEnd), /syncCentralAuditToTms\(/,
  'Logowanie administratora nie może pobierać całej historii operacji');

const rows = Array.from({ length: 1200 }, (_, index) => ({
  id: index + 1,
  action: 'Test',
  created_at: new Date(Date.UTC(2026, 10, 21, 0, 0, index)).toISOString(),
}));
const ranges = [];
const supabase = {
  from(table) {
    assert.equal(table, 'operation_audit');
    return {
      select() { return this; },
      order() { return this; },
      async range(from, to) {
        ranges.push([from, to]);
        return { data: rows.slice(from, to + 1), error: null };
      },
    };
  },
};
const context = { currentProfile: { role: 'admin' }, supabase };
vm.createContext(context);
const { loadCentralAudit, loadRecentCentralAudit } = vm.runInContext(
  `${source.slice(auditStart, auditEnd)}\n;({ loadCentralAudit, loadRecentCentralAudit })`, context,
);

(async () => {
  const recent = await loadRecentCentralAudit();
  assert.equal(recent.length, 500);
  assert.deepEqual(ranges, [[0, 499]]);
  ranges.length = 0;
  const complete = await loadCentralAudit();
  assert.equal(complete.length, 1200);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999]]);
  context.currentProfile = { role: 'dispatcher' };
  assert.equal((await loadRecentCentralAudit()).length, 0);
  console.log('Start administratora i historia operacji: OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
