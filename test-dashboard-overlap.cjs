const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/main.js', 'utf8');
const section = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Brak sekcji ${from}`);
  return source.slice(start, end);
};
const code = [
  section('function postInitialAuthToTms(', 'let openAdminDataTransferAfterAuth'),
  section('async function readCurrentFeaturePermissions(', 'async function refreshCurrentFeaturePermissions('),
  section('async function renderDashboard(', 'async function routeSession('),
].join('\n');

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

async function scenario(active) {
  const profileResponse = deferred();
  const permissionResponse = deferred();
  const posted = [];
  const frame = {
    contentDocument: { URL: 'http://localhost/tms.html?embedded=1' },
    contentWindow: { postMessage: (message) => posted.push(message) },
    addEventListener() {},
  };
  let frameCreated = false;
  let signedOut = false;
  const context = {
    app: { set innerHTML(value) { frameCreated = value.includes('id="tms-frame"'); } },
    document: { querySelector: (selector) => selector === '#tms-frame' ? frame : { addEventListener() {}, insertAdjacentHTML() {} } },
    window: { location: { origin: 'http://localhost', reload() {} } },
    buildParams: new URLSearchParams({ embedded: '1' }),
    hostViews: { begin: () => ({ signal: new AbortController().signal }), isCurrent: () => true },
    suspendTmsRuntimeForAdminPanel() {},
    clearTmsLoadingWatchdog() {},
    showTmsLoadingRecovery() {},
    setTimeout: () => 1,
    clearInterval() {},
    supabase: {
      from: (table) => {
        assert.equal(table, 'profiles');
        return { select() { return this; }, eq() { return this; }, maybeSingle: () => profileResponse.promise };
      },
      rpc: (name) => {
        assert.equal(name, 'get_tms_feature_permissions');
        return permissionResponse.promise;
      },
      auth: { signOut: async () => { signedOut = true; } },
    },
    buildTmsAuthMessage: (user, profile) => ({ type: 'top-dragon-auth', user, permissions: profile.feature_permissions }),
    startFeaturePermissionsRefresh() {},
    renderAdminPanel() {},
    renderLogin() {},
    roleLabel: () => 'Administrator',
    auditedSessionUserId: 'admin-1',
    initialAuthDocuments: new WeakSet(),
    activeTmsFrame: null,
    tmsLoadingWatchdog: null,
    activeAuthMessage: null,
    currentUser: null,
    currentProfile: null,
    URLSearchParams,
    WeakSet,
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  const startup = vm.runInContext("renderDashboard({ id:'admin-1', email:'admin@example.test' })", context);
  assert.equal(frameCreated, true, 'Panel powinien zacząć się ładować przed odpowiedzią serwera');
  assert.equal(posted.length, 0, 'Ramka nie może dostać tożsamości przed autoryzacją');
  profileResponse.resolve({ data: { active, role:'admin', feature_permissions:{ old:true } }, error:null });
  await Promise.resolve();
  if (active) {
    assert.equal(posted.length, 0, 'Panel powinien poczekać na aktualne uprawnienia');
    permissionResponse.resolve({ data:[{user_id:'admin-1', feature_permissions:{ new:true }}], error:null });
  }
  await startup;
  if (active) {
    assert.equal(posted.length, 1);
    assert.equal(posted[0].type, 'top-dragon-auth');
    assert.equal(posted[0].permissions.new, true);
    assert.equal(signedOut, false);
  } else {
    assert.equal(posted.length, 0, 'Nieaktywne konto nie może dostać dostępu');
    assert.equal(signedOut, true);
  }
}

(async () => {
  await scenario(true);
  await scenario(false);
  console.log('Równoległe ładowanie panelu i autoryzacja: OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
