import './styles.css'
import { supabase } from './lib/supabase.js'

const app = document.querySelector('#app')
let activeTmsFrame = null
let activeAuthMessage = null
let openAdminDataTransferAfterAuth = false
let activeUserDirectoryMessage = null
let activeFleetMessage = null
let activeRelationsMessage = null
let activeClientsMessage = null
let activeLoadQueueMessage = null
let activeLoadQueueChatMessage = null
let activeLoadRequestsMessage = null
let activeAuditMessage = null
let activeWeeklySettlementMessage = null
let activeWorkflowMessage = null
let fleetChannel = null
let fleetReloadTimer = null
let fleetRealtimeMuteUntil = 0
let relationsChannel = null
let relationsReloadTimer = null
let clientsChannel = null
let clientsReloadTimer = null
let loadQueueChannel = null
let loadQueueReloadTimer = null
let loadQueueHousekeepingTimer = null
let loadQueueChatChannel = null
let loadQueueChatReloadTimer = null
let loadRequestsChannel = null
let loadRequestsReloadTimer = null
let auditChannel = null
let auditReloadTimer = null
let weeklySettlementChannel = null
let weeklySettlementReloadTimer = null
let weeklySettlementWeekStart = ''
let workflowChannel = null
let workflowReloadTimer = null
let workflowSchemaAvailable = null
let currentUser = null
let currentProfile = null
let auditedSessionUserId = ''
// Administrator może przełączyć wyłącznie kontekst podglądu interfejsu. Konto,
// token Supabase i uprawnienia do operacji administracyjnych pozostają bez zmian.
let adminPreview = null

const ROLE_LABELS = {
  dispatcher: 'Spedytor',
  branch_manager: 'Kierownik oddziału',
  accounting: 'Rozliczenia',
  admin: 'Administrator',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim())
}

function currentRole() {
  return String(adminPreview?.role || currentProfile?.role || '')
}

function actualRole() {
  return String(currentProfile?.role || '')
}

function isActualAdmin() {
  return actualRole() === 'admin'
}

function currentActorId() {
  return String(currentUser?.id || '').trim()
}

function currentActorLogin() {
  return String(normalizedTmsLogin(currentProfile) || '').trim()
}

function currentActorDisplayName() {
  return String(currentProfile?.display_name || currentUser?.email || '').trim()
}

function currentActorBranchName() {
  return String(firstRelated(currentProfile?.branch)?.name || currentProfile?.branch_name || '').trim()
}

function hasRole(...roles) {
  return roles.includes(currentRole())
}

function currentBranchId() {
  return String(currentProfile?.branch_id || '').trim()
}

function isBranchScopedRole() {
  return hasRole('dispatcher', 'branch_manager')
}

function isOperationalEditor() {
  return hasRole('dispatcher', 'branch_manager', 'admin')
}

function sameName(left, right) {
  return String(left || '').trim().toLocaleLowerCase('pl') === String(right || '').trim().toLocaleLowerCase('pl')
}

async function loadFleetAssignmentScope(assignmentId) {
  const { data, error } = await supabase
    .from('fleet_assignments')
    .select('id,branch_id,assigned_dispatcher_id,created_by,active')
    .eq('id', assignmentId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

function canModifyFleetAssignment(assignment) {
  if (!assignment) return false
  if (hasRole('admin')) return true
  if (hasRole('branch_manager')) return Boolean(currentBranchId() && String(assignment.branch_id || '') === currentBranchId())
  if (hasRole('dispatcher')) {
    const actorId = currentActorId()
    return Boolean(actorId && [assignment.assigned_dispatcher_id, assignment.created_by].some((id) => String(id || '') === actorId))
  }
  return false
}

function suspendTmsRuntimeForAdminPanel() {
  activeTmsFrame = null

  const timeoutSlots = [
    ['fleetReloadTimer', () => fleetReloadTimer, (value) => { fleetReloadTimer = value }],
    ['relationsReloadTimer', () => relationsReloadTimer, (value) => { relationsReloadTimer = value }],
    ['clientsReloadTimer', () => clientsReloadTimer, (value) => { clientsReloadTimer = value }],
    ['loadQueueReloadTimer', () => loadQueueReloadTimer, (value) => { loadQueueReloadTimer = value }],
    ['loadQueueChatReloadTimer', () => loadQueueChatReloadTimer, (value) => { loadQueueChatReloadTimer = value }],
    ['loadRequestsReloadTimer', () => loadRequestsReloadTimer, (value) => { loadRequestsReloadTimer = value }],
    ['auditReloadTimer', () => auditReloadTimer, (value) => { auditReloadTimer = value }],
    ['weeklySettlementReloadTimer', () => weeklySettlementReloadTimer, (value) => { weeklySettlementReloadTimer = value }],
    ['workflowReloadTimer', () => workflowReloadTimer, (value) => { workflowReloadTimer = value }],
  ]
  timeoutSlots.forEach(([, getTimer, setTimer]) => {
    const timer = getTimer()
    if (timer) clearTimeout(timer)
    setTimer(null)
  })

  if (loadQueueHousekeepingTimer) {
    clearInterval(loadQueueHousekeepingTimer)
    loadQueueHousekeepingTimer = null
  }

  const channelSlots = [
    [() => fleetChannel, (value) => { fleetChannel = value }],
    [() => relationsChannel, (value) => { relationsChannel = value }],
    [() => clientsChannel, (value) => { clientsChannel = value }],
    [() => loadQueueChannel, (value) => { loadQueueChannel = value }],
    [() => loadQueueChatChannel, (value) => { loadQueueChatChannel = value }],
    [() => loadRequestsChannel, (value) => { loadRequestsChannel = value }],
    [() => auditChannel, (value) => { auditChannel = value }],
    [() => weeklySettlementChannel, (value) => { weeklySettlementChannel = value }],
    [() => workflowChannel, (value) => { workflowChannel = value }],
  ]
  channelSlots.forEach(([getChannel, setChannel]) => {
    const channel = getChannel()
    if (channel) supabase.removeChannel(channel)
    setChannel(null)
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role || 'Brak'
}

function needsOnboarding(user) {
  return user?.user_metadata?.onboarding_required === true
}

function renderFatalError(error) {
  const message = error instanceof Error ? error.message : String(error || 'Nieznany błąd')
  if (!app) return

  app.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <img class="login-logo" src="/top-dragon-logo.jpg" alt="Top Dragon" />
        <h1>Nie udało się uruchomić aplikacji</h1>
        <div class="error">${escapeHtml(message)}</div>
        <p class="muted">
          Odśwież stronę skrótem Ctrl + F5. Jeżeli błąd pozostanie,
          sprawdź najnowsze wdrożenie w Vercel.
        </p>
      </section>
    </main>
  `
}

function renderLogin(message = '') {
  currentUser = null
  currentProfile = null
  adminPreview = null
  activeTmsFrame = null
  activeAuthMessage = null
  activeUserDirectoryMessage = null
  activeFleetMessage = null
  activeRelationsMessage = null
  activeClientsMessage = null
  activeLoadQueueMessage = null
  activeLoadQueueChatMessage = null
  activeLoadRequestsMessage = null
  activeAuditMessage = null
  activeWeeklySettlementMessage = null
  activeWorkflowMessage = null
  workflowSchemaAvailable = null
  if (fleetReloadTimer) {
    clearTimeout(fleetReloadTimer)
    fleetReloadTimer = null
  }
  if (fleetChannel) {
    supabase.removeChannel(fleetChannel)
    fleetChannel = null
  }
  if (relationsReloadTimer) {
    clearTimeout(relationsReloadTimer)
    relationsReloadTimer = null
  }
  if (relationsChannel) {
    supabase.removeChannel(relationsChannel)
    relationsChannel = null
  }
  if (clientsReloadTimer) {
    clearTimeout(clientsReloadTimer)
    clientsReloadTimer = null
  }
  if (clientsChannel) {
    supabase.removeChannel(clientsChannel)
    clientsChannel = null
  }
  if (loadQueueReloadTimer) {
    clearTimeout(loadQueueReloadTimer)
    loadQueueReloadTimer = null
  }
  if (loadQueueHousekeepingTimer) {
    clearInterval(loadQueueHousekeepingTimer)
    loadQueueHousekeepingTimer = null
  }
  if (loadQueueChannel) {
    supabase.removeChannel(loadQueueChannel)
    loadQueueChannel = null
  }
  if (loadQueueChatReloadTimer) {
    clearTimeout(loadQueueChatReloadTimer)
    loadQueueChatReloadTimer = null
  }
  if (loadQueueChatChannel) {
    supabase.removeChannel(loadQueueChatChannel)
    loadQueueChatChannel = null
  }
  if (loadRequestsReloadTimer) {
    clearTimeout(loadRequestsReloadTimer)
    loadRequestsReloadTimer = null
  }
  if (loadRequestsChannel) {
    supabase.removeChannel(loadRequestsChannel)
    loadRequestsChannel = null
  }
  if (auditReloadTimer) {
    clearTimeout(auditReloadTimer)
    auditReloadTimer = null
  }
  if (auditChannel) {
    supabase.removeChannel(auditChannel)
    auditChannel = null
  }
  if (weeklySettlementReloadTimer) {
    clearTimeout(weeklySettlementReloadTimer)
    weeklySettlementReloadTimer = null
  }
  if (weeklySettlementChannel) {
    supabase.removeChannel(weeklySettlementChannel)
    weeklySettlementChannel = null
  }
  weeklySettlementWeekStart = ''
  if (workflowReloadTimer) { clearTimeout(workflowReloadTimer); workflowReloadTimer = null }
  if (workflowChannel) { supabase.removeChannel(workflowChannel); workflowChannel = null }

  app.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <img class="login-logo" src="/top-dragon-logo.jpg" alt="Top Dragon" />
        <h1>Logowanie</h1>
        <form id="login-form">
          <label>E-mail
            <input id="email" type="email" autocomplete="username" placeholder="Wpisz e-mail" required />
          </label>
          <label>Hasło
            <input id="password" type="password" autocomplete="current-password" placeholder="Wpisz hasło" required minlength="8" />
          </label>
          ${message ? `<div class="error">${escapeHtml(message)}</div>` : ''}
          <button class="primary" type="submit">Zaloguj</button>
        </form>
      </section>
    </main>
  `

  document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const email = document.querySelector('#email')?.value.trim() || ''
    const password = document.querySelector('#password')?.value || ''
    const button = event.submitter

    if (button) {
      button.disabled = true
      button.textContent = 'Logowanie…'
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) renderLogin('Nieprawidłowy e-mail lub hasło.')
    } catch (error) {
      renderFatalError(error)
    }
  })
}

function renderSetPassword(user, message = '') {
  currentUser = user

  app.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <img class="login-logo" src="/top-dragon-logo.jpg" alt="Top Dragon" />
        <h1>Ustaw hasło</h1>
        <p class="muted">Twoje konto zostało utworzone przez administratora. Ustaw własne hasło, aby zakończyć aktywację.</p>
        <form id="password-setup-form">
          <label>Nowe hasło
            <input id="new-password" type="password" autocomplete="new-password" required minlength="8" />
          </label>
          <label>Powtórz hasło
            <input id="confirm-password" type="password" autocomplete="new-password" required minlength="8" />
          </label>
          ${message ? `<div class="error">${escapeHtml(message)}</div>` : ''}
          <button class="primary" type="submit">Ustaw hasło i przejdź do TMS</button>
        </form>
      </section>
    </main>
  `

  document.querySelector('#password-setup-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const password = document.querySelector('#new-password')?.value || ''
    const confirmPassword = document.querySelector('#confirm-password')?.value || ''

    if (password !== confirmPassword) {
      renderSetPassword(user, 'Hasła nie są identyczne.')
      return
    }

    const metadata = { ...(user.user_metadata || {}), onboarding_required: false }
    const { data, error } = await supabase.auth.updateUser({
      password,
      data: metadata,
    })

    if (error) {
      renderSetPassword(user, error.message)
      return
    }

    window.history.replaceState({}, document.title, window.location.pathname)
    await renderDashboard(data.user || user)
  })
}

async function getSessionToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Sesja wygasła. Zaloguj się ponownie.')
  return token
}

async function adminApi(path, options = {}) {
  const token = await getSessionToken()
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `Błąd API (${response.status})`)
  }
  return data
}

function adminLocalDateIso() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function adminCommonCarrierRateAt(rateHistory = [], dateValue = adminLocalDateIso()) {
  const date = String(dateValue || adminLocalDateIso()).slice(0, 10)
  return (Array.isArray(rateHistory) ? rateHistory : [])
    .filter((item) => String(item?.effectiveFrom || '') <= date && Number(item?.ratePerKm) > 0)
    .sort((a, b) => String(a.effectiveFrom || '').localeCompare(String(b.effectiveFrom || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .at(-1) || null
}

async function loadAdminCarrierRateData() {
  const assignmentsResult = await supabase
    .from('fleet_assignments')
    .select('carrier_id,carrier:carriers!fleet_assignments_carrier_id_fkey(id,name)')
    .eq('active', true)

  if (assignmentsResult.error) {
    return { carriers: [], rateHistory: [], schemaAvailable: false, error: assignmentsResult.error.message }
  }

  const carriers = new Map()
  for (const row of assignmentsResult.data || []) {
    const carrier = firstRelated(row.carrier)
    const id = String(carrier?.id || row?.carrier_id || '').trim()
    if (id) carriers.set(id, { id, name: String(carrier?.name || 'Przewoźnik').trim() || 'Przewoźnik' })
  }

  const ratesResult = await supabase
    .from('tms_carrier_rate_history')
    .select('id,carrier_id,rate_per_km,effective_from,created_at')
    .order('effective_from', { ascending: true })
    .order('created_at', { ascending: true })

  if (ratesResult.error) {
    return { carriers: Array.from(carriers.values()), rateHistory: [], schemaAvailable: false, error: ratesResult.error.message }
  }

  return {
    carriers: Array.from(carriers.values()).sort((a, b) => a.name.localeCompare(b.name, 'pl')),
    rateHistory: (ratesResult.data || []).map((row) => ({
      id: String(row.id || ''),
      carrierId: String(row.carrier_id || ''),
      ratePerKm: Number(row.rate_per_km || 0),
      effectiveFrom: String(row.effective_from || '').slice(0, 10),
      createdAt: String(row.created_at || ''),
    })).filter((row) => row.carrierId && row.ratePerKm > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.effectiveFrom)),
    schemaAvailable: true,
    error: '',
  }
}

async function loadAdminData() {
  const [branchesResult, usersResult, carrierRates] = await Promise.all([
    adminApi('/api/admin/branches'),
    adminApi('/api/admin/users'),
    loadAdminCarrierRateData(),
  ])

  return {
    branches: branchesResult.branches || [],
    users: usersResult.users || [],
    carrierRates,
  }
}

function branchOptions(branches, selectedId = '') {
  return branches
    .filter((branch) => branch.active || branch.id === selectedId)
    .map((branch) => `
      <option value="${escapeHtml(branch.id)}" ${branch.id === selectedId ? 'selected' : ''}>
        ${escapeHtml(branch.name)}${branch.active ? '' : ' (nieaktywny)'}
      </option>
    `)
    .join('')
}

let adminCache = null
let adminPanelBusy = false

function updateAdminCacheBranch(branch) {
  if (!adminCache) return
  const index = adminCache.branches.findIndex((item) => item.id === branch.id)
  if (index >= 0) adminCache.branches[index] = { ...adminCache.branches[index], ...branch }
  else adminCache.branches.push(branch)
  adminCache.branches.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pl'))
}

function updateAdminCacheUser(user) {
  if (!adminCache) return
  const index = adminCache.users.findIndex((item) => item.id === user.id)
  if (index >= 0) adminCache.users[index] = { ...adminCache.users[index], ...user }
  else adminCache.users.push(user)
  adminCache.users.sort((a, b) => String(a.display_name).localeCompare(String(b.display_name), 'pl'))
}

function showAdminMessage(message = '', messageType = 'success') {
  const box = document.querySelector('#admin-message-box')
  if (!box) return

  if (!message) {
    box.innerHTML = ''
    box.hidden = true
    return
  }

  box.hidden = false
  box.className = `${messageType === 'error' ? 'error' : 'success'} admin-message`
  box.textContent = message
}

function setAdminBusy(busy) {
  adminPanelBusy = busy
  document.querySelectorAll(
    '#branch-create-form button, .branch-rename, .branch-toggle, .branch-delete, #user-invite-form button, #common-carrier-rate-form button, .user-save, #admin-data-transfer, #admin-refresh'
  ).forEach((button) => {
    button.disabled = busy || button.dataset.locked === 'true'
  })
}

function renderAdminPanelFromCache(message = '', messageType = 'success') {
  if (!adminCache) return

  const branches = adminCache.branches || []
  const users = adminCache.users || []
  const activeBranches = branches.filter((branch) => branch.active)
  const carrierRates = adminCache.carrierRates || { carriers: [], rateHistory: [], schemaAvailable: false }
  const carrierRateToday = adminLocalDateIso()
  const currentCommonCarrierRate = adminCommonCarrierRateAt(carrierRates.rateHistory, carrierRateToday)
  const commonCarrierRateValue = Number(currentCommonCarrierRate?.ratePerKm || 5)
  const commonRateHistory = Array.from(new Map(
    (carrierRates.rateHistory || []).slice().reverse().map((item) => [`${item.effectiveFrom}|${item.ratePerKm}`, item])
  ).values()).slice(0, 5)

  app.innerHTML = `
    <main class="admin-shell">
      <header class="admin-header">
        <div style="display:flex;align-items:center;gap:18px;">
          <button id="admin-logo-home" type="button" aria-label="Wróć do TMS" title="Wróć do TMS" style="border:0;background:transparent;padding:0;cursor:pointer;display:flex;align-items:center;">
            <img src="/top-dragon-logo.jpg" alt="Top Dragon" style="width:116px;height:72px;object-fit:contain;" />
          </button>
          <div>
          <h1>Administracja</h1>
          <p class="muted">Zalogowany: ${escapeHtml(currentProfile.display_name || currentUser.email)}</p>
          </div>
        </div>
      </header>

      ${renderAdminPreviewBar()}

      <div id="admin-message-box" ${message ? '' : 'hidden'} class="${messageType === 'error' ? 'error' : 'success'} admin-message">${escapeHtml(message)}</div>

      <div class="admin-grid">
        <section class="admin-card">
          <div class="section-heading">
            <div>
              <h2>Oddziały</h2>
              <p class="muted">Nieaktywny oddział zachowuje całą historię. Trwałe usunięcie jest możliwe tylko dla oddziału, który nigdy nie był używany.</p>
            </div>
          </div>

          <form id="branch-create-form" class="compact-form">
            <label>Nazwa nowego oddziału
              <input id="branch-name" type="text" placeholder="np. Oddział Łódź" required minlength="2" />
            </label>
            <button class="primary compact-primary" type="submit">+ Dodaj oddział</button>
          </form>

          <div class="admin-list">
            ${branches.length ? branches.map((branch) => `
              <article class="admin-row ${branch.active ? '' : 'is-inactive'}" data-branch-id="${escapeHtml(branch.id)}">
                <div class="admin-row-main">
                  <strong>${escapeHtml(branch.name)}</strong>
                  <span class="status-pill ${branch.active ? 'active' : 'inactive'}">${branch.active ? 'Aktywny' : 'Nieaktywny'}</span>
                </div>
                <div class="row-actions">
                  <button type="button" class="secondary branch-rename">Zmień nazwę</button>
                  <button type="button" class="secondary branch-toggle">${branch.active ? 'Dezaktywuj' : 'Aktywuj'}</button>
                  <button type="button" class="danger-button branch-delete">Usuń</button>
                </div>
              </article>
            `).join('') : '<p class="muted">Brak oddziałów.</p>'}
          </div>
        </section>

        <section class="admin-card">
          <div class="section-heading">
            <div>
              <h2>Dodaj użytkownika</h2>
              <p class="muted">Pracownik otrzyma e-mail z linkiem do ustawienia własnego hasła.</p>
            </div>
          </div>

          <form id="user-invite-form" class="compact-form two-columns">
            <label>Nazwa wyświetlana
              <input id="invite-display-name" type="text" placeholder="np. Tomasz" required minlength="2" />
            </label>
            <label>E-mail
              <input id="invite-email" type="email" placeholder="tomasz@firma.pl" required />
            </label>
            <label>Rola
              <select id="invite-role" required>
                <option value="dispatcher">Spedytor</option>
                <option value="branch_manager">Kierownik oddziału</option>
                <option value="accounting">Rozliczenia</option>
              </select>
            </label>
            <label>Oddział
              <select id="invite-branch" required>
                <option value="">Wybierz oddział</option>
                ${branchOptions(activeBranches)}
              </select>
            </label>
            <label>Kolor użytkownika
              <input id="invite-ui-color" class="user-color-input" type="color" value="#D9F99D" title="Kolor używany do oznaczeń spedytora w TMS" />
            </label>
            <button class="primary compact-primary wide" type="submit" ${activeBranches.length ? '' : 'disabled'}>
              Wyślij zaproszenie
            </button>
          </form>
          ${activeBranches.length ? '' : '<div class="warning">Najpierw utwórz aktywny oddział.</div>'}
        </section>
      </div>

      <section class="admin-card users-card">
        <div class="section-heading">
          <div>
            <h2>Wspólna stawka przewoźników</h2>
          </div>
          <span class="count-pill">${commonCarrierRateValue.toFixed(2).replace('.', ',')} PLN/km</span>
        </div>
        ${carrierRates.schemaAvailable ? `
          <form id="common-carrier-rate-form" class="compact-form two-columns">
            <label>Nowa wspólna stawka PLN/km
              <input id="common-carrier-rate-value" type="number" min="0.01" step="0.01" value="${escapeHtml(commonCarrierRateValue.toFixed(2))}" required />
            </label>
            <label>Obowiązuje od
              <input id="common-carrier-rate-date" type="date" min="${escapeHtml(carrierRateToday)}" value="${escapeHtml(carrierRateToday)}" required />
            </label>
            <button class="primary compact-primary wide" type="submit" ${carrierRates.carriers.length ? '' : 'disabled'}>Zapisz</button>
          </form>
          ${commonRateHistory.length ? `<p class="muted">Ostatnie wartości: ${commonRateHistory.map((item) => `${Number(item.ratePerKm).toFixed(2).replace('.', ',')} PLN/km od ${escapeHtml(item.effectiveFrom)}`).join(' · ')}</p>` : '<p class="muted">Brak zapisanej historii - używana jest stawka domyślna 5,00 PLN/km.</p>'}
          ${carrierRates.carriers.length ? '' : '<div class="warning">Dodaj najpierw co najmniej jednego przewoźnika.</div>'}
        ` : `<div class="warning">Nie udało się odczytać tabeli stawek. ${escapeHtml(carrierRates.error || 'Sprawdź, czy migracja stawek została wdrożona.')}</div>`}
      </section>

      <section class="admin-card users-card">
        <div class="section-heading">
          <div>
            <h2>Użytkownicy</h2>
            <p class="muted">Zmiana statusu na nieaktywny zachowuje użytkownika i jego historię.</p>
          </div>
          <span class="count-pill">${users.length}</span>
        </div>

        <div class="user-list">
          ${users.length ? users.map((item) => {
            const lockedAdmin = item.role === 'admin'
            const userColor = lockedAdmin ? '#EF4444' : (item.ui_color || '#E2E8F0')
            return `
              <article class="user-row ${item.active ? '' : 'is-inactive'}" data-user-id="${escapeHtml(item.id)}">
                <div class="user-identity">
                  <strong>${escapeHtml(item.display_name)}</strong>
                  <span>${escapeHtml(item.email || 'Brak e-mail')}</span>
                </div>
                <label>Nazwa
                  <input class="user-display-name" value="${escapeHtml(item.display_name)}" ${lockedAdmin ? 'disabled' : ''} />
                </label>
                <label>Rola
                  <select class="user-role" ${lockedAdmin ? 'disabled' : ''}>
                    <option value="dispatcher" ${item.role === 'dispatcher' ? 'selected' : ''}>Spedytor</option>
                    <option value="branch_manager" ${item.role === 'branch_manager' ? 'selected' : ''}>Kierownik oddziału</option>
                    <option value="accounting" ${item.role === 'accounting' ? 'selected' : ''}>Rozliczenia</option>
                    ${lockedAdmin ? '<option value="admin" selected>Administrator</option>' : ''}
                  </select>
                </label>
                <label>Oddział
                  <select class="user-branch" ${lockedAdmin ? 'disabled' : ''}>
                    <option value="">Brak</option>
                    ${branchOptions(branches, item.branch_id || '')}
                  </select>
                </label>
                <label>Kolor
                  <span class="user-color-field"><input class="user-ui-color" type="color" value="${escapeHtml(userColor)}" ${lockedAdmin ? 'disabled' : ''} /><span>${escapeHtml(userColor)}</span></span>
                </label>
                <label class="active-check">
                  <span>Aktywny</span>
                  <input class="user-active" type="checkbox" ${item.active ? 'checked' : ''} ${lockedAdmin ? 'disabled' : ''} />
                </label>
                <button type="button" class="primary user-save" ${lockedAdmin ? 'disabled data-locked="true"' : ''}>Zapisz</button>
              </article>
            `
          }).join('') : '<p class="muted">Brak użytkowników.</p>'}
        </div>
      </section>
    </main>
  `

  document.querySelector('#admin-logo-home')?.addEventListener('click', () => renderDashboard(currentUser))
  wireAdminPreviewControls()

  document.querySelector('#branch-create-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (adminPanelBusy) return

    const name = document.querySelector('#branch-name')?.value.trim() || ''
    setAdminBusy(true)

    try {
      const result = await adminApi('/api/admin/branches', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      writeCurrentUserAudit('Dodano oddział', 'branch', result.branch?.id || '', name)
      updateAdminCacheBranch(result.branch)
      renderAdminPanelFromCache('Oddział został dodany.')
    } catch (error) {
      showAdminMessage(error.message, 'error')
      setAdminBusy(false)
    }
  })

  document.querySelectorAll('.admin-row').forEach((row) => {
    const id = row.dataset.branchId
    const branch = branches.find((item) => item.id === id)
    if (!branch) return

    row.querySelector('.branch-rename')?.addEventListener('click', async () => {
      if (adminPanelBusy) return
      const name = window.prompt('Nowa nazwa oddziału:', branch.name)
      if (!name || name.trim() === branch.name) return

      setAdminBusy(true)
      try {
        const result = await adminApi('/api/admin/branches', {
          method: 'PATCH',
          body: JSON.stringify({ id, name: name.trim() }),
        })
        writeCurrentUserAudit('Zmieniono nazwę oddziału', 'branch', id, `${branch.name} → ${name.trim()}`)
        updateAdminCacheBranch(result.branch)
        renderAdminPanelFromCache('Nazwa oddziału została zmieniona.')
      } catch (error) {
        showAdminMessage(error.message, 'error')
        setAdminBusy(false)
      }
    })

    row.querySelector('.branch-toggle')?.addEventListener('click', async () => {
      if (adminPanelBusy) return
      const action = branch.active ? 'dezaktywować' : 'aktywować'
      if (!window.confirm(`Czy na pewno ${action} oddział „${branch.name}”?`)) return

      setAdminBusy(true)
      try {
        const result = await adminApi('/api/admin/branches', {
          method: 'PATCH',
          body: JSON.stringify({ id, active: !branch.active }),
        })
        writeCurrentUserAudit(branch.active ? 'Dezaktywowano oddział' : 'Aktywowano oddział', 'branch', id, branch.name)
        updateAdminCacheBranch(result.branch)
        renderAdminPanelFromCache(`Oddział został ${branch.active ? 'dezaktywowany' : 'aktywowany'}.`)
      } catch (error) {
        showAdminMessage(error.message, 'error')
        setAdminBusy(false)
      }
    })

    row.querySelector('.branch-delete')?.addEventListener('click', async () => {
      if (adminPanelBusy) return
      if (!window.confirm(
        `Trwale usunąć oddział „${branch.name}”?\n\nUsunięcie będzie możliwe tylko wtedy, gdy oddział nie ma żadnych użytkowników, kierowców, pojazdów, przewoźników, zestawów ani historii relacji.`
      )) return

      setAdminBusy(true)
      try {
        const result = await adminApi('/api/admin/branches', {
          method: 'DELETE',
          body: JSON.stringify({ id }),
        })
        writeCurrentUserAudit('Usunięto oddział', 'branch', id, branch.name)
        adminCache.branches = adminCache.branches.filter((item) => item.id !== id)
        renderAdminPanelFromCache(result.message || 'Oddział został usunięty.')
      } catch (error) {
        showAdminMessage(error.message, 'error')
        setAdminBusy(false)
      }
    })
  })

  document.querySelector('#user-invite-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (adminPanelBusy) return

    const button = event.submitter
    setAdminBusy(true)
    if (button) button.textContent = 'Wysyłanie…'

    try {
      const result = await adminApi('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          displayName: document.querySelector('#invite-display-name')?.value.trim(),
          email: document.querySelector('#invite-email')?.value.trim(),
          role: document.querySelector('#invite-role')?.value,
          branchId: document.querySelector('#invite-branch')?.value,
          uiColor: document.querySelector('#invite-ui-color')?.value,
        }),
      })
      writeCurrentUserAudit('Zaproszono użytkownika', 'user', result.user?.id || '', `${result.user?.display_name || ''} · ${result.user?.role || ''}`)
      updateAdminCacheUser(result.user)
      renderAdminPanelFromCache(result.message || 'Zaproszenie zostało wysłane.')
    } catch (error) {
      showAdminMessage(error.message, 'error')
      setAdminBusy(false)
      if (button) button.textContent = 'Wyślij zaproszenie'
    }
  })

  document.querySelector('#common-carrier-rate-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (adminPanelBusy) return
    const ratePerKm = Number(String(document.querySelector('#common-carrier-rate-value')?.value || '').replace(',', '.'))
    const effectiveFrom = String(document.querySelector('#common-carrier-rate-date')?.value || '').slice(0, 10)
    const carrierIds = (carrierRates.carriers || []).map((carrier) => String(carrier.id || '')).filter(Boolean)
    if (!Number.isFinite(ratePerKm) || ratePerKm <= 0) {
      showAdminMessage('Stawka za kilometr musi być większa od zera.', 'error')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || effectiveFrom < carrierRateToday) {
      showAdminMessage('Data obowiązywania nie może być wcześniejsza niż dzisiaj.', 'error')
      return
    }
    if (!carrierIds.length) {
      showAdminMessage('Brak aktywnych przewoźników, dla których można zapisać stawkę.', 'error')
      return
    }

    setAdminBusy(true)
    try {
      for (let index = 0; index < carrierIds.length; index += 12) {
        const batch = carrierIds.slice(index, index + 12)
        const results = await Promise.all(batch.map((carrierId) => supabase.rpc('set_tms_carrier_rate', {
          p_carrier_id: carrierId,
          p_rate_per_km: ratePerKm,
          p_effective_from: effectiveFrom,
        })))
        const failed = results.find((result) => result.error)
        if (failed?.error) throw failed.error
      }
      adminCache.carrierRates = await loadAdminCarrierRateData()
      writeCurrentUserAudit('Zmieniono wspólną stawkę przewoźników', 'carrierRate', effectiveFrom, `${ratePerKm.toFixed(2)} PLN/km · ${carrierIds.length} przewoźników`)
      renderAdminPanelFromCache(`Wspólna stawka ${ratePerKm.toFixed(2).replace('.', ',')} PLN/km została zapisana dla ${carrierIds.length} przewoźników.`)
    } catch (error) {
      showAdminMessage(error?.message || 'Nie udało się zapisać wspólnej stawki przewoźników.', 'error')
      setAdminBusy(false)
    }
  })

  document.querySelectorAll('.user-row').forEach((row) => {
    row.querySelector('.user-save')?.addEventListener('click', async () => {
      if (adminPanelBusy) return

      const userId = row.dataset.userId
      const existing = users.find((item) => item.id === userId)
      setAdminBusy(true)

      try {
        const result = await adminApi('/api/admin/users', {
          method: 'PATCH',
          body: JSON.stringify({
            userId,
            displayName: row.querySelector('.user-display-name')?.value.trim(),
            role: row.querySelector('.user-role')?.value,
            branchId: row.querySelector('.user-branch')?.value,
            uiColor: row.querySelector('.user-ui-color')?.value,
            active: Boolean(row.querySelector('.user-active')?.checked),
          }),
        })

        writeCurrentUserAudit('Zmieniono dane użytkownika', 'user', userId, `${result.user?.display_name || existing?.display_name || ''} · ${result.user?.role || existing?.role || ''}`)

        updateAdminCacheUser({
          ...existing,
          ...result.user,
          email: existing?.email || '',
        })
        renderAdminPanelFromCache('Dane użytkownika zostały zapisane.')
      } catch (error) {
        showAdminMessage(error.message, 'error')
        setAdminBusy(false)
      }
    })
  })

  setAdminBusy(false)
}

async function renderAdminPanel(message = '', messageType = 'success', forceReload = false) {
  if (!currentUser || currentProfile?.role !== 'admin') {
    await renderDashboard(currentUser)
    return
  }

  // Panel administracyjny usuwa iframe TMS z DOM. Wstrzymujemy więc kanały i timery
  // operacyjne zamiast odświeżać dane do nieistniejącego widoku. renderDashboard()
  // przy powrocie utworzy je ponownie i pobierze świeży snapshot.
  suspendTmsRuntimeForAdminPanel()

  if (adminCache && !forceReload) {
    renderAdminPanelFromCache(message, messageType)
    return
  }

  app.innerHTML = `
    <main class="admin-shell">
      <header class="admin-header">
        <div style="display:flex;align-items:center;gap:18px;">
          <img src="/top-dragon-logo.jpg" alt="Top Dragon" style="width:116px;height:72px;object-fit:contain;" />
          <div>
          <h1>Administracja</h1>
          <p class="muted">Użytkownicy i oddziały</p>
          </div>
        </div>
      </header>
      <section class="admin-loading">Pobieranie danych…</section>
    </main>
  `

  try {
    adminCache = await loadAdminData()
    renderAdminPanelFromCache(message, messageType)
  } catch (error) {
    app.innerHTML = `
      <main class="admin-shell">
        <header class="admin-header">
          <div style="display:flex;align-items:center;gap:18px;">
            <button id="admin-logo-home" type="button" aria-label="Wróć do TMS" title="Wróć do TMS" style="border:0;background:transparent;padding:0;cursor:pointer;display:flex;align-items:center;">
              <img src="/top-dragon-logo.jpg" alt="Top Dragon" style="width:116px;height:72px;object-fit:contain;" />
            </button>
            <h1>Administracja</h1>
          </div>
        </header>
        <div class="error">${escapeHtml(error.message)}</div>
      </main>
    `
    document.querySelector('#admin-logo-home')?.addEventListener('click', () => renderDashboard(currentUser))
  }
}


function normalizedTmsLogin(profile) {
  if (profile?.role === 'admin') return 'ADMIN'
  const source = String(profile?.display_name || 'UŻYTKOWNIK')
    .trim()
    .toUpperCase()
    .replace(/[^A-ZĄĆĘŁŃÓŚŹŻ0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return source || 'UŻYTKOWNIK'
}

async function loadVisibleUserDirectory() {
  const { data, error } = await supabase.rpc('get_tms_user_directory')

  if (error) {
    throw new Error(`Nie udało się pobrać listy użytkowników: ${error.message}`)
  }

  return (data || []).map((profile) => ({
    id: profile.id,
    displayName: profile.display_name,
    role: profile.role,
    branchId: profile.branch_id || '',
    branch: profile.branch_name || '',
    login: normalizedTmsLogin(profile),
    uiColor: profile.role === 'admin' ? '#EF4444' : (profile.ui_color || '#E2E8F0'),
  }))
}

async function syncUserDirectoryToTms() {
  const profiles = await loadVisibleUserDirectory()

  activeUserDirectoryMessage = {
    type: 'top-dragon-user-directory',
    profiles,
  }

  activeTmsFrame?.contentWindow?.postMessage(
    activeUserDirectoryMessage,
    window.location.origin
  )
}


function firstRelated(value) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

async function loadFleetData() {
  let assignmentsQuery = supabase
    .from('fleet_assignments')
    .select(`
      id,
      branch_id,
      assigned_dispatcher_id,
      created_by,
      created_at,
      active,
      hidden,
      carrier:carriers!fleet_assignments_carrier_id_fkey(id,name),
      driver:drivers!fleet_assignments_driver_id_fkey(id,full_name,phone,identity_document_number,nationality,base_location,created_by),
      vehicle:vehicles!fleet_assignments_vehicle_id_fkey(id,registration_no,brand,description,created_by),
      trailer:trailers!fleet_assignments_trailer_id_fkey(id,registration_no,height_m,description,created_by)
    `)
    .eq('active', true)
    .order('created_at', { ascending: true })

  const { data: assignments, error: assignmentsError } = await assignmentsQuery

  if (assignmentsError) {
    throw new Error(`Nie udało się pobrać floty: ${assignmentsError.message}`)
  }

  const { data: usage, error: usageError } = await supabase
    .from('fleet_relation_usage')
    .select('fleet_assignment_id, driver_id, vehicle_id, trailer_id')

  if (usageError) {
    throw new Error(`Nie udało się sprawdzić historii relacji: ${usageError.message}`)
  }

  const usageRows = usage || []

  let preferenceRows = []
  if (currentRole() === 'dispatcher' && currentActorId()) {
    const { data: preferences, error: preferencesError } = await supabase
      .from('driver_row_preferences')
      .select('driver_id, color')
      .eq('user_id', currentActorId())

    if (preferencesError) {
      throw new Error(`Nie udało się pobrać prywatnych kolorów kierowców: ${preferencesError.message}`)
    }
    preferenceRows = preferences || []
  }
  const preferenceByDriver = new Map(preferenceRows.map((item) => [String(item.driver_id || ''), String(item.color || '')]))

  // 3L.54: historia stawek przewoźników jest dołączana do floty.
  // Brak tabeli przed wykonaniem migracji 032 nie może blokować całej aplikacji.
  let carrierRateRows = []
  try {
    const { data: rates, error: ratesError } = await supabase
      .from('tms_carrier_rate_history')
      .select('id,carrier_id,branch_id,rate_per_km,effective_from,created_at,created_by')
      .order('effective_from', { ascending: true })
      .order('created_at', { ascending: true })
    if (ratesError) {
      const message = String(ratesError.message || '')
      if (!/does not exist|schema cache|could not find/i.test(message)) throw ratesError
    } else {
      carrierRateRows = rates || []
    }
  } catch (error) {
    console.warn('Nie udało się pobrać historii stawek przewoźników:', error)
  }
  const ratesByCarrier = new Map()
  for (const row of carrierRateRows) {
    const carrierId = String(row?.carrier_id || '')
    if (!carrierId) continue
    const bucket = ratesByCarrier.get(carrierId) || []
    bucket.push({
      id: String(row.id || ''),
      ratePerKm: Number(row.rate_per_km || 0),
      effectiveFrom: String(row.effective_from || '').slice(0, 10),
      createdAt: String(row.created_at || ''),
      createdBy: String(row.created_by || ''),
    })
    ratesByCarrier.set(carrierId, bucket)
  }

  return (assignments || []).map((assignment) => {
    const carrier = firstRelated(assignment.carrier)
    const driver = firstRelated(assignment.driver)
    const vehicle = firstRelated(assignment.vehicle)
    const trailer = firstRelated(assignment.trailer)

    const relationLocked = usageRows.some((item) =>
      item.fleet_assignment_id === assignment.id ||
      item.driver_id === driver?.id ||
      (vehicle?.id && item.vehicle_id === vehicle.id) ||
      (trailer?.id && item.trailer_id === trailer.id)
    )

    return {
      id: assignment.id,
      branchId: assignment.branch_id || '',
      assignedDispatcherId: assignment.assigned_dispatcher_id || '',
      createdBy: assignment.created_by || '',
      createdAt: assignment.created_at || '',
      relationLocked,
      hidden: Boolean(assignment.hidden),
      privateColor: driver?.id ? (preferenceByDriver.get(String(driver.id)) || '') : '',
      carrier: carrier ? {
        id: carrier.id,
        name: carrier.name || '',
        rateHistory: ratesByCarrier.get(String(carrier.id || '')) || [],
      } : null,
      driver: driver ? {
        id: driver.id,
        fullName: driver.full_name || '',
        phone: driver.phone || '',
        identityDocumentNumber: driver.identity_document_number || '',
        nationality: driver.nationality || '',
        baseLocation: driver.base_location || '',
        createdBy: driver.created_by || '',
      } : null,
      vehicle: vehicle ? {
        id: vehicle.id,
        registrationNo: vehicle.registration_no || '',
        brand: vehicle.brand || '',
        description: vehicle.description || '',
        createdBy: vehicle.created_by || '',
      } : null,
      trailer: trailer ? {
        id: trailer.id,
        registrationNo: trailer.registration_no || '',
        heightM: trailer.height_m == null ? null : Number(trailer.height_m),
        description: trailer.description || '',
        createdBy: trailer.created_by || '',
      } : null,
    }
  })
}

async function syncFleetDataToTms() {
  const rows = await loadFleetData()
  activeFleetMessage = {
    type: 'top-dragon-fleet-data',
    rows,
  }

  activeTmsFrame?.contentWindow?.postMessage(
    activeFleetMessage,
    window.location.origin
  )
}



function scheduleFleetReload(delay = 100) {
  if (fleetReloadTimer) clearTimeout(fleetReloadTimer)
  fleetReloadTimer = setTimeout(() => {
    fleetReloadTimer = null
    syncFleetDataToTms().catch((error) => {
      console.error('Nie udało się odświeżyć floty po zmianie Realtime:', error)
    })
  }, Math.max(0, Number(delay) || 0))
}

function subscribeFleetRealtime() {
  if (fleetChannel) {
    supabase.removeChannel(fleetChannel)
    fleetChannel = null
  }
  if (!currentProfile || !currentUser) return

  const channelName = `tms-fleet-${currentBranchId() || 'all'}-${currentActorId() || 'user'}`
  let channel = supabase.channel(channelName)
  ;['fleet_assignments', 'carriers', 'drivers', 'vehicles', 'trailers', 'fleet_relation_usage', 'driver_row_preferences', 'tms_carrier_rate_history'].forEach((table) => {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => {
        if (Date.now() < fleetRealtimeMuteUntil) return
        scheduleFleetReload(180)
      },
    )
  })
  fleetChannel = channel.subscribe()
}

async function loadCentralRelations() {
  if (!currentProfile) return []

  let query = supabase
    .from('tms_relations')
    .select('branch_id, relation_ref, payload, updated_at')
    .eq('active', true)
    .order('updated_at', { ascending: true })

  const { data, error } = await query
  if (error) {
    throw new Error(`Nie udało się pobrać relacji: ${error.message}`)
  }

  return (data || [])
    .filter((row) => row?.payload && row?.relation_ref)
    .map((row) => ({
      id: String(row.relation_ref || ''),
      branchId: String(row.branch_id || ''),
      payload: row.payload,
      updatedAt: String(row.updated_at || ''),
    }))
}

async function syncCentralRelationsToTms() {
  const rows = await loadCentralRelations()
  activeRelationsMessage = {
    type: 'top-dragon-relations-data',
    rows,
  }

  activeTmsFrame?.contentWindow?.postMessage(
    activeRelationsMessage,
    window.location.origin
  )
}

async function exportCentralRelationsArchiveToTms(message) {
  const requestId = String(message?.requestId || '')
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10))
  const requestedFrom = validDate(message?.dateFrom) ? String(message.dateFrom).slice(0, 10) : ''
  const requestedTo = validDate(message?.dateTo) ? String(message.dateTo).slice(0, 10) : ''
  const send = (ok, rows = [], errorMessage = '') => {
    activeTmsFrame?.contentWindow?.postMessage({
      type: 'top-dragon-relations-archive-export-data',
      requestId,
      ok: Boolean(ok),
      rows,
      message: String(errorMessage || ''),
    }, window.location.origin)
  }

  if (!currentProfile) {
    send(false, [], 'Brak aktywnej sesji.')
    return
  }

  try {
    let query = supabase
      .from('tms_relations')
      .select('branch_id, relation_ref, payload, active, updated_at')
      .order('updated_at', { ascending: true })

    if (!['admin', 'accounting'].includes(currentRole())) {
      if (!currentBranchId()) {
        send(true, [])
        return
      }
      query = query.eq('branch_id', currentBranchId())
    }

    const { data, error } = await query
    if (error) throw error
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - 730)
    const rangeFrom = requestedFrom || cutoff.toISOString().slice(0, 10)
    const rangeTo = requestedTo || new Date().toISOString().slice(0, 10)
    const rows = (data || []).filter((row) => {
      const startDate = String(row?.payload?.date || '').slice(0, 10)
      const endDate = String(row?.payload?.endDate || startDate).slice(0, 10)
      const roleVisible = !hasRole('dispatcher') || sameName(row?.payload?.ownerDispatcher || row?.payload?.createdBy, currentActorLogin())
      const overlapsRange = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
        && startDate <= rangeTo
        && endDate >= rangeFrom
      return row?.payload && row?.relation_ref && roleVisible && overlapsRange
    }).map((row) => ({
      id: String(row.relation_ref || ''),
      branchId: String(row.branch_id || ''),
      active: Boolean(row.active),
      payload: row.payload,
      updatedAt: String(row.updated_at || ''),
    }))
    send(true, rows)
  } catch (error) {
    send(false, [], error?.message || 'Nie udało się pobrać centralnego archiwum relacji.')
  }
}

function scheduleCentralRelationsReload(delay = 120) {
  if (relationsReloadTimer) clearTimeout(relationsReloadTimer)
  relationsReloadTimer = setTimeout(() => {
    relationsReloadTimer = null
    syncCentralRelationsToTms().catch((error) => {
      console.error('Nie udało się odświeżyć centralnych relacji:', error)
    })
  }, Math.max(0, Number(delay) || 0))
}

function subscribeCentralRelations() {
  if (relationsChannel) {
    supabase.removeChannel(relationsChannel)
    relationsChannel = null
  }

  if (!currentProfile) return

  const channelName = `tms-relations-${currentBranchId() || 'all'}-${currentActorId() || 'user'}`
  relationsChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tms_relations' },
      () => scheduleCentralRelationsReload(90)
    )
    .subscribe()
}

function sendRelationOperationResult(requestId, ok, action, relationId, branchId, message) {
  activeTmsFrame?.contentWindow?.postMessage({
    type: 'top-dragon-relation-operation-result',
    requestId: String(requestId || ''),
    ok: Boolean(ok),
    action: String(action || ''),
    relationId: String(relationId || ''),
    branchId: String(branchId || ''),
    message: String(message || ''),
  }, window.location.origin)
}

async function upsertCentralRelationFromTms(message) {
  const requestId = String(message?.requestId || '')
  const relation = message?.relation
  const relationId = String(relation?.id || '').trim()
  const branchId = String(
    currentRole() === 'admin'
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!relationId || !branchId || !relation || typeof relation !== 'object') {
    sendRelationOperationResult(requestId, false, 'upsert', relationId, branchId, 'Brak identyfikatora relacji lub oddziału.')
    return
  }
  if (!isOperationalEditor()) {
    sendRelationOperationResult(requestId, false, 'upsert', relationId, branchId, 'Twoja rola ma dostęp tylko do odczytu relacji operacyjnych.')
    return
  }
  if (!isValidUuid(branchId)) {
    sendRelationOperationResult(requestId, false, 'upsert', relationId, '', `Nieprawidłowy identyfikator oddziału. Import/zapis został zatrzymany (${branchId || 'brak'}).`)
    return
  }

  if (currentRole() === 'dispatcher') {
    const actor = currentActorLogin()
    const owner = String(relation?.ownerDispatcher || relation?.createdBy || '').trim()
    if (!actor || !owner || actor.toLocaleLowerCase('pl') !== owner.toLocaleLowerCase('pl')) {
      sendRelationOperationResult(requestId, false, 'upsert', relationId, branchId, 'Nie możesz zapisać zmian relacji należącej do innego spedytora.')
      return
    }
  }

  try {
    const { error } = await supabase.rpc('upsert_tms_relation', {
      p_branch_id: branchId,
      p_relation: relation,
    })
    if (error) throw error

    // Najpierw odsyłamy aktualny snapshot z bazy, kiedy iframe nadal traktuje
    // relację jako pending. Dopiero potem zwalniamy pending wynikiem operacji.
    // Dzięki temu starszy echo-snapshot nie nadpisuje nowszej pozycji kursora.
    await syncCentralRelationsToTms()
    sendRelationOperationResult(requestId, true, 'upsert', relationId, branchId, 'Relacja została zapisana w Supabase.')
  } catch (error) {
    sendRelationOperationResult(requestId, false, 'upsert', relationId, branchId, error?.message || 'Nie udało się zapisać relacji.')
  }
}

async function updateCentralRelationAccountingFromTms(message) {
  const requestId = String(message?.requestId || '')
  const relationId = String(message?.relationId || '').trim()
  const patch = message?.patch && typeof message.patch === 'object' ? message.patch : null
  const branchId = String(
    ['admin', 'accounting'].includes(currentRole())
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!relationId || !branchId || !patch) {
    sendRelationOperationResult(requestId, false, 'accounting', relationId, branchId, 'Brak danych statusu rozliczeń.')
    return
  }

  if (!['accounting', 'admin'].includes(currentRole())) {
    sendRelationOperationResult(requestId, false, 'accounting', relationId, branchId, 'Status rozliczeń może zmieniać tylko grupa Rozliczenia.')
    return
  }

  try {
    const { error } = await supabase.rpc('patch_tms_relation_accounting', {
      p_branch_id: branchId,
      p_relation_ref: relationId,
      p_patch: patch,
    })
    if (error) throw error

    await syncCentralRelationsToTms()
    sendRelationOperationResult(requestId, true, 'accounting', relationId, branchId, 'Status rozliczeń został zsynchronizowany.')
  } catch (error) {
    sendRelationOperationResult(requestId, false, 'accounting', relationId, branchId, error?.message || 'Nie udało się zapisać statusu rozliczeń.')
  }
}

async function archiveCentralRelationFromTms(message) {
  const requestId = String(message?.requestId || '')
  const relationId = String(message?.relationId || '').trim()
  const branchId = String(
    currentRole() === 'admin'
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!relationId || !branchId) {
    sendRelationOperationResult(requestId, false, 'archive', relationId, branchId, 'Brak identyfikatora relacji lub oddziału.')
    return
  }
  if (!isOperationalEditor()) {
    sendRelationOperationResult(requestId, false, 'archive', relationId, branchId, 'Twoja rola nie może usuwać relacji z aktywnego planu.')
    return
  }

  try {
    if (hasRole('dispatcher')) {
      const { data: existing, error: ownershipError } = await supabase
        .from('tms_relations')
        .select('payload')
        .eq('branch_id', branchId)
        .eq('relation_ref', relationId)
        .maybeSingle()
      if (ownershipError) throw ownershipError
      const owner = existing?.payload?.ownerDispatcher || existing?.payload?.createdBy || ''
      if (!sameName(owner, currentActorLogin())) {
        sendRelationOperationResult(requestId, false, 'archive', relationId, branchId, 'Możesz usuwać wyłącznie relacje, które prowadzisz.')
        return
      }
    }
    const { error } = await supabase.rpc('archive_tms_relation', {
      p_branch_id: branchId,
      p_relation_ref: relationId,
    })
    if (error) throw error

    sendRelationOperationResult(requestId, true, 'archive', relationId, branchId, 'Relacja została usunięta z aktywnego planu.')
    await syncCentralRelationsToTms()
  } catch (error) {
    sendRelationOperationResult(requestId, false, 'archive', relationId, branchId, error?.message || 'Nie udało się usunąć relacji z aktywnego planu.')
  }
}



async function loadCentralClients() {
  if (!currentProfile) return []

  const { data, error } = await supabase
    .from('tms_clients_central')
    .select('branch_id, client_ref, payload, updated_at')
    .eq('active', true)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Nie udało się pobrać klientów: ${error.message}`)
  }

  // 3L.59: baza klientów jest globalna. Jeżeli po starszych wersjach istnieje
  // kilka rekordów tego samego client_ref w różnych oddziałach, do aplikacji
  // trafia tylko najnowsza wersja.
  const seen = new Set()
  return (data || [])
    .filter((row) => row?.payload && row?.client_ref)
    .filter((row) => {
      const key = String(row.client_ref || '').trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((row) => ({
      id: String(row.client_ref || ''),
      branchId: String(row.branch_id || ''),
      payload: row.payload,
      updatedAt: String(row.updated_at || ''),
    }))
}

async function syncCentralClientsToTms() {
  const rows = await loadCentralClients()
  activeClientsMessage = {
    type: 'top-dragon-clients-data',
    rows,
  }

  activeTmsFrame?.contentWindow?.postMessage(
    activeClientsMessage,
    window.location.origin
  )
}

function scheduleCentralClientsReload(delay = 120) {
  if (clientsReloadTimer) clearTimeout(clientsReloadTimer)
  clientsReloadTimer = setTimeout(() => {
    clientsReloadTimer = null
    syncCentralClientsToTms().catch((error) => {
      console.error('Nie udało się odświeżyć centralnych klientów:', error)
    })
  }, Math.max(0, Number(delay) || 0))
}

function subscribeCentralClients() {
  if (clientsChannel) {
    supabase.removeChannel(clientsChannel)
    clientsChannel = null
  }

  if (!currentProfile) return

  const channelName = `tms-clients-global-${currentActorId() || 'user'}`
  clientsChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tms_clients_central' },
      () => scheduleCentralClientsReload(90)
    )
    .subscribe()
}

function sendClientOperationResult(requestId, ok, action, clientId, branchId, message) {
  activeTmsFrame?.contentWindow?.postMessage({
    type: 'top-dragon-client-operation-result',
    requestId: String(requestId || ''),
    ok: Boolean(ok),
    action: String(action || ''),
    clientId: String(clientId || ''),
    branchId: '',
    message: String(message || ''),
  }, window.location.origin)
}

async function fallbackClientStorageBranchId(client = null) {
  const explicit = String(client?.branchId || client?.branch_id || '').trim()
  if (isValidUuid(explicit)) return explicit
  if (isValidUuid(currentBranchId())) return currentBranchId()

  const owner = String(client?.dispatcher || '').trim()
  const profiles = Array.isArray(activeUserDirectoryMessage?.profiles) ? activeUserDirectoryMessage.profiles : []
  const ownerProfile = owner ? profiles.find((profile) => sameName(profile?.login, owner) && isValidUuid(profile?.branchId)) : null
  if (ownerProfile) return String(ownerProfile.branchId)
  const directoryBranch = profiles.find((profile) => isValidUuid(profile?.branchId))?.branchId
  if (directoryBranch) return String(directoryBranch)

  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('active', true)
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return isValidUuid(data?.id) ? String(data.id) : ''
}

async function existingClientBranchMap(clientIds = []) {
  const ids = Array.from(new Set((clientIds || []).map((id) => String(id || '').trim()).filter(Boolean)))
  const result = new Map()
  for (let offset = 0; offset < ids.length; offset += 150) {
    const { data, error } = await supabase
      .from('tms_clients_central')
      .select('client_ref,branch_id,updated_at')
      .in('client_ref', ids.slice(offset, offset + 150))
      .eq('active', true)
      .order('updated_at', { ascending: false })
    if (error) throw error
    for (const row of data || []) {
      const key = String(row?.client_ref || '').trim()
      const branchId = String(row?.branch_id || '').trim()
      if (key && isValidUuid(branchId) && !result.has(key)) result.set(key, branchId)
    }
  }
  return result
}

async function upsertCentralClientFromTms(message) {
  const requestId = String(message?.requestId || '')
  const client = message?.client
  const clientId = String(client?.id || '').trim()

  if (!clientId || !client || typeof client !== 'object') {
    sendClientOperationResult(requestId, false, 'upsert', clientId, '', 'Brak identyfikatora lub danych klienta.')
    return
  }
  if (!hasRole('dispatcher', 'branch_manager', 'admin')) {
    sendClientOperationResult(requestId, false, 'upsert', clientId, '', 'Rozliczenia mają dostęp do bazy klientów wyłącznie do odczytu.')
    return
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from('tms_clients_central')
      .select('branch_id,payload')
      .eq('client_ref', clientId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError
    if (hasRole('dispatcher', 'branch_manager')) {
      const oldOwner = String(existing?.payload?.dispatcher || '').trim()
      const newOwner = String(client?.dispatcher || '').trim()
      if (hasRole('dispatcher') && oldOwner !== newOwner) {
        sendClientOperationResult(requestId, false, 'upsert', clientId, '', 'Zmiana opiekuna klienta wymaga wniosku i akceptacji kierownika oddziału.')
        return
      }
      if (hasRole('branch_manager')) {
        const profiles = Array.isArray(activeUserDirectoryMessage?.profiles) ? activeUserDirectoryMessage.profiles : []
        const ownerInBranch = (owner) => !owner || profiles.some((profile) => (
          profile?.role === 'dispatcher'
          && String(profile?.branchId || '') === currentBranchId()
          && sameName(profile?.login, owner)
        ))
        if (!ownerInBranch(oldOwner) || !ownerInBranch(newOwner)) {
          sendClientOperationResult(requestId, false, 'upsert', clientId, '', 'Kierownik może zmieniać kartę klienta tylko wtedy, gdy opiekun należy do jego oddziału lub klient nie ma opiekuna.')
          return
        }
      }
    }
    const storageBranchId = isValidUuid(existing?.branch_id) ? String(existing.branch_id) : await fallbackClientStorageBranchId(client)
    if (!storageBranchId) throw new Error('Brak aktywnego oddziału technicznego do zapisania klienta.')
    const { error } = await supabase.rpc('upsert_tms_client', {
      p_branch_id: storageBranchId,
      p_client: client,
    })
    if (error) throw error

    sendClientOperationResult(requestId, true, 'upsert', clientId, '', 'Klient został zapisany w globalnej bazie Supabase.')
    await syncCentralClientsToTms()
  } catch (error) {
    sendClientOperationResult(requestId, false, 'upsert', clientId, '', error?.message || 'Nie udało się zapisać klienta.')
  }
}

// Import klientów musi czekać na potwierdzenie każdego zapisu RPC. Wcześniej
// iframe pokazywał sukces po zmianie localStorage, a asynchroniczny diff mógł
// dopiero później zakończyć się błędem RLS, schematu lub sieci.
async function bulkUpsertCentralClientsFromTms(message) {
  const requestId = String(message?.requestId || '')
  const clients = Array.isArray(message?.clients) ? message.clients : []
  const send = (ok, imported = 0, failed = 0, errors = [], messageText = '') => {
    activeTmsFrame?.contentWindow?.postMessage({
      type: 'top-dragon-client-bulk-operation-result',
      requestId,
      ok: Boolean(ok),
      imported: Number(imported || 0),
      failed: Number(failed || 0),
      errors: Array.isArray(errors) ? errors.slice(0, 50) : [],
      message: String(messageText || ''),
    }, window.location.origin)
  }
  const sendProgress = (processed = 0, imported = 0, failed = 0) => {
    activeTmsFrame?.contentWindow?.postMessage({
      type: 'top-dragon-client-bulk-operation-progress',
      requestId,
      processed: Number(processed || 0),
      total: clients.length,
      imported: Number(imported || 0),
      failed: Number(failed || 0),
    }, window.location.origin)
  }

  if (!isActualAdmin()) {
    send(false, 0, clients.length, [], 'Masowy import klientów jest dostępny wyłącznie dla rzeczywistego administratora.')
    return
  }
  if (!clients.length) {
    send(false, 0, 0, [], 'Nie przekazano żadnych klientów do importu.')
    return
  }
  if (clients.length > 5000) {
    send(false, 0, clients.length, [], 'Jednorazowy import może zawierać maksymalnie 5000 klientów.')
    return
  }

  let imported = 0
  const errors = []
  let existingBranches
  let fallbackBranchId
  try {
    existingBranches = await existingClientBranchMap(clients.map((client) => client?.id))
    fallbackBranchId = await fallbackClientStorageBranchId()
  } catch (error) {
    send(false, 0, clients.length, [], `Nie udało się ustalić oddziału zapisu klientów: ${String(error?.message || error)}`)
    return
  }
  if (!fallbackBranchId && !existingBranches.size) {
    send(false, 0, clients.length, [], 'Brak aktywnego oddziału technicznego do zapisania klientów.')
    return
  }
  const saveOne = async (client) => {
    const clientId = String(client?.id || '').trim()
    if (!clientId || typeof client !== 'object' || !String(client?.name || '').trim() || !String(client?.address || '').trim()) {
      return { ok: false, clientId, message: 'Brak identyfikatora, nazwy lub adresu klienta.' }
    }
    try {
      const storageBranchId = existingBranches.get(clientId) || fallbackBranchId || await fallbackClientStorageBranchId(client)
      if (!storageBranchId) throw new Error('Brak aktywnego oddziału technicznego do zapisania klienta.')
      const { error } = await supabase.rpc('upsert_tms_client', { p_branch_id: storageBranchId, p_client: client })
      if (error) throw error
      return { ok: true, clientId }
    } catch (error) {
      return { ok: false, clientId, message: String(error?.message || 'Nie udało się zapisać klienta.') }
    }
  }
  // Osiem równoległych RPC przyspiesza duży arkusz, a każdy rekord nadal ma
  // osobne potwierdzenie i trafia do raportu błędów.
  for (let offset = 0; offset < clients.length; offset += 8) {
    const results = await Promise.all(clients.slice(offset, offset + 8).map(saveOne))
    results.forEach((result) => { if (result.ok) imported += 1; else errors.push({ clientId: result.clientId, message: result.message }) })
    sendProgress(Math.min(clients.length, offset + results.length), imported, errors.length)
  }

  let refreshError = ''
  try {
    await syncCentralClientsToTms()
  } catch (error) {
    refreshError = `Zapis zakończony, ale odświeżenie listy klientów nie powiodło się: ${String(error?.message || error)}`
    errors.push({ clientId: '', message: refreshError })
  }
  const failed = errors.filter((item) => String(item?.clientId || '').trim()).length
  send(imported > 0 && failed === 0 && !refreshError, imported, failed, errors, refreshError || (failed ? 'Import zakończył się częściowo. Sprawdź szczegóły.' : 'Wszyscy klienci zostali zapisani w Supabase.'))
}

async function archiveCentralClientFromTms(message) {
  const requestId = String(message?.requestId || '')
  const clientId = String(message?.clientId || '').trim()

  if (!clientId) {
    sendClientOperationResult(requestId, false, 'archive', clientId, '', 'Brak identyfikatora klienta.')
    return
  }
  if (!hasRole('admin')) {
    sendClientOperationResult(requestId, false, 'archive', clientId, '', 'Globalną kartę klienta może usunąć wyłącznie administrator.')
    return
  }

  try {
    const { data: existingRows, error: existingError } = await supabase
      .from('tms_clients_central')
      .select('branch_id')
      .eq('client_ref', clientId)
      .eq('active', true)
    if (existingError) throw existingError

    const branchIds = Array.from(new Set((existingRows || [])
      .map((row) => String(row?.branch_id || '').trim())
      .filter(isValidUuid)))
    if (!branchIds.length) {
      const fallbackBranchId = await fallbackClientStorageBranchId()
      if (fallbackBranchId) branchIds.push(fallbackBranchId)
    }
    if (!branchIds.length) throw new Error('Brak aktywnego oddziału technicznego do usunięcia klienta.')

    for (const branchId of branchIds) {
      const { error } = await supabase.rpc('archive_tms_client', {
        p_branch_id: branchId,
        p_client_ref: clientId,
      })
      if (error) throw error
    }

    sendClientOperationResult(requestId, true, 'archive', clientId, '', 'Klient został usunięty z aktywnej globalnej bazy.')
    await syncCentralClientsToTms()
  } catch (error) {
    sendClientOperationResult(requestId, false, 'archive', clientId, '', error?.message || 'Nie udało się usunąć klienta z aktywnej bazy.')
  }
}


function warsawNowForLoadQueue() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date())
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      hour: Number(values.hour || 0) + Number(values.minute || 0) / 60 + Number(values.second || 0) / 3600,
    }
  } catch {
    const now = new Date()
    return {
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      hour: now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600,
    }
  }
}

function normalizeProposedLoadDate(value) {
  const raw = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const pl = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return pl ? `${pl[3]}-${pl[2]}-${pl[1]}` : ''
}

function proposedLoadHour(payload) {
  const direct = String(payload?.startHour ?? '').trim()
  if (/^\d+(?:\.\d+)?$/.test(direct)) return Math.max(0, Math.min(24, Number(direct)))
  const clock = direct || String(payload?.loadTime || payload?.startTime || '').trim()
  const match = clock.match(/^(\d{1,2}):(\d{2})/)
  if (match) return Math.max(0, Math.min(24, Number(match[1]) + Number(match[2]) / 60))
  return 8
}

function isExpiredProposedLoadPayload(payload) {
  if (!payload || typeof payload !== 'object') return false
  if (String(payload.status || 'available').trim().toLowerCase() === 'taken') return false
  const loadDate = normalizeProposedLoadDate(String(payload.loadDate || '').trim() || String(payload.date || '').trim())
  if (!loadDate) return false
  // 3L.60: Wolne ładunki są aktywne przez cały dzień załadunku.
  // Dopiero wpis z datą wcześniejszą niż dzisiejsza (Europe/Warsaw) jest wygasły.
  return loadDate < warsawNowForLoadQueue().date
}

async function loadCentralLoadQueue() {
  if (!currentProfile) return { rows: [], expiredProposedStats: [] }

  // 3L.60: housekeeping Wolnych ładunków. Wpis pozostaje aktywny przez cały
  // dzień załadunku w Europe/Warsaw i jest przenoszony poza kolejkę dopiero następnego dnia.
  // RPC jest celowo idempotentne - można je wywoływać przy każdym odświeżeniu.
  const { error: expireError } = await supabase.rpc('archive_expired_tms_proposed_loads')
  if (expireError) {
    const message = String(expireError.message || '')
    if (!message.includes('archive_expired_tms_proposed_loads') && !message.includes('Could not find the function')) {
      console.warn('Nie udało się automatycznie wygasić przeterminowanych wolnych ładunków:', expireError)
    }
  }

  let queueQuery = supabase
    .from('tms_load_queue')
    .select('branch_id, queue_type, load_ref, payload, updated_at')
    .eq('active', true)
    .order('updated_at', { ascending: true })
  if (isBranchScopedRole()) {
    if (!currentBranchId()) return { rows: [], expiredProposedStats: [] }
    queueQuery = queueQuery.eq('branch_id', currentBranchId())
  }

  const [{ data, error }, statsResult] = await Promise.all([
    queueQuery,
    hasRole('admin') ? supabase.rpc('tms_expired_proposed_load_stats') : Promise.resolve({ data: [], error: null }),
  ])

  if (error) {
    throw new Error(`Nie udało się pobrać kolejki ładunków: ${error.message}`)
  }

  const rows = (data || [])
    .filter((row) => row?.payload && row?.load_ref && ['future', 'proposed'].includes(row?.queue_type))
    // 3L.60: nawet jeśli housekeeping Supabase chwilowo się opóźni, do panelu
    // nie wracają wpisy z poprzednich dni; bieżący dzień pozostaje widoczny w całości.
    .filter((row) => !(row?.queue_type === 'proposed' && isExpiredProposedLoadPayload(row?.payload)))
    .map((row) => ({
      id: String(row.load_ref || ''),
      branchId: String(row.branch_id || ''),
      queueType: String(row.queue_type || ''),
      payload: row.payload,
      updatedAt: String(row.updated_at || ''),
    }))

  const expiredProposedStats = statsResult?.error
    ? []
    : (statsResult?.data || []).map((row) => ({
        creator: String(row?.creator || 'Nieznany użytkownik'),
        count: Number(row?.expired_count || 0),
        latestExpiredAt: String(row?.latest_expired_at || ''),
      }))

  return { rows, expiredProposedStats }
}

async function syncCentralLoadQueueToTms() {
  const { rows, expiredProposedStats } = await loadCentralLoadQueue()
  activeLoadQueueMessage = {
    type: 'top-dragon-load-queue-data',
    rows,
    expiredProposedStats,
  }
  activeTmsFrame?.contentWindow?.postMessage(activeLoadQueueMessage, window.location.origin)
}

function scheduleCentralLoadQueueReload(delay = 120) {
  if (loadQueueReloadTimer) clearTimeout(loadQueueReloadTimer)
  loadQueueReloadTimer = setTimeout(() => {
    loadQueueReloadTimer = null
    syncCentralLoadQueueToTms().catch((error) => {
      console.error('Nie udało się odświeżyć centralnej kolejki ładunków:', error)
    })
  }, Math.max(0, Number(delay) || 0))
}

function subscribeCentralLoadQueue() {
  if (loadQueueChannel) {
    supabase.removeChannel(loadQueueChannel)
    loadQueueChannel = null
  }
  if (!currentProfile) return

  const channelName = `tms-load-queue-${currentBranchId() || 'all'}-${currentActorId() || 'user'}`
  loadQueueChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tms_load_queue' },
      () => scheduleCentralLoadQueueReload(90)
    )
    .subscribe()
}


function isLoadQueueChatSchemaMissing(error) {
  const text = `${String(error?.code || '')} ${String(error?.message || '')} ${String(error?.details || '')}`
  return /PGRST20[0245]|schema cache|tms_load_queue_chat_messages|tms_load_queue_chat_reads|create_tms_load_queue_chat_message|mark_tms_load_queue_chat_read/i.test(text)
}

async function loadCentralLoadQueueChat() {
  if (!currentProfile || !currentUser) return { messages: [], reads: [], schemaAvailable: false }

  let messagesQuery = supabase
    .from('tms_load_queue_chat_messages')
    .select('id,branch_id,load_ref,author_id,author_name,message,created_at')
    .order('created_at', { ascending: false })
    .limit(2000)
  let readsQuery = supabase
    .from('tms_load_queue_chat_reads')
    .select('branch_id,load_ref,last_read_at')
    .eq('user_id', currentActorId())
    .limit(2000)
  if (isBranchScopedRole()) {
    if (!currentBranchId()) return { messages: [], reads: [], schemaAvailable: true }
    messagesQuery = messagesQuery.eq('branch_id', currentBranchId())
    readsQuery = readsQuery.eq('branch_id', currentBranchId())
  }

  const [messagesResult, readsResult] = await Promise.all([messagesQuery, readsQuery])

  if (messagesResult.error || readsResult.error) {
    const error = messagesResult.error || readsResult.error
    if (isLoadQueueChatSchemaMissing(error)) {
      return { messages: [], reads: [], schemaAvailable: false }
    }
    throw error
  }

  return {
    schemaAvailable: true,
    messages: (messagesResult.data || []).slice().reverse().map((row) => ({
      id: String(row.id || ''),
      branchId: String(row.branch_id || ''),
      loadRef: String(row.load_ref || ''),
      authorId: String(row.author_id || ''),
      authorName: String(row.author_name || 'Użytkownik'),
      message: String(row.message || ''),
      createdAt: String(row.created_at || ''),
    })),
    reads: (readsResult.data || []).map((row) => ({
      branchId: String(row.branch_id || ''),
      loadRef: String(row.load_ref || ''),
      lastReadAt: String(row.last_read_at || ''),
    })),
  }
}

async function syncCentralLoadQueueChatToTms() {
  const data = await loadCentralLoadQueueChat()
  activeLoadQueueChatMessage = {
    type: 'top-dragon-load-queue-chat-data',
    schemaAvailable: Boolean(data.schemaAvailable),
    messages: data.messages,
    reads: data.reads,
    currentUserId: currentActorId(),
  }
  activeTmsFrame?.contentWindow?.postMessage(activeLoadQueueChatMessage, window.location.origin)
}

function scheduleCentralLoadQueueChatReload(delay = 100) {
  if (loadQueueChatReloadTimer) clearTimeout(loadQueueChatReloadTimer)
  loadQueueChatReloadTimer = setTimeout(() => {
    loadQueueChatReloadTimer = null
    syncCentralLoadQueueChatToTms().catch((error) => {
      console.error('Nie udało się odświeżyć czatu relacji:', error)
    })
  }, Math.max(0, Number(delay) || 0))
}

function subscribeCentralLoadQueueChat() {
  if (loadQueueChatChannel) {
    supabase.removeChannel(loadQueueChatChannel)
    loadQueueChatChannel = null
  }
  if (!currentProfile) return

  const channelName = `tms-load-queue-chat-${currentBranchId() || 'all'}-${currentActorId() || 'user'}`
  loadQueueChatChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tms_load_queue_chat_messages' },
      () => scheduleCentralLoadQueueChatReload(60)
    )
    .subscribe()
}

function sendLoadQueueChatOperationResult(requestId, ok, action, message) {
  activeTmsFrame?.contentWindow?.postMessage({
    type: 'top-dragon-load-queue-chat-operation-result',
    requestId: String(requestId || ''),
    ok: Boolean(ok),
    action: String(action || ''),
    message: String(message || ''),
  }, window.location.origin)
}

async function createLoadQueueChatMessageFromTms(message) {
  const requestId = String(message?.requestId || '')
  const branchId = String(message?.branchId || '').trim()
  const loadRef = String(message?.loadRef || '').trim()
  const body = String(message?.message || '').trim()

  if (!branchId || !loadRef || !body) {
    sendLoadQueueChatOperationResult(requestId, false, 'send', 'Wpisz wiadomość i wskaż relację.')
    return
  }
  if (isBranchScopedRole() && branchId !== currentBranchId()) {
    sendLoadQueueChatOperationResult(requestId, false, 'send', 'Nie możesz pisać w czacie relacji z innego oddziału.')
    return
  }
  if (body.length > 1500) {
    sendLoadQueueChatOperationResult(requestId, false, 'send', 'Wiadomość może mieć maksymalnie 1500 znaków.')
    return
  }

  try {
    const { error } = await supabase.rpc('create_tms_load_queue_chat_message', {
      p_branch_id: branchId,
      p_load_ref: loadRef,
      p_message: body,
    })
    if (error) throw error
    sendLoadQueueChatOperationResult(requestId, true, 'send', 'Wiadomość została wysłana.')
    await syncCentralLoadQueueChatToTms()
  } catch (error) {
    sendLoadQueueChatOperationResult(
      requestId,
      false,
      'send',
      isLoadQueueChatSchemaMissing(error)
        ? 'Najpierw uruchom migrację 030_load_queue_chat.sql w Supabase.'
        : (error?.message || 'Nie udało się wysłać wiadomości.')
    )
  }
}

async function markLoadQueueChatReadFromTms(message) {
  const requestId = String(message?.requestId || '')
  const branchId = String(message?.branchId || '').trim()
  const loadRef = String(message?.loadRef || '').trim()
  if (!branchId || !loadRef) return
  if (isBranchScopedRole() && branchId !== currentBranchId()) return

  try {
    const { error } = await supabase.rpc('mark_tms_load_queue_chat_read', {
      p_branch_id: branchId,
      p_load_ref: loadRef,
    })
    if (error) throw error
    if (requestId) sendLoadQueueChatOperationResult(requestId, true, 'read', '')
    await syncCentralLoadQueueChatToTms()
  } catch (error) {
    if (requestId) {
      sendLoadQueueChatOperationResult(
        requestId,
        false,
        'read',
        isLoadQueueChatSchemaMissing(error)
          ? 'Najpierw uruchom migrację 030_load_queue_chat.sql w Supabase.'
          : (error?.message || 'Nie udało się oznaczyć czatu jako przeczytanego.')
      )
    }
  }
}

function sendLoadQueueOperationResult(requestId, ok, action, queueType, loadId, branchId, message) {
  activeTmsFrame?.contentWindow?.postMessage({
    type: 'top-dragon-load-queue-operation-result',
    requestId: String(requestId || ''),
    ok: Boolean(ok),
    action: String(action || ''),
    queueType: String(queueType || ''),
    loadId: String(loadId || ''),
    branchId: String(branchId || ''),
    message: String(message || ''),
  }, window.location.origin)
}

async function upsertCentralLoadQueueFromTms(message) {
  const requestId = String(message?.requestId || '')
  const queueType = String(message?.queueType || '').trim()
  const load = message?.load
  const loadId = String(load?.id || message?.loadId || '').trim()
  const branchId = String(
    currentRole() === 'admin'
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!load || typeof load !== 'object' || !loadId || !branchId || !['future', 'proposed'].includes(queueType)) {
    sendLoadQueueOperationResult(requestId, false, 'upsert', queueType, loadId, branchId, 'Brak identyfikatora ładunku, oddziału lub typu kolejki.')
    return
  }
  if (!isOperationalEditor()) {
    sendLoadQueueOperationResult(requestId, false, 'upsert', queueType, loadId, branchId, 'Twoja rola ma dostęp do kolejek wyłącznie do odczytu.')
    return
  }

  const requestedBranchId = String(message?.branchId || '').trim()
  if (currentRole() !== 'admin' && requestedBranchId && requestedBranchId !== currentBranchId()) {
    sendLoadQueueOperationResult(requestId, false, 'upsert', queueType, loadId, branchId, 'Nie możesz zmieniać wpisu należącego do innego oddziału.')
    return
  }

  if (currentRole() === 'dispatcher') {
    const actor = currentActorLogin().toLocaleLowerCase('pl')
    const owner = String(load?.createdBy || load?.ownerDispatcher || '').trim().toLocaleLowerCase('pl')
    if (!actor || !owner || actor !== owner) {
      sendLoadQueueOperationResult(requestId, false, 'upsert', queueType, loadId, branchId, 'Nie możesz zmieniać ładunku należącego do innego spedytora.')
      return
    }
  }

  try {
    const { error } = await supabase.rpc('upsert_tms_load_queue', {
      p_branch_id: branchId,
      p_queue_type: queueType,
      p_load: load,
    })
    if (error) throw error

    await syncCentralLoadQueueToTms()
    scheduleCentralLoadQueueChatReload(0)
    sendLoadQueueOperationResult(requestId, true, 'upsert', queueType, loadId, branchId, 'Ładunek został zapisany w Supabase.')
  } catch (error) {
    sendLoadQueueOperationResult(requestId, false, 'upsert', queueType, loadId, branchId, error?.message || 'Nie udało się zapisać ładunku.')
  }
}

async function archiveCentralLoadQueueFromTms(message) {
  const requestId = String(message?.requestId || '')
  const queueType = String(message?.queueType || '').trim()
  const loadId = String(message?.loadId || '').trim()
  const branchId = String(
    currentRole() === 'admin'
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!loadId || !branchId || !['future', 'proposed'].includes(queueType)) {
    sendLoadQueueOperationResult(requestId, false, 'archive', queueType, loadId, branchId, 'Brak identyfikatora ładunku, oddziału lub typu kolejki.')
    return
  }
  if (!isOperationalEditor()) {
    sendLoadQueueOperationResult(requestId, false, 'archive', queueType, loadId, branchId, 'Twoja rola nie może usuwać wpisów z kolejki.')
    return
  }

  const requestedBranchId = String(message?.branchId || '').trim()
  if (currentRole() !== 'admin' && requestedBranchId && requestedBranchId !== currentBranchId()) {
    sendLoadQueueOperationResult(requestId, false, 'archive', queueType, loadId, branchId, 'Nie możesz usuwać wpisu należącego do innego oddziału.')
    return
  }

  try {
    if (hasRole('dispatcher')) {
      const { data: existing, error: ownershipError } = await supabase
        .from('tms_load_queue')
        .select('payload')
        .eq('branch_id', branchId)
        .eq('queue_type', queueType)
        .eq('load_ref', loadId)
        .maybeSingle()
      if (ownershipError) throw ownershipError
      const owner = existing?.payload?.createdBy || existing?.payload?.ownerDispatcher || ''
      if (!sameName(owner, currentActorLogin())) {
        sendLoadQueueOperationResult(requestId, false, 'archive', queueType, loadId, branchId, 'Możesz usuwać wyłącznie wpisy, które utworzyłeś.')
        return
      }
    }
    const { error } = await supabase.rpc('archive_tms_load_queue', {
      p_branch_id: branchId,
      p_queue_type: queueType,
      p_load_ref: loadId,
    })
    if (error) throw error

    sendLoadQueueOperationResult(requestId, true, 'archive', queueType, loadId, branchId, 'Wpis został usunięty z aktywnej kolejki.')
    await syncCentralLoadQueueToTms()
    scheduleCentralLoadQueueChatReload(0)
  } catch (error) {
    sendLoadQueueOperationResult(requestId, false, 'archive', queueType, loadId, branchId, error?.message || 'Nie udało się usunąć wpisu z kolejki.')
  }
}

async function loadCentralLoadRequests() {
  if (!currentProfile) return []

  // 3L.14: terminalna odpowiedź pozostaje na dole aktywnej listy przez 2 godziny,
  // a następnie jest centralnie archiwizowana. RPC jest housekeepingiem i nie
  // zmienia treści odpowiedzi ani autora.
  const { error: archiveError } = await supabase.rpc('archive_expired_tms_load_requests')
  if (archiveError) {
    const message = String(archiveError.message || '')
    if (!message.includes('archive_expired_tms_load_requests') && !message.includes('Could not find the function')) {
      console.warn('Nie udało się wykonać archiwizacji zapytań o ładunek:', archiveError)
    }
  }

  const { data, error } = await supabase
    .from('tms_load_requests')
    .select('request_ref, merge_key, payload, status, is_open, updated_at')
    .eq('is_open', true)
    .order('updated_at', { ascending: true })
    .limit(500)

  if (error) {
    throw new Error(`Nie udało się pobrać zapytań o ładunek: ${error.message}`)
  }

  return (data || [])
    .filter((row) => row?.payload && row?.request_ref)
    .filter((row) => {
      if (hasRole('admin', 'accounting')) return true
      const payload = row.payload || {}
      const owner = String(payload.ownerDispatcher || '').trim()
      if (hasRole('dispatcher')) {
        const login = currentActorLogin()
        const participants = Array.isArray(payload.participants) ? payload.participants : []
        return sameName(owner, login)
          || sameName(payload.requesterDispatcher, login)
          || participants.some((item) => sameName(item?.dispatcher, login))
      }
      if (hasRole('branch_manager')) {
        const directBranch = String(payload.branchId || payload.branch_id || '').trim()
        if (directBranch) return directBranch === currentBranchId()
        const profiles = Array.isArray(activeUserDirectoryMessage?.profiles) ? activeUserDirectoryMessage.profiles : []
        const ownerProfile = profiles.find((profile) => sameName(profile?.login, owner))
        return String(ownerProfile?.branchId || '') === currentBranchId()
      }
      return false
    })
    .map((row) => ({
      id: String(row.request_ref || ''),
      mergeKey: String(row.merge_key || ''),
      payload: row.payload,
      status: String(row.status || ''),
      isOpen: Boolean(row.is_open),
      updatedAt: String(row.updated_at || ''),
    }))
}

async function syncCentralLoadRequestsToTms() {
  const rows = await loadCentralLoadRequests()
  activeLoadRequestsMessage = {
    type: 'top-dragon-load-requests-data',
    rows,
  }
  activeTmsFrame?.contentWindow?.postMessage(activeLoadRequestsMessage, window.location.origin)
}

function scheduleCentralLoadRequestsReload(delay = 120) {
  if (loadRequestsReloadTimer) clearTimeout(loadRequestsReloadTimer)
  loadRequestsReloadTimer = setTimeout(() => {
    loadRequestsReloadTimer = null
    syncCentralLoadRequestsToTms().catch((error) => {
      console.error('Nie udało się odświeżyć centralnych zapytań o ładunek:', error)
    })
  }, Math.max(0, Number(delay) || 0))
}

function subscribeCentralLoadRequests() {
  if (loadRequestsChannel) {
    supabase.removeChannel(loadRequestsChannel)
    loadRequestsChannel = null
  }
  if (!currentProfile) return

  const channelName = `tms-load-requests-${currentActorId() || 'user'}`
  loadRequestsChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tms_load_requests' },
      () => scheduleCentralLoadRequestsReload(90)
    )
    .subscribe()
}

function sendLoadRequestOperationResult(requestId, ok, localRequestId, canonicalRequestId, message) {
  activeTmsFrame?.contentWindow?.postMessage({
    type: 'top-dragon-load-request-operation-result',
    requestId: String(requestId || ''),
    ok: Boolean(ok),
    localRequestId: String(localRequestId || ''),
    canonicalRequestId: String(canonicalRequestId || localRequestId || ''),
    message: String(message || ''),
  }, window.location.origin)
}

async function upsertCentralLoadRequestFromTms(message) {
  const requestId = String(message?.requestId || '')
  const localRequestId = String(message?.localRequestId || message?.request?.id || '').trim()
  const mergeKey = String(message?.mergeKey || '').trim()
  const request = message?.request

  if (!request || typeof request !== 'object' || !localRequestId || !mergeKey) {
    sendLoadRequestOperationResult(requestId, false, localRequestId, localRequestId, 'Zapytanie nie ma identyfikatora lub klucza łączenia.')
    return
  }
  if (!hasRole('dispatcher', 'branch_manager', 'admin')) {
    sendLoadRequestOperationResult(requestId, false, localRequestId, localRequestId, 'Rozliczenia nie mogą tworzyć ani zmieniać zapytań operacyjnych.')
    return
  }

  try {
    const { data, error } = await supabase.rpc('upsert_tms_load_request', {
      p_request: request,
      p_merge_key: mergeKey,
    })
    if (error) throw error

    const canonicalRequestId = String(data || localRequestId)
    await syncCentralLoadRequestsToTms()
    sendLoadRequestOperationResult(requestId, true, localRequestId, canonicalRequestId, 'Zapytanie zostało zapisane i udostępnione użytkownikom.')
  } catch (error) {
    sendLoadRequestOperationResult(requestId, false, localRequestId, localRequestId, error?.message || 'Nie udało się zapisać zapytania o ładunek.')
  }
}

async function loadCentralAudit() {
  if (!currentProfile || currentProfile.role !== 'admin') return []
  const allRows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('operation_audit')
      .select('id, actor_id, actor_name, actor_role, branch_id, branch_name, action, entity_type, entity_id, details, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`Nie udało się pobrać historii operacji: ${error.message}`)
    // Unikamy przekazywania bardzo dużej liczby argumentów do push(), co w
    // przeglądarce kończyło się błędem "Maximum call stack size exceeded".
    for (const row of (data || [])) allRows.push(row)
    if (!data || data.length < pageSize) break
  }

  return allRows.map((row) => ({
    id: String(row.id ?? ''),
    actorId: String(row.actor_id || ''),
    actorName: String(row.actor_name || ''),
    actorRole: String(row.actor_role || ''),
    branchId: String(row.branch_id || ''),
    branchName: String(row.branch_name || ''),
    action: String(row.action || ''),
    entityType: String(row.entity_type || ''),
    entityId: String(row.entity_id || ''),
    details: String(row.details || ''),
    createdAt: String(row.created_at || ''),
  }))
}

async function syncCentralAuditToTms() {
  const rows = await loadCentralAudit()
  activeAuditMessage = {
    type: 'top-dragon-audit-data',
    rows,
  }
  activeTmsFrame?.contentWindow?.postMessage(activeAuditMessage, window.location.origin)
}

function scheduleCentralAuditReload(delay = 120) {
  if (auditReloadTimer) clearTimeout(auditReloadTimer)
  auditReloadTimer = setTimeout(() => {
    auditReloadTimer = null
    syncCentralAuditToTms().catch((error) => {
      console.error('Nie udało się odświeżyć centralnej historii operacji:', error)
    })
  }, Math.max(0, Number(delay) || 0))
}

function subscribeCentralAudit() {
  if (auditChannel) {
    supabase.removeChannel(auditChannel)
    auditChannel = null
  }

  if (!currentProfile || currentProfile.role !== 'admin') return

  const channelName = `tms-audit-${currentUser?.id || 'admin'}`
  auditChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'operation_audit' },
      () => scheduleCentralAuditReload(80)
    )
    .subscribe()
}

async function writeCentralAuditFromTms(message) {
  if (!currentProfile) return

  const action = String(message?.action || '').trim()
  const entityType = String(message?.entityType || '').trim()
  const entityId = String(message?.entityId || '').trim()
  const details = String(message?.details || '').trim()

  if (!action || !entityType) return

  try {
    const { error } = await supabase.rpc('write_tms_operation_audit', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId || null,
      p_details: details || null,
    })
    if (error) throw error

    if (currentProfile.role === 'admin') {
      scheduleCentralAuditReload(40)
    }
  } catch (error) {
    console.error('Nie udało się zapisać historii operacji:', error)
  }
}

async function writeCurrentUserAudit(action, entityType, entityId = '', details = '') {
  if (!currentProfile || !action || !entityType) return
  try {
    const { error } = await supabase.rpc('write_tms_operation_audit', {
      p_action: String(action),
      p_entity_type: String(entityType),
      p_entity_id: String(entityId || '') || null,
      p_details: String(details || '') || null,
    })
    if (error) throw error
    if (currentProfile.role === 'admin') scheduleCentralAuditReload(40)
  } catch (error) {
    console.error('Nie udało się zapisać historii operacji:', error)
  }
}

function sendFleetOperationResult(requestId, ok, action, message) {
  activeTmsFrame?.contentWindow?.postMessage({
    type: 'top-dragon-fleet-operation-result',
    requestId: String(requestId || ''),
    ok: Boolean(ok),
    action: String(action || ''),
    message: String(message || ''),
  }, window.location.origin)
}


function sendRelationUsageResult(requestId, ok, message, assignmentId = '', relationRef = '') {
  activeTmsFrame?.contentWindow?.postMessage({
    type: 'top-dragon-relation-usage-result',
    requestId: String(requestId || ''),
    ok: Boolean(ok),
    message: String(message || ''),
    assignmentId: String(assignmentId || ''),
    relationRef: String(relationRef || ''),
  }, window.location.origin)
}

async function registerRelationUsageFromTms(message) {
  const requestId = String(message?.requestId || '')
  const relationRef = String(message?.relationRef || '').trim()
  const assignmentId = String(message?.assignmentId || '').trim()

  if (!relationRef || !assignmentId) {
    sendRelationUsageResult(
      requestId,
      false,
      'Brak identyfikatora relacji lub zestawu.',
      assignmentId,
      relationRef
    )
    return
  }
  if (!isOperationalEditor()) {
    sendRelationUsageResult(requestId, false, 'Ta rola nie może rejestrować użycia floty.', assignmentId, relationRef)
    return
  }

  try {
    const assignment = await loadFleetAssignmentScope(assignmentId)
    if (!canModifyFleetAssignment(assignment)) throw new Error('Zestaw znajduje się poza Twoim zakresem floty.')
    const { error } = await supabase.rpc('register_fleet_relation_usage', {
      p_relation_ref: relationRef,
      p_assignment_id: assignmentId,
    })

    if (error) throw error

    sendRelationUsageResult(
      requestId,
      true,
      'Historia wykorzystania zestawu została zapisana.',
      assignmentId,
      relationRef
    )

    // Nie odświeżamy całej floty po samym zapisie historii relacji.
    // Iframe TMS oznacza użyty zestaw jako relationLocked po otrzymaniu
    // top-dragon-relation-usage-result. Pełna synchronizacja floty w tym
    // miejscu przebudowywała tablicę Planu kierowców tuż po dodaniu relacji
    // i mogła powodować jej chwilowe/zauważalne zniknięcie.
  } catch (error) {
    sendRelationUsageResult(
      requestId,
      false,
      error?.message || 'Nie udało się zapisać historii wykorzystania floty.',
      assignmentId,
      relationRef
    )
  }
}

async function createFleetSetFromTms(message) {
  const payload = message?.payload || {}
  const requestId = message?.requestId || ''

  if (!hasRole('dispatcher', 'branch_manager', 'admin')) {
    sendFleetOperationResult(requestId, false, 'create', 'Twoja rola nie może dodawać floty.')
    return
  }

  try {
    let assignedDispatcherId = String(payload.assignedDispatcherId || '').trim()
    let branchId = String(payload.branchId || '').trim()
    if (hasRole('dispatcher')) {
      assignedDispatcherId = currentActorId()
      branchId = currentBranchId()
    } else if (hasRole('branch_manager')) {
      branchId = currentBranchId()
      const { data: target, error: targetError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', assignedDispatcherId)
        .eq('branch_id', branchId)
        .eq('role', 'dispatcher')
        .eq('active', true)
        .maybeSingle()
      if (targetError) throw targetError
      if (!target) throw new Error('Kierownik może przypisać flotę wyłącznie aktywnemu spedytorowi ze swojego oddziału.')
    }
    if (!isValidUuid(assignedDispatcherId) || !isValidUuid(branchId)) {
      throw new Error('Nieprawidłowy spedytor lub oddział dla nowego zestawu.')
    }
    const { error } = await supabase.rpc('create_fleet_set', {
      p_carrier_name: String(payload.carrierName || '').trim(),
      p_driver_name: String(payload.driverName || '').trim(),
      p_assigned_dispatcher_id: assignedDispatcherId,
      p_branch_id: branchId,
      p_phone: String(payload.phone || '').trim() || null,
      p_identity_document_number: String(payload.identityDocumentNumber || '').trim() || null,
      p_vehicle_registration_no: String(payload.vehicleRegistrationNo || '').trim() || null,
      p_vehicle_brand: String(payload.vehicleBrand || '').trim() || null,
      p_trailer_registration_no: String(payload.trailerRegistrationNo || '').trim() || null,
      p_trailer_height_m: payload.trailerHeightM == null ? null : Number(payload.trailerHeightM),
      p_nationality: String(payload.nationality || '').trim() || null,
      p_base_location: String(payload.baseLocation || '').trim() || null,
    })

    if (error) throw error

    await syncFleetDataToTms()
    sendFleetOperationResult(requestId, true, 'create', 'Kierowca zapisany')
  } catch (error) {
    sendFleetOperationResult(requestId, false, 'create', error?.message || 'Nie udało się zapisać zestawu.')
  }
}

async function updateFleetSetFromTms(message) {
  const requestId = String(message?.requestId || '')
  const assignmentId = String(message?.assignmentId || '').trim()
  const payload = message?.payload || {}

  if (!assignmentId) {
    sendFleetOperationResult(requestId, false, 'update', 'Brak identyfikatora zestawu.')
    return
  }
  if (!hasRole('dispatcher', 'branch_manager', 'admin')) {
    sendFleetOperationResult(requestId, false, 'update', 'Twoja rola nie może edytować floty.')
    return
  }

  try {
    const assignment = await loadFleetAssignmentScope(assignmentId)
    if (!canModifyFleetAssignment(assignment)) throw new Error('Możesz edytować wyłącznie flotę przypisaną do Twojego zakresu.')
    const { error } = await supabase.rpc('update_fleet_set_details', {
      p_assignment_id: assignmentId,
      p_driver_name: String(payload.driverName || '').trim(),
      p_phone: String(payload.phone || '').trim() || null,
      p_identity_document_number: String(payload.identityDocumentNumber || '').trim() || null,
      p_vehicle_registration_no: String(payload.vehicleRegistrationNo || '').trim() || null,
      p_vehicle_brand: String(payload.vehicleBrand || '').trim() || null,
      p_trailer_registration_no: String(payload.trailerRegistrationNo || '').trim() || null,
      p_trailer_height_m: payload.trailerHeightM == null || payload.trailerHeightM === '' ? null : Number(payload.trailerHeightM),
      p_nationality: String(payload.nationality || '').trim() || null,
      p_base_location: String(payload.baseLocation || '').trim() || null,
    })
    if (error) throw error

    await syncFleetDataToTms()
    sendFleetOperationResult(requestId, true, 'update', 'Dane pojazdu i kierowcy zostały uzupełnione w centralnej flocie.')
  } catch (error) {
    sendFleetOperationResult(requestId, false, 'update', error?.message || 'Nie udało się zaktualizować danych pojazdu.')
  }
}

async function setCarrierRateFromTms(message) {
  const requestId = String(message?.requestId || '')
  const carrierId = String(message?.carrierId || '').trim()
  const ratePerKm = Number(message?.ratePerKm)
  const effectiveFrom = String(message?.effectiveFrom || '').slice(0, 10)

  if (currentProfile?.role !== 'admin') {
    sendFleetOperationResult(requestId, false, 'carrier-rate', 'Tylko administrator może zmieniać stawkę przewoźnika za kilometr.')
    return
  }
  if (!carrierId) {
    sendFleetOperationResult(requestId, false, 'carrier-rate', 'Brak identyfikatora przewoźnika.')
    return
  }
  if (!Number.isFinite(ratePerKm) || ratePerKm <= 0) {
    sendFleetOperationResult(requestId, false, 'carrier-rate', 'Stawka za kilometr musi być większa od zera.')
    return
  }

  try {
    const { error } = await supabase.rpc('set_tms_carrier_rate', {
      p_carrier_id: carrierId,
      p_rate_per_km: ratePerKm,
      p_effective_from: effectiveFrom || null,
    })
    if (error) throw error
    await syncFleetDataToTms()
    sendFleetOperationResult(requestId, true, 'carrier-rate', `Stawka ${ratePerKm.toFixed(2)} PLN/km została zapisana${effectiveFrom ? ` od ${effectiveFrom}` : ''}.`)
  } catch (error) {
    sendFleetOperationResult(requestId, false, 'carrier-rate', error?.message || 'Nie udało się zapisać stawki przewoźnika.')
  }
}

async function deleteFleetSetFromTms(message) {
  const requestId = message?.requestId || ''
  const assignmentId = String(message?.assignmentId || '').trim()

  if (currentProfile?.role !== 'admin') {
    sendFleetOperationResult(requestId, false, 'delete', 'Tylko administrator może usuwać pojazdy z aktywnej floty.')
    return
  }

  if (!assignmentId) {
    sendFleetOperationResult(requestId, false, 'delete', 'Brak identyfikatora zestawu.')
    return
  }

  try {
    const { error } = await supabase.rpc('delete_fleet_set', {
      p_assignment_id: assignmentId,
    })

    if (error) throw error

    await syncFleetDataToTms()
    sendFleetOperationResult(requestId, true, 'delete', 'Zestaw został zarchiwizowany i usunięty z aktywnej floty. Dane historyczne pozostały zachowane.')
  } catch (error) {
    sendFleetOperationResult(requestId, false, 'delete', error?.message || 'Nie udało się zarchiwizować zestawu.')
  }
}

async function setFleetVisibilityFromTms(message) {
  const requestId = String(message?.requestId || '')
  const assignmentId = String(message?.assignmentId || '').trim()
  const hidden = Boolean(message?.hidden)

  if (!assignmentId) {
    sendFleetOperationResult(requestId, false, 'visibility', 'Brak identyfikatora zestawu.')
    return
  }
  if (!hasRole('dispatcher', 'branch_manager', 'admin')) {
    sendFleetOperationResult(requestId, false, 'visibility', 'Twoja rola nie może zmieniać widoczności floty.')
    return
  }

  try {
    const assignment = await loadFleetAssignmentScope(assignmentId)
    if (!canModifyFleetAssignment(assignment)) throw new Error('Możesz zmieniać widoczność wyłącznie floty przypisanej do Twojego zakresu.')
    fleetRealtimeMuteUntil = Date.now() + 1800
    const { error } = await supabase.rpc('set_fleet_assignment_hidden', {
      p_assignment_id: assignmentId,
      p_hidden: hidden,
    })
    if (error) throw error
    const cachedRow = activeFleetMessage?.rows?.find((row) => String(row?.id || '') === assignmentId)
    if (cachedRow) cachedRow.hidden = hidden
    sendFleetOperationResult(
      requestId,
      true,
      'visibility',
      hidden
        ? 'Pojazd został ukryty z planu, mapy i dopasowań. Historia pozostała zachowana.'
        : 'Pojazd został ponownie pokazany w planie, na mapie i w dopasowaniach.'
    )
  } catch (error) {
    sendFleetOperationResult(requestId, false, 'visibility', error?.message || 'Nie udało się zmienić widoczności pojazdu.')
  }
}

async function reassignFleetSetFromTms(message) {
  const requestId = String(message?.requestId || '')
  const assignmentId = String(message?.assignmentId || '').trim()
  const toDispatcherId = String(message?.toDispatcherId || '').trim()

  if (!assignmentId || !isValidUuid(toDispatcherId)) {
    sendFleetOperationResult(requestId, false, 'reassign', 'Brak zestawu lub prawidłowego spedytora docelowego.')
    return
  }
  if (!hasRole('dispatcher', 'branch_manager', 'admin')) {
    sendFleetOperationResult(requestId, false, 'reassign', 'Twoja rola nie może zmieniać przypisania kierowcy.')
    return
  }

  try {
    const assignment = await loadFleetAssignmentScope(assignmentId)
    if (!canModifyFleetAssignment(assignment)) throw new Error('Kierowcę może przepisać jego obecny, macierzysty lub uprawniony przełożony.')

    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id,branch_id,display_name')
      .eq('id', toDispatcherId)
      .eq('branch_id', String(assignment?.branch_id || ''))
      .eq('role', 'dispatcher')
      .eq('active', true)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target) throw new Error('Spedytor docelowy nie jest aktywny albo należy do innego oddziału.')

    const { data: updated, error: updateError } = await supabase
      .from('fleet_assignments')
      .update({ assigned_dispatcher_id: toDispatcherId })
      .eq('id', assignmentId)
      .eq('active', true)
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) throw new Error('Przypisanie nie zostało zmienione. Sprawdź uprawnienia bazy danych.')

    await syncFleetDataToTms()
    sendFleetOperationResult(requestId, true, 'reassign', `Kierowca został tymczasowo przypisany do: ${target.display_name || 'wybrany spedytor'}.`)
  } catch (error) {
    sendFleetOperationResult(requestId, false, 'reassign', error?.message || 'Nie udało się zmienić przypisania kierowcy.')
  }
}

async function setDriverRowColorFromTms(message) {
  const requestId = String(message?.requestId || '')
  const driverId = String(message?.driverId || '').trim()
  const color = String(message?.color || '').trim().toLowerCase()
  const allowedColors = new Set(['', 'yellow', 'green', 'blue', 'pink', 'purple', 'orange', 'gray'])

  if (currentRole() !== 'dispatcher' || !currentActorId()) {
    sendFleetOperationResult(requestId, false, 'color', 'Kolor wiersza może ustawić wyłącznie spedytor.')
    return
  }
  if (!driverId || !allowedColors.has(color)) {
    sendFleetOperationResult(requestId, false, 'color', 'Nieprawidłowy kierowca lub kolor.')
    return
  }

  try {
    const { data: visibleAssignments, error: ownershipError } = await supabase
      .from('fleet_assignments')
      .select('id')
      .eq('driver_id', driverId)
      .eq('branch_id', currentBranchId())
      .eq('active', true)
      .limit(1)
    if (ownershipError) throw ownershipError
    if (!visibleAssignments?.length) throw new Error('Możesz oznaczać kolorem tylko kierowców widocznych w Twoim oddziale.')

    if (!color) {
      const { error } = await supabase
        .from('driver_row_preferences')
        .delete()
        .eq('user_id', currentActorId())
        .eq('driver_id', driverId)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('driver_row_preferences')
        .upsert({
          user_id: currentActorId(),
          driver_id: driverId,
          color,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,driver_id' })
      if (error) throw error
    }

    await syncFleetDataToTms()
    sendFleetOperationResult(requestId, true, 'color', color ? 'Kolor wiersza kierowcy został zapisany prywatnie.' : 'Oznaczenie kolorem zostało usunięte.')
  } catch (error) {
    sendFleetOperationResult(requestId, false, 'color', error?.message || 'Nie udało się zapisać koloru kierowcy.')
  }
}

async function importFleetExcelFromTms(message) {
  const requestId = String(message?.requestId || '')
  const sourceRows = Array.isArray(message?.rows) ? message.rows : []

  if (!currentProfile || currentRole() !== 'admin') {
    sendFleetOperationResult(requestId, false, 'import', 'Import floty jest dostępny wyłącznie dla administratora.')
    return
  }
  if (!sourceRows.length) {
    sendFleetOperationResult(requestId, false, 'import', 'Arkusz nie zawiera żadnych danych floty.')
    return
  }
  if (sourceRows.length > 2000) {
    sendFleetOperationResult(requestId, false, 'import', 'Jednorazowo można zaimportować maksymalnie 2000 wierszy floty.')
    return
  }

  let rows = sourceRows.map((row) => ({ ...row }))
  if (hasRole('dispatcher')) {
    rows = rows.map((row) => ({ ...row, branchId: currentBranchId(), assignedDispatcherId: currentActorId() }))
  } else if (hasRole('branch_manager')) {
    rows = rows.map((row) => ({ ...row, branchId: currentBranchId() }))
    const dispatcherIds = [...new Set(rows.map((row) => String(row?.assignedDispatcherId || '').trim()).filter(Boolean))]
    const { data: branchDispatchers, error: branchDispatchersError } = await supabase
      .from('profiles')
      .select('id')
      .in('id', dispatcherIds)
      .eq('branch_id', currentBranchId())
      .eq('role', 'dispatcher')
      .eq('active', true)
    if (branchDispatchersError) {
      sendFleetOperationResult(requestId, false, 'import', branchDispatchersError.message || 'Nie udało się sprawdzić spedytorów z oddziału.')
      return
    }
    const allowedIds = new Set((branchDispatchers || []).map((profile) => String(profile.id || '')))
    if (dispatcherIds.some((id) => !allowedIds.has(id))) {
      sendFleetOperationResult(requestId, false, 'import', 'Arkusz zawiera spedytora spoza oddziału kierownika. Import zatrzymano przed zapisem.')
      return
    }
  }

  const invalidRowIndex = rows.findIndex((row) => {
    const branchId = String(row?.branchId || '').trim()
    const dispatcherId = String(row?.assignedDispatcherId || '').trim()
    const assignmentId = String(row?.assignmentId || '').trim()
    return !isValidUuid(branchId) || !isValidUuid(dispatcherId) || (assignmentId && !isValidUuid(assignmentId))
  })
  if (invalidRowIndex >= 0) {
    sendFleetOperationResult(requestId, false, 'import', `Wiersz ${invalidRowIndex + 2} zawiera nieprawidłowy identyfikator oddziału, spedytora lub zestawu. Import zatrzymano przed zapisem.`)
    return
  }

  try {
    const { data, error } = await supabase.rpc('import_fleet_rows_excel', { p_rows: rows })
    if (error) throw error
    await syncFleetDataToTms()

    const created = Number(data?.created || 0)
    const updated = Number(data?.updated || 0)
    const skipped = Number(data?.skipped || 0)
    const firstError = Array.isArray(data?.errors) && data.errors.length ? String(data.errors[0]?.message || '') : ''
    const summary = `Dodano ${created}, zaktualizowano ${updated}${skipped ? `, pominięto ${skipped}` : ''}.` + (firstError ? ` Pierwszy błąd: ${firstError}` : '')
    sendFleetOperationResult(requestId, true, 'import', summary)
  } catch (error) {
    sendFleetOperationResult(requestId, false, 'import', error?.message || 'Nie udało się zaimportować floty z Excela.')
  }
}


function normalizeWeekStart(value) {
  const raw = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''
  // 3L.46: obliczamy tydzień wyłącznie w UTC. Lokalny Date + toISOString()
  // w Polsce przesuwał poniedziałek o dzień wstecz (np. 17.08 -> 16.08),
  // przez co iframe czekał na inny weekStart niż zwracał parent.
  const date = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  const isoDay = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - isoDay + 1)
  return date.toISOString().slice(0, 10)
}

function isWeeklyFinanceSchemaCacheError(error) {
  const text = `${String(error?.code || '')} ${String(error?.message || '')} ${String(error?.details || '')}`
  return /PGRST20[024]|schema cache|driver_id|driver_name|recipient_approved|manager_approved|delete_requested|deleted_at|rejected_at|tms_driver_week_settlement_statuses/i.test(text)
}

async function queryWeeklyFinanceRows(normalizedWeek, extended = true) {
  const adjustmentSelect = extended
    ? 'id,week_start,branch_id,carrier_id,carrier_name,driver_id,driver_name,amount,comment,created_by,created_at,active'
    : 'id,week_start,branch_id,carrier_id,carrier_name,amount,comment,created_by,created_at,active'
  const transferSelect = extended
    ? 'id,week_start,from_dispatcher_id,to_dispatcher_id,from_branch_id,to_branch_id,amount,comment,status,created_at,responded_at,recipient_approved_at,recipient_approved_by,from_manager_approved_at,from_manager_approved_by,to_manager_approved_at,to_manager_approved_by,delete_requested_at,delete_requested_by,deleted_at,deleted_by,rejected_at,rejected_by'
    : 'id,week_start,from_dispatcher_id,to_dispatcher_id,from_branch_id,to_branch_id,amount,comment,status,created_at,responded_at'

  return Promise.all([
    supabase.from('tms_carrier_week_adjustments').select(adjustmentSelect).eq('week_start', normalizedWeek).eq('active', true).order('created_at', { ascending: true }),
    supabase.from('tms_dispatcher_week_transfers').select(transferSelect).eq('week_start', normalizedWeek).order('created_at', { ascending: true }),
  ])
}

async function queryWeeklySettlementStatusRows(normalizedWeek) {
  const result = await supabase
    .from('tms_driver_week_settlement_statuses')
    .select('id,week_start,driver_id,driver_name,status,updated_by,updated_at')
    .eq('week_start', normalizedWeek)
    .order('updated_at', { ascending: true })

  if (result.error && (String(result.error?.code || '') === 'PGRST205' || /tms_driver_week_settlement_statuses|schema cache/i.test(String(result.error?.message || '')))) {
    // Pozwala wdrożyć frontend przed uruchomieniem migracji 028 bez blokowania
    // dotychczasowych wyrównań i transferów. Po migracji statusy pojawią się automatycznie.
    return { data: [], error: null, schemaMissing: true }
  }
  return result
}

async function loadWeeklySettlementData(weekStart) {
  const normalizedWeek = normalizeWeekStart(weekStart)
  if (!normalizedWeek) throw new Error('Nieprawidłowy tydzień rozliczeniowy.')

  const weeklyQueryWithTimeout = async (extended) => {
    let timer = null
    try {
      return await Promise.race([
        queryWeeklyFinanceRows(normalizedWeek, extended),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Przekroczono czas pobierania rozliczeń tygodniowych.')), 6000)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  let [{ data: adjustments, error: adjustmentsError }, { data: transfers, error: transfersError }] = await weeklyQueryWithTimeout(true)
  if ((adjustmentsError && isWeeklyFinanceSchemaCacheError(adjustmentsError)) || (transfersError && isWeeklyFinanceSchemaCacheError(transfersError))) {
    // Po migracji 026 PostgREST może jeszcze przez chwilę widzieć stary schemat.
    // Nie blokujemy całego panelu czerwonym błędem - czytamy stare kolumny do czasu reloadu cache.
    ;([{ data: adjustments, error: adjustmentsError }, { data: transfers, error: transfersError }] = await weeklyQueryWithTimeout(false))
  }

  if (adjustmentsError) throw new Error(`Nie udało się pobrać wyrównań przewoźników: ${adjustmentsError.message}`)
  if (transfersError) throw new Error(`Nie udało się pobrać przelewów spedytorów: ${transfersError.message}`)

  const { data: settlementStatuses, error: settlementStatusesError } = await queryWeeklySettlementStatusRows(normalizedWeek)
  if (settlementStatusesError) throw new Error(`Nie udało się pobrać statusów rozliczeń tygodnia: ${settlementStatusesError.message}`)

  let visibleAdjustments = adjustments || []
  let visibleTransfers = transfers || []
  let visibleSettlementStatuses = settlementStatuses || []
  if (hasRole('branch_manager')) {
    const { data: branchAssignments, error: branchAssignmentsError } = await supabase
      .from('fleet_assignments')
      .select('driver_id')
      .eq('branch_id', currentBranchId())
      .eq('active', true)
    if (branchAssignmentsError) throw branchAssignmentsError
    const branchDriverIds = new Set((branchAssignments || []).map((row) => String(row.driver_id || '')))
    visibleAdjustments = visibleAdjustments.filter((row) => String(row?.branch_id || '') === currentBranchId())
    visibleTransfers = visibleTransfers.filter((row) => [row?.from_branch_id, row?.to_branch_id].some((id) => String(id || '') === currentBranchId()))
    visibleSettlementStatuses = visibleSettlementStatuses.filter((row) => branchDriverIds.has(String(row?.driver_id || '')))
  } else if (hasRole('dispatcher')) {
    const { data: ownedAssignments, error: ownedAssignmentsError } = await supabase
      .from('fleet_assignments')
      .select('driver_id,carrier_id')
      .eq('assigned_dispatcher_id', currentActorId())
      .eq('active', true)
    if (ownedAssignmentsError) throw ownedAssignmentsError
    const ownedDriverIds = new Set((ownedAssignments || []).map((row) => String(row.driver_id || '')))
    const ownedCarrierIds = new Set((ownedAssignments || []).map((row) => String(row.carrier_id || '')))
    visibleAdjustments = visibleAdjustments.filter((row) => ownedDriverIds.has(String(row?.driver_id || '')) || ownedCarrierIds.has(String(row?.carrier_id || '')))
    visibleTransfers = visibleTransfers.filter((row) => [row?.from_dispatcher_id, row?.to_dispatcher_id].some((id) => String(id || '') === currentActorId()))
    visibleSettlementStatuses = visibleSettlementStatuses.filter((row) => ownedDriverIds.has(String(row?.driver_id || '')))
  }

  const directoryProfiles = Array.isArray(activeUserDirectoryMessage?.profiles) ? activeUserDirectoryMessage.profiles : []
  const directoryById = new Map(directoryProfiles.map((profile) => [String(profile.id || ''), profile]))

  return {
    weekStart: normalizedWeek,
    carrierAdjustments: visibleAdjustments.map((row) => ({
      id: String(row.id || ''),
      weekStart: String(row.week_start || normalizedWeek),
      branchId: String(row.branch_id || ''),
      carrierId: String(row.carrier_id || ''),
      carrierName: String(row.carrier_name || ''),
      driverId: String(row.driver_id || ''),
      driverName: String(row.driver_name || ''),
      amount: Number(row.amount || 0),
      comment: String(row.comment || ''),
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at || ''),
    })),
    settlementStatuses: visibleSettlementStatuses.map((row) => ({
      id: String(row.id || ''),
      weekStart: String(row.week_start || normalizedWeek),
      driverId: String(row.driver_id || ''),
      driverName: String(row.driver_name || ''),
      status: String(row.status || 'Nowe'),
      updatedBy: String(row.updated_by || ''),
      updatedAt: String(row.updated_at || ''),
    })),
    transfers: visibleTransfers.map((row) => ({
      id: String(row.id || ''),
      weekStart: String(row.week_start || normalizedWeek),
      fromDispatcherId: String(row.from_dispatcher_id || ''),
      toDispatcherId: String(row.to_dispatcher_id || ''),
      fromBranchId: String(row.from_branch_id || ''),
      toBranchId: String(row.to_branch_id || ''),
      amount: Number(row.amount || 0),
      comment: String(row.comment || ''),
      status: String(row.status || 'pending'),
      createdAt: String(row.created_at || ''),
      respondedAt: String(row.responded_at || ''),
      recipientApprovedAt: String(row.recipient_approved_at || ''),
      recipientApprovedBy: String(row.recipient_approved_by || ''),
      fromManagerApprovedAt: String(row.from_manager_approved_at || ''),
      fromManagerApprovedBy: String(row.from_manager_approved_by || ''),
      toManagerApprovedAt: String(row.to_manager_approved_at || ''),
      toManagerApprovedBy: String(row.to_manager_approved_by || ''),
      deleteRequestedAt: String(row.delete_requested_at || ''),
      deleteRequestedBy: String(row.delete_requested_by || ''),
      deletedAt: String(row.deleted_at || ''),
      deletedBy: String(row.deleted_by || ''),
      rejectedAt: String(row.rejected_at || ''),
      rejectedBy: String(row.rejected_by || ''),
      fromDispatcherName: String(directoryById.get(String(row.from_dispatcher_id || ''))?.displayName || ''),
      toDispatcherName: String(directoryById.get(String(row.to_dispatcher_id || ''))?.displayName || ''),
      fromDispatcherLogin: String(directoryById.get(String(row.from_dispatcher_id || ''))?.login || ''),
      toDispatcherLogin: String(directoryById.get(String(row.to_dispatcher_id || ''))?.login || ''),
    })),
  }
}

async function syncWeeklySettlementToTms(weekStart = weeklySettlementWeekStart) {
  const normalizedWeek = normalizeWeekStart(weekStart)
  if (!normalizedWeek || !currentProfile) return
  weeklySettlementWeekStart = normalizedWeek
  const payload = await loadWeeklySettlementData(normalizedWeek)
  activeWeeklySettlementMessage = {
    type: 'top-dragon-weekly-settlement-data',
    ...payload,
  }
  activeTmsFrame?.contentWindow?.postMessage(activeWeeklySettlementMessage, window.location.origin)
}


async function syncBoardWeeklySettlementsToTms(message = {}) {
  if (!currentProfile) return
  const requested = Array.isArray(message?.weekStarts) ? message.weekStarts : []
  const weekStarts = [...new Set(requested.map(normalizeWeekStart).filter(Boolean))].slice(0, 8)
  if (!weekStarts.length) return
  const weeks = []
  for (const weekStart of weekStarts) weeks.push(await loadWeeklySettlementData(weekStart))
  activeTmsFrame?.contentWindow?.postMessage({
    type: 'top-dragon-board-weekly-settlement-data',
    requestId: String(message?.requestId || ''),
    weeks,
  }, window.location.origin)
}

function scheduleWeeklySettlementReload(delay = 80) {
  if (!weeklySettlementWeekStart) return
  if (weeklySettlementReloadTimer) clearTimeout(weeklySettlementReloadTimer)
  weeklySettlementReloadTimer = setTimeout(() => {
    weeklySettlementReloadTimer = null
    syncWeeklySettlementToTms(weeklySettlementWeekStart).catch((error) => {
      console.error('Nie udało się odświeżyć tygodniowego podsumowania:', error)
    })
  }, Math.max(0, Number(delay) || 0))
}

function subscribeWeeklySettlement() {
  if (weeklySettlementChannel) {
    supabase.removeChannel(weeklySettlementChannel)
    weeklySettlementChannel = null
  }
  if (!currentProfile) return

  weeklySettlementChannel = supabase
    .channel(`tms-weekly-settlement-${currentActorId() || 'user'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_carrier_week_adjustments' }, () => {
      scheduleWeeklySettlementReload(70)
      activeTmsFrame?.contentWindow?.postMessage({ type: 'top-dragon-weekly-settlement-invalidated' }, window.location.origin)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_dispatcher_week_transfers' }, () => {
      scheduleWeeklySettlementReload(70)
      activeTmsFrame?.contentWindow?.postMessage({ type: 'top-dragon-weekly-settlement-invalidated' }, window.location.origin)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_driver_week_settlement_statuses' }, () => {
      scheduleWeeklySettlementReload(70)
      activeTmsFrame?.contentWindow?.postMessage({ type: 'top-dragon-weekly-settlement-invalidated' }, window.location.origin)
    })
    .subscribe()
}

function sendWeeklySettlementOperationResult(requestId, ok, action, message) {
  activeTmsFrame?.contentWindow?.postMessage({
    type: 'top-dragon-weekly-settlement-operation-result',
    requestId: String(requestId || ''),
    ok: Boolean(ok),
    action: String(action || ''),
    message: String(message || ''),
  }, window.location.origin)
}

async function rpcWithWeeklySchemaRetry(name, args) {
  let result = await supabase.rpc(name, args)
  if (!result.error || !isWeeklyFinanceSchemaCacheError(result.error)) return result
  await new Promise((resolve) => setTimeout(resolve, 700))
  result = await supabase.rpc(name, args)
  if (!result.error || !isWeeklyFinanceSchemaCacheError(result.error)) return result
  await new Promise((resolve) => setTimeout(resolve, 1400))
  return supabase.rpc(name, args)
}

async function refreshWeeklySettlementAfterMutation(weekStart) {
  const normalizedWeek = normalizeWeekStart(weekStart || weeklySettlementWeekStart)
  if (!normalizedWeek) return
  weeklySettlementWeekStart = normalizedWeek
  // Zapis w bazie jest operacją nadrzędną. Błąd odświeżenia widoku nie może
  // zmieniać poprawnego zapisu w fałszywy komunikat "nie udało się zapisać".
  try {
    await syncWeeklySettlementToTms(normalizedWeek)
  } catch (error) {
    console.warn('Zapisano rozliczenie, ale nie udało się od razu odświeżyć danych tygodnia:', error)
  }
  activeTmsFrame?.contentWindow?.postMessage({ type: 'top-dragon-weekly-settlement-invalidated' }, window.location.origin)
}

async function createCarrierWeekAdjustmentFromTms(message) {
  const requestId = String(message?.requestId || '')
  const weekStart = normalizeWeekStart(message?.weekStart)
  if (!hasRole('dispatcher', 'branch_manager', 'accounting', 'admin')) {
    sendWeeklySettlementOperationResult(requestId, false, 'carrier-adjustment-create', 'Brak uprawnień do korekt przewoźnika.')
    return
  }
  try {
    const carrierId = String(message?.carrierId || '').trim()
    const driverId = String(message?.driverId || '').trim()
    if (hasRole('dispatcher', 'branch_manager')) {
      let scopeQuery = supabase
        .from('fleet_assignments')
        .select('id')
        .eq('active', true)
        .limit(1)
      if (driverId) scopeQuery = scopeQuery.eq('driver_id', driverId)
      else if (carrierId) scopeQuery = scopeQuery.eq('carrier_id', carrierId)
      if (hasRole('dispatcher')) scopeQuery = scopeQuery.eq('assigned_dispatcher_id', currentActorId())
      if (hasRole('branch_manager')) scopeQuery = scopeQuery.eq('branch_id', currentBranchId())
      const { data: scopedAssignment, error: scopedAssignmentError } = await scopeQuery
      if (scopedAssignmentError) throw scopedAssignmentError
      if (!scopedAssignment?.length) throw new Error('Korekta dotyczy przewoźnika lub kierowcy spoza Twojego zakresu.')
    }
    const { error } = await rpcWithWeeklySchemaRetry('create_tms_carrier_week_adjustment_v2', {
      p_week_start: weekStart,
      p_carrier_id: carrierId || null,
      p_driver_id: driverId || null,
      p_amount: Number(message?.amount || 0),
      p_comment: String(message?.comment || '').trim(),
    })
    if (error) throw error
    // Potwierdzamy zapis natychmiast po sukcesie RPC. Odświeżenie danych jest
    // osobnym krokiem i nie może spowodować duplikowania poprawnie zapisanej korekty.
    sendWeeklySettlementOperationResult(requestId, true, 'carrier-adjustment-create', 'Wyrównanie przewoźnika zostało zapisane.')
    void refreshWeeklySettlementAfterMutation(weekStart)
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'carrier-adjustment-create', error?.message || 'Nie udało się zapisać wyrównania przewoźnika.')
  }
}

async function deleteCarrierWeekAdjustmentFromTms(message) {
  const requestId = String(message?.requestId || '')
  const weekStart = normalizeWeekStart(message?.weekStart || weeklySettlementWeekStart)
  if (!hasRole('dispatcher', 'branch_manager', 'accounting', 'admin')) {
    sendWeeklySettlementOperationResult(requestId, false, 'carrier-adjustment-delete', 'Brak uprawnień do usuwania korekt przewoźnika.')
    return
  }
  try {
    const adjustmentId = String(message?.adjustmentId || '').trim()
    if (hasRole('dispatcher', 'branch_manager')) {
      const { data: adjustment, error: adjustmentError } = await supabase
        .from('tms_carrier_week_adjustments')
        .select('branch_id,created_by')
        .eq('id', adjustmentId)
        .maybeSingle()
      if (adjustmentError) throw adjustmentError
      const allowed = hasRole('branch_manager')
        ? String(adjustment?.branch_id || '') === currentBranchId()
        : String(adjustment?.created_by || '') === currentActorId()
      if (!allowed) throw new Error('Możesz usunąć wyłącznie korektę utworzoną w swoim zakresie.')
    }
    const { error } = await supabase.rpc('archive_tms_carrier_week_adjustment', {
      p_adjustment_id: adjustmentId || null,
    })
    if (error) throw error
    sendWeeklySettlementOperationResult(requestId, true, 'carrier-adjustment-delete', 'Wyrównanie zostało usunięte z aktywnego podsumowania.')
    void refreshWeeklySettlementAfterMutation(weekStart)
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'carrier-adjustment-delete', error?.message || 'Nie udało się usunąć wyrównania.')
  }
}

async function createDispatcherWeekTransferFromTms(message) {
  const requestId = String(message?.requestId || '')
  const weekStart = normalizeWeekStart(message?.weekStart)
  if (!hasRole('dispatcher')) {
    sendWeeklySettlementOperationResult(requestId, false, 'dispatcher-transfer-create', 'Transfer wyniku może utworzyć wyłącznie spedytor.')
    return
  }
  try {
    const { error } = await rpcWithWeeklySchemaRetry('create_tms_dispatcher_week_transfer', {
      p_week_start: weekStart,
      p_to_dispatcher_id: String(message?.toDispatcherId || '').trim() || null,
      p_amount: Number(message?.amount || 0),
      p_comment: String(message?.comment || '').trim(),
    })
    if (error) throw error
    sendWeeklySettlementOperationResult(requestId, true, 'dispatcher-transfer-create', 'Transfer został zapisany i oczekuje wyłącznie na potwierdzenie odbiorcy.')
    void refreshWeeklySettlementAfterMutation(weekStart)
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'dispatcher-transfer-create', error?.message || 'Nie udało się utworzyć transferu.')
  }
}

async function respondDispatcherWeekTransferFromTms(message) {
  const requestId = String(message?.requestId || '')
  const weekStart = normalizeWeekStart(message?.weekStart || weeklySettlementWeekStart)
  const status = String(message?.status || '').trim().toLowerCase()
  if (!hasRole('dispatcher')) {
    sendWeeklySettlementOperationResult(requestId, false, 'dispatcher-transfer-response', 'Transfer może potwierdzić wyłącznie spedytor będący jego odbiorcą.')
    return
  }
  try {
    const { error } = await rpcWithWeeklySchemaRetry('respond_tms_dispatcher_week_transfer', {
      p_transfer_id: String(message?.transferId || '').trim() || null,
      p_status: status,
    })
    if (error) throw error
    sendWeeklySettlementOperationResult(requestId, true, 'dispatcher-transfer-response', status === 'accepted' ? 'Transfer został zaakceptowany przez odbiorcę i od razu uwzględniony w wyniku.' : 'Transfer został odrzucony przez odbiorcę.')
    void refreshWeeklySettlementAfterMutation(weekStart)
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'dispatcher-transfer-response', error?.message || 'Nie udało się rozpatrzyć transferu.')
  }
}

async function deleteDispatcherWeekTransferFromTms(message) {
  const requestId = String(message?.requestId || '')
  const weekStart = normalizeWeekStart(message?.weekStart || weeklySettlementWeekStart)
  if (!hasRole('dispatcher')) {
    sendWeeklySettlementOperationResult(requestId, false, 'dispatcher-transfer-delete', 'Usunięcie transferu uzgadniają wyłącznie uczestniczący spedytorzy.')
    return
  }
  try {
    const { data, error } = await rpcWithWeeklySchemaRetry('request_or_confirm_tms_dispatcher_week_transfer_delete', {
      p_transfer_id: String(message?.transferId || '').trim() || null,
    })
    if (error) throw error
    const result = String(data || '')
    const feedback = result === 'deleted'
      ? 'Drugi spedytor potwierdził usunięcie. Transfer został usunięty i pozostaje w historii.'
      : result === 'waiting'
        ? 'Wniosek o usunięcie już oczekuje na potwierdzenie drugiego spedytora.'
        : result === 'already_deleted'
          ? 'Transfer był już wcześniej usunięty.'
          : 'Wniosek o usunięcie został zapisany. Transfer pozostaje aktywny do czasu potwierdzenia przez drugiego spedytora.'
    sendWeeklySettlementOperationResult(requestId, true, 'dispatcher-transfer-delete', feedback)
    void refreshWeeklySettlementAfterMutation(weekStart)
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'dispatcher-transfer-delete', error?.message || 'Nie udało się zgłosić lub potwierdzić usunięcia transferu.')
  }
}

async function approveDispatcherWeekTransferManagerFromTms(message) {
  const requestId = String(message?.requestId || '')
  // 3L.51: zgodność ze starszym iframe. Kierownik oddziału nie jest już
  // uczestnikiem zatwierdzania transferu; endpoint pozostaje no-op po stronie SQL.
  sendWeeklySettlementOperationResult(requestId, true, 'dispatcher-transfer-manager-response', 'Akceptacja kierownika oddziału nie jest już wymagana dla transferów spedytorów.')
}


async function setDriverWeekSettlementStatusFromTms(message) {
  const requestId = String(message?.requestId || '')
  const weekStart = normalizeWeekStart(message?.weekStart)
  const driverId = String(message?.driverId || '').trim()
  const status = String(message?.status || '').trim()
  if (!hasRole('accounting', 'admin')) {
    sendWeeklySettlementOperationResult(requestId, false, 'week-settlement-status-update', 'Status rozliczenia tygodnia mogą zmieniać tylko Rozliczenia lub Administrator.')
    return
  }
  try {
    const { error } = await rpcWithWeeklySchemaRetry('set_tms_driver_week_settlement_status', {
      p_week_start: weekStart,
      p_driver_id: driverId || null,
      p_status: status,
    })
    if (error) throw error
    sendWeeklySettlementOperationResult(requestId, true, 'week-settlement-status-update', `Status rozliczenia tygodnia zmieniono na „${status}”.`)
    void refreshWeeklySettlementAfterMutation(weekStart)
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'week-settlement-status-update', error?.message || 'Nie udało się zmienić statusu rozliczenia tygodnia.')
  }
}

function isMissingWorkflowSchemaError(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  return code === 'PGRST205'
    || /Could not find the table ['"]?public\.tms_(client_assignment_requests|relation_transfer_requests)['"]? in the schema cache/i.test(message)
}

async function loadWorkflowTable(table, columns) {
  const run = () => supabase
    .from(table)
    .select(columns)
    .order('created_at', { ascending: false })
    .limit(500)

  let result = await run()
  if (result.error && isMissingWorkflowSchemaError(result.error)) {
    // Po migracji PostgREST może przez moment pracować na starym cache schematu.
    await new Promise((resolve) => setTimeout(resolve, 700))
    result = await run()
  }
  return result
}

async function loadWorkflowData() {
  if (!currentProfile) return { clientAssignments: [], relationTransfers: [] }

  const [clientResult, relationResult] = await Promise.all([
    loadWorkflowTable(
      'tms_client_assignment_requests',
      'id,branch_id,client_ref,client_name,requested_dispatcher_id,requested_dispatcher_name,requested_by,requested_by_name,status,decision_comment,created_at,responded_at,responded_by',
    ),
    loadWorkflowTable(
      'tms_relation_transfer_requests',
      'id,branch_id,relation_ref,relation_label,from_dispatcher_id,from_dispatcher_name,to_dispatcher_id,to_dispatcher_name,comment,status,created_at,responded_at',
    ),
  ])

  const missingSchema = [clientResult.error, relationResult.error].some(isMissingWorkflowSchemaError)
  if (missingSchema) {
    workflowSchemaAvailable = false
    console.warn('Workflow 3L.31 nie jest jeszcze dostępny w Supabase. Uruchom migrację 024_workflow_schema_repair.sql i odśwież stronę.')
    return { clientAssignments: [], relationTransfers: [] }
  }

  if (clientResult.error) throw new Error(`Nie udało się pobrać akceptacji klientów: ${clientResult.error.message}`)
  if (relationResult.error) throw new Error(`Nie udało się pobrać transferów relacji: ${relationResult.error.message}`)

  workflowSchemaAvailable = true
  let clientAssignments = clientResult.data || []
  let relationTransfers = relationResult.data || []
  if (hasRole('branch_manager')) {
    clientAssignments = clientAssignments.filter((row) => String(row?.branch_id || '') === currentBranchId())
    relationTransfers = relationTransfers.filter((row) => String(row?.branch_id || '') === currentBranchId())
  } else if (hasRole('dispatcher')) {
    const userId = currentActorId()
    clientAssignments = clientAssignments.filter((row) => [row?.requested_by, row?.requested_dispatcher_id].some((id) => String(id || '') === userId))
    relationTransfers = relationTransfers.filter((row) => [row?.from_dispatcher_id, row?.to_dispatcher_id].some((id) => String(id || '') === userId))
  }

  return {
    clientAssignments: clientAssignments.map((row) => ({
      id: row.id, branchId: row.branch_id || '', clientRef: row.client_ref || '', clientName: row.client_name || '',
      requestedDispatcherId: row.requested_dispatcher_id || '', requestedDispatcherName: row.requested_dispatcher_name || '',
      requestedBy: row.requested_by || '', requestedByName: row.requested_by_name || '', status: row.status || 'pending',
      decisionComment: row.decision_comment || '', createdAt: row.created_at || '', respondedAt: row.responded_at || '', respondedBy: row.responded_by || '',
    })),
    relationTransfers: relationTransfers.map((row) => ({
      id: row.id, branchId: row.branch_id || '', relationRef: row.relation_ref || '', relationLabel: row.relation_label || '',
      fromDispatcherId: row.from_dispatcher_id || '', fromDispatcherName: row.from_dispatcher_name || '',
      toDispatcherId: row.to_dispatcher_id || '', toDispatcherName: row.to_dispatcher_name || '', comment: row.comment || '',
      status: row.status || 'pending', createdAt: row.created_at || '', respondedAt: row.responded_at || '',
    })),
  }
}
async function syncWorkflowToTms() {
  const data = await loadWorkflowData()
  activeWorkflowMessage = { type: 'top-dragon-workflow-data', ...data }
  activeTmsFrame?.contentWindow?.postMessage(activeWorkflowMessage, window.location.origin)
}

function scheduleWorkflowReload(delay = 100) {
  if (workflowReloadTimer) clearTimeout(workflowReloadTimer)
  workflowReloadTimer = setTimeout(() => {
    workflowReloadTimer = null
    syncWorkflowToTms().catch((error) => console.error('Nie udało się odświeżyć workflow:', error))
  }, Math.max(0, Number(delay) || 0))
}

function subscribeWorkflow() {
  if (workflowChannel) { supabase.removeChannel(workflowChannel); workflowChannel = null }
  if (!currentProfile || workflowSchemaAvailable === false) return
  workflowChannel = supabase
    .channel(`tms-workflow-${currentActorId() || 'user'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_client_assignment_requests' }, () => scheduleWorkflowReload(70))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_relation_transfer_requests' }, () => scheduleWorkflowReload(70))
    .subscribe()
}

function sendWorkflowResult(requestId, ok, action, message) {
  activeTmsFrame?.contentWindow?.postMessage({
    type: 'top-dragon-workflow-operation-result', requestId: String(requestId || ''), ok: Boolean(ok), action: String(action || ''), message: String(message || ''),
  }, window.location.origin)
}

async function createClientAssignmentRequestFromTms(message) {
  const requestId = String(message?.requestId || '')
  if (!hasRole('dispatcher')) {
    sendWorkflowResult(requestId, false, 'client-assignment-create', 'Wniosek o opiekuna klienta może utworzyć wyłącznie spedytor.')
    return
  }
  try {
    const args = {
      p_client_ref: String(message?.clientRef || '').trim(),
      p_to_dispatcher_id: String(message?.toDispatcherId || '').trim() || null,
    }
    let { error } = await supabase.rpc('request_tms_client_assignment', args)
    // Nowy klient jest zapisywany centralnie chwilę przed utworzeniem wniosku.
    // Jeżeli realtime/upsert jeszcze nie zdążył, wykonujemy jeden bezpieczny retry.
    if (error && /nie znaleziono aktywnego klienta/i.test(String(error?.message || ''))) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      ;({ error } = await supabase.rpc('request_tms_client_assignment', args))
    }
    if (error) throw error
    await Promise.all([syncWorkflowToTms(), syncCentralClientsToTms()])
    sendWorkflowResult(requestId, true, 'client-assignment-create', 'Przypisanie zostało wysłane do akceptacji kierownika oddziału.')
  } catch (error) {
    sendWorkflowResult(requestId, false, 'client-assignment-create', error?.message || 'Nie udało się wysłać przypisania do akceptacji.')
  }
}

async function respondClientAssignmentFromTms(message) {
  const requestId = String(message?.requestId || '')
  const status = String(message?.status || '').trim().toLowerCase()
  if (!hasRole('branch_manager', 'admin')) {
    sendWorkflowResult(requestId, false, 'client-assignment-response', 'Przypisanie klienta może zatwierdzić kierownik oddziału lub administrator.')
    return
  }
  try {
    const assignmentRequestId = String(message?.assignmentRequestId || '').trim()
    if (hasRole('branch_manager')) {
      const { data: requestRow, error: requestError } = await supabase
        .from('tms_client_assignment_requests')
        .select('branch_id')
        .eq('id', assignmentRequestId)
        .maybeSingle()
      if (requestError) throw requestError
      if (String(requestRow?.branch_id || '') !== currentBranchId()) {
        throw new Error('Kierownik może rozpatrywać wyłącznie wnioski swojego oddziału.')
      }
    }
    const { error } = await supabase.rpc('respond_tms_client_assignment', {
      p_request_id: assignmentRequestId || null,
      p_status: status,
      p_comment: String(message?.comment || '').trim(),
    })
    if (error) throw error
    await Promise.all([syncWorkflowToTms(), syncCentralClientsToTms()])
    sendWorkflowResult(requestId, true, 'client-assignment-response', status === 'accepted' ? 'Przypisanie klienta zostało zatwierdzone.' : 'Przypisanie klienta zostało odrzucone.')
  } catch (error) {
    sendWorkflowResult(requestId, false, 'client-assignment-response', error?.message || 'Nie udało się rozpatrzyć przypisania.')
  }
}

async function createRelationTransferRequestFromTms(message) {
  const requestId = String(message?.requestId || '')
  if (!hasRole('dispatcher')) {
    sendWorkflowResult(requestId, false, 'relation-transfer-create', 'Transfer relacji może rozpocząć wyłącznie spedytor prowadzący relację.')
    return
  }
  try {
    const { error } = await supabase.rpc('request_tms_relation_transfer', {
      p_relation_ref: String(message?.relationRef || '').trim(),
      p_to_dispatcher_id: String(message?.toDispatcherId || '').trim() || null,
      p_comment: String(message?.comment || '').trim(),
    })
    if (error) throw error
    await Promise.all([syncWorkflowToTms(), syncCentralRelationsToTms()])
    sendWorkflowResult(requestId, true, 'relation-transfer-create', 'Relacja została wysłana do akceptacji odbiorcy.')
  } catch (error) {
    sendWorkflowResult(requestId, false, 'relation-transfer-create', error?.message || 'Nie udało się przekazać relacji.')
  }
}

async function respondRelationTransferFromTms(message) {
  const requestId = String(message?.requestId || '')
  const status = String(message?.status || '').trim().toLowerCase()
  if (!hasRole('dispatcher')) {
    sendWorkflowResult(requestId, false, 'relation-transfer-response', 'Transfer relacji może potwierdzić wyłącznie spedytor będący odbiorcą.')
    return
  }
  try {
    const { error } = await supabase.rpc('respond_tms_relation_transfer', {
      p_request_id: String(message?.transferRequestId || '').trim() || null,
      p_status: status,
      p_assignment_id: status === 'accepted' ? (String(message?.assignmentId || '').trim() || null) : null,
    })
    if (error) throw error
    await Promise.all([syncWorkflowToTms(), syncCentralRelationsToTms(), syncFleetDataToTms()])
    sendWorkflowResult(requestId, true, 'relation-transfer-response', status === 'accepted' ? 'Transfer relacji został zaakceptowany.' : 'Transfer relacji został odrzucony.')
  } catch (error) {
    sendWorkflowResult(requestId, false, 'relation-transfer-response', error?.message || 'Nie udało się rozpatrzyć transferu relacji.')
  }
}

async function handleTruckRoutingRequestFromTms(message) {
  const requestId = String(message?.requestId || '')

  const sendResult = (ok, data = {}, errorMessage = '') => {
    activeTmsFrame?.contentWindow?.postMessage({
      type: 'top-dragon-truck-routing-result',
      requestId,
      ok: Boolean(ok),
      data: ok ? data : null,
      message: String(errorMessage || data?.message || ''),
    }, window.location.origin)
  }

  try {
    if (!hasRole('dispatcher', 'branch_manager', 'admin')) {
      throw new Error('Wyznaczanie tras operacyjnych nie jest dostępne dla tej roli.')
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const token = sessionData?.session?.access_token
    if (!token) throw new Error('Sesja użytkownika wygasła. Zaloguj się ponownie.')

    const payload = message?.payload && typeof message.payload === 'object' ? message.payload : {}
    const response = await fetch('/api/truck-routing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        mode: String(message?.mode || ''),
        ...payload,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.message || `Routing ciężarowy zwrócił HTTP ${response.status}.`)
    }
    sendResult(true, data)
  } catch (error) {
    sendResult(false, {}, error?.message || 'Nie udało się wyznaczyć trasy ciężarowej.')
  }
}

async function handleAiAnalyzerRequestFromTms(message) {
  const requestId = String(message?.requestId || '')
  const kind = String(message?.kind || '').trim().toLowerCase()

  const sendResult = (ok, data = {}, errorMessage = '') => {
    activeTmsFrame?.contentWindow?.postMessage({
      type: 'top-dragon-ai-analyzer-result',
      requestId,
      ok: Boolean(ok),
      data: ok ? data : null,
      message: String(errorMessage || data?.message || ''),
    }, window.location.origin)
  }

  try {
    if (kind === 'admin-import' && !isActualAdmin()) {
      throw new Error('Import administracyjny AI jest dostępny wyłącznie dla administratora.')
    }
    if (['document', 'pdf', 'text'].includes(kind) && !hasRole('dispatcher', 'admin')) {
      throw new Error('Analiza zleceń AI jest dostępna wyłącznie dla spedytora.')
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const token = sessionData?.session?.access_token
    if (!token) throw new Error('Sesja użytkownika wygasła. Zaloguj się ponownie.')

    const payload = message?.payload && typeof message.payload === 'object' ? message.payload : {}
    let response

    if (kind === 'document' || kind === 'pdf') {
      const file = payload.file
      if (!(file instanceof Blob)) throw new Error('Nie przekazano prawidłowego pliku zlecenia.')
      const fileName = String(payload.fileName || file.name || 'zlecenie.pdf')
      response = await fetch('/api/import-order-document', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type || 'application/pdf',
          'X-File-Name': encodeURIComponent(fileName),
          'X-Reference-Date': String(payload.referenceDate || ''),
        },
        body: file,
      })
    } else if (kind === 'text') {
      response = await fetch('/api/import-text-orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: String(payload.text || ''),
          date: String(payload.date || ''),
        }),
      })
    } else if (kind === 'admin-import') {
      response = await fetch('/api/import-ai-data', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: String(payload.kind || ''),
          sourceText: String(payload.sourceText || ''),
          sourceName: String(payload.sourceName || ''),
          referenceDate: String(payload.referenceDate || ''),
        }),
      })
    } else {
      throw new Error('Nieobsługiwany typ analizy AI.')
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.message || `Analizator AI zwrócił HTTP ${response.status}.`)
    }
    sendResult(true, data)
  } catch (error) {
    sendResult(false, {}, error?.message || 'Nie udało się wykonać analizy AI.')
  }
}


async function loadCompanyDispatcherStatisticsFromTms(message) {
  const requestId = String(message?.requestId || '')
  const from = String(message?.from || '').slice(0, 10)
  const to = String(message?.to || '').slice(0, 10)
  const send = (ok, rows = [], errorMessage = '') => {
    activeTmsFrame?.contentWindow?.postMessage({
      type: 'top-dragon-company-dispatcher-stats-data',
      requestId,
      ok: Boolean(ok),
      from,
      to,
      rows,
      error: String(errorMessage || ''),
    }, window.location.origin)
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    send(false, [], 'Nieprawidłowy zakres dat statystyk.')
    return
  }

  try {
    const { data, error } = await supabase.rpc('get_tms_dispatcher_statistics', {
      p_from: from,
      p_to: to,
    })
    if (error) throw error
    let scopedRows = data || []
    if (hasRole('dispatcher')) {
      scopedRows = scopedRows.filter((row) => String(row?.dispatcher_id || '') === currentActorId())
    } else if (hasRole('branch_manager')) {
      const branchName = currentActorBranchName()
      scopedRows = scopedRows.filter((row) => {
        const rowBranchId = String(row?.branch_id || '').trim()
        if (rowBranchId) return rowBranchId === currentBranchId()
        return branchName && String(row?.branch_name || '').trim() === branchName
      })
    }
    send(true, scopedRows.map((row) => ({
      dispatcherId: String(row.dispatcher_id || ''),
      dispatcherName: String(row.dispatcher_name || ''),
      branchName: String(row.branch_name || ''),
      uiColor: String(row.ui_color || '#E2E8F0'),
      relationCount: Number(row.relation_count || 0),
      profit: Number(row.profit || 0),
      carrierCost: Number(row.carrier_cost || 0),
      loadedKm: Number(row.loaded_km || 0),
      emptyKm: Number(row.empty_km || 0),
      totalKm: Number(row.total_km || 0),
      emptyPercent: Number(row.empty_percent || 0),
      avgRatePerKm: Number(row.avg_rate_per_km || 0),
      avgProfitPerRoute: Number(row.avg_profit_per_route || 0),
      verificationCount: Number(row.verification_count || 0),
      profitPerLoadedKm: Number(row.profit_per_loaded_km || 0),
      loadedToEmptyRatio: Number(row.loaded_to_empty_ratio || 0),
      lowRateCount: Number(row.low_rate_count || 0),
    })))
  } catch (error) {
    send(false, [], error?.message || 'Nie udało się pobrać statystyk wszystkich spedytorów.')
  }
}

function renderAdminPreviewBar() {
  if (!isActualAdmin()) return ''
  return `
    <section id="admin-role-preview" style="display:grid;grid-template-columns:minmax(250px,1fr) auto auto auto;align-items:center;gap:12px;padding:14px 18px;margin:0 0 16px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;box-shadow:0 2px 8px rgba(15,23,42,.08);">
      <div style="display:flex;align-items:center;min-height:44px;"><strong>Podgląd funkcji kategorii</strong></div>
      <label style="display:flex;align-items:center;gap:10px;min-height:44px;font-size:12px;line-height:1;font-weight:800;text-transform:uppercase;color:#64748b;">Kategoria
        <select id="admin-preview-role" style="box-sizing:border-box;min-width:274px;height:44px;margin:0;padding:0 38px 0 14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font:inherit;font-size:13px;font-weight:700;text-transform:none;box-shadow:0 1px 2px rgba(15,23,42,.04);cursor:pointer;">
          <option value="admin" ${!adminPreview ? 'selected' : ''}>Administrator</option>
          <option value="accounting" ${adminPreview?.role === 'accounting' ? 'selected' : ''}>Rozliczenia</option>
          <option value="dispatcher" ${adminPreview?.role === 'dispatcher' ? 'selected' : ''}>Spedytor</option>
          <option value="branch_manager" ${adminPreview?.role === 'branch_manager' ? 'selected' : ''}>Kierownik oddziału</option>
        </select>
      </label>
      <button id="admin-preview-apply" type="button" class="primary compact-primary" style="box-sizing:border-box;height:44px;min-height:44px;margin:0;padding:0 22px;align-self:center;">Pokaż funkcje</button>
      ${adminPreview ? '<button id="admin-preview-clear" type="button" class="secondary" style="box-sizing:border-box;height:44px;min-height:44px;margin:0;align-self:center;">Wróć do Administratora</button>' : ''}
    </section>
    <style>@media(max-width:900px){#admin-role-preview{grid-template-columns:1fr!important}#admin-role-preview label{justify-content:space-between}#admin-preview-role{min-width:0!important;flex:1}}</style>
  `
}

function buildTmsAuthMessage(user = currentUser, profile = currentProfile) {
  const role = String(adminPreview?.role || profile?.role || '')
  const previewActive = Boolean(adminPreview)
  const userName = profile?.display_name || user?.email || 'Administrator'
  const branchName = firstRelated(profile?.branch)?.name || profile?.branch_name || ''
  const previewLogin = normalizedTmsLogin({
    role,
    display_name: previewActive ? `PODGLĄD ${roleLabel(role)}` : userName,
  })
  return {
    type: 'top-dragon-auth',
    user: {
      id: user?.id || '',
      email: user?.email || '',
      displayName: previewActive ? `Podgląd funkcji: ${roleLabel(role)}` : userName,
      login: previewLogin,
      role,
      supabaseRole: role,
      actualSupabaseRole: profile?.role || '',
      permissionPreview: previewActive,
      actualUserId: user?.id || '',
      branchId: profile?.branch_id || '',
      uiColor: profile?.role === 'admin' ? '#EF4444' : (profile?.ui_color || '#E2E8F0'),
      branch: role === 'accounting' ? 'Wszystkie oddziały' : (previewActive ? 'Podgląd kategorii' : branchName),
    },
  }
}

function refreshAdminPreviewBar() {
  const currentBar = document.querySelector('#admin-role-preview')
  if (!currentBar) return
  currentBar.outerHTML = renderAdminPreviewBar()
  wireAdminPreviewControls()
}

async function applyAdminCategoryPreview(role) {
  adminPreview = role === 'admin' ? null : { role }
  activeAuthMessage = buildTmsAuthMessage()
  if (!activeTmsFrame?.contentWindow) {
    await renderDashboard(currentUser)
    window.scrollTo({ top: 0, behavior: 'auto' })
    return
  }
  activeTmsFrame?.contentWindow?.postMessage(activeAuthMessage, window.location.origin)
  refreshAdminPreviewBar()
  window.scrollTo({ top: 0, behavior: 'auto' })
}

function wireAdminPreviewControls() {
  if (!isActualAdmin()) return
  const roleSelect = document.querySelector('#admin-preview-role')
  document.querySelector('#admin-preview-apply')?.addEventListener('click', () => {
    const role = String(roleSelect?.value || 'admin')
    applyAdminCategoryPreview(role)
  })
  document.querySelector('#admin-preview-clear')?.addEventListener('click', () => {
    applyAdminCategoryPreview('admin')
  })
}

function showDashboardInlineMessage(message, type = 'info') {
  const box = document.querySelector('#admin-role-preview')
  if (!box) return
  let feedback = box.querySelector('.admin-preview-feedback')
  if (!feedback) {
    feedback = document.createElement('span')
    feedback.className = 'admin-preview-feedback'
    box.appendChild(feedback)
  }
  feedback.textContent = message
  feedback.style.color = type === 'error' ? '#b91c1c' : '#475569'
}

async function renderDashboard(user) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name, role, active, branch_id, ui_color, branch:branches(name)')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Nie udało się pobrać profilu użytkownika: ${error.message}`)
  }

  if (!profile?.active) {
    await supabase.auth.signOut({ scope: 'local' })
    renderLogin('Konto nie zostało jeszcze aktywowane przez administratora.')
    return
  }

  currentUser = user
  currentProfile = profile
  if (auditedSessionUserId !== String(user.id || '')) {
    auditedSessionUserId = String(user.id || '')
    writeCurrentUserAudit('Logowanie', 'session', user.id || '', `Rola: ${roleLabel(profile.role)}`)
  }

  app.innerHTML = `
    <main class="workspace">
      <div id="tms-loading" class="tms-loading" aria-live="polite">
        <img src="/top-dragon-logo.jpg" alt="Top Dragon" />
        <span>Uruchamianie panelu…</span>
      </div>
      <iframe
        id="tms-frame"
        class="tms-frame is-loading"
          src="/tms.html?embedded=1&build=request-workflow-v111-compact-shell-ai-status"
        title="Top Dragon TMS"
      ></iframe>
    </main>
  `

  const frame = document.querySelector('#tms-frame')
  activeTmsFrame = frame
  activeAuthMessage = buildTmsAuthMessage(user, profile)

  const sendIdentityToTms = () => {
    activeTmsFrame?.contentWindow?.postMessage(activeAuthMessage, window.location.origin)
  }

  frame?.addEventListener('load', sendIdentityToTms)
  sendIdentityToTms()

  syncUserDirectoryToTms().catch((error) => {
    console.error('Nie udało się zsynchronizować użytkowników z TMS:', error)
  })

  syncFleetDataToTms().catch((error) => {
    console.error('Nie udało się zsynchronizować floty z TMS:', error)
  })
  subscribeFleetRealtime()

  syncCentralRelationsToTms().catch((error) => {
    console.error('Nie udało się zsynchronizować relacji z TMS:', error)
  })
  subscribeCentralRelations()

  syncCentralClientsToTms().catch((error) => {
    console.error('Nie udało się zsynchronizować klientów z TMS:', error)
  })
  subscribeCentralClients()

  syncCentralLoadQueueToTms().catch((error) => {
    console.error('Nie udało się zsynchronizować kolejki ładunków z TMS:', error)
  })
  subscribeCentralLoadQueue()

  syncCentralLoadQueueChatToTms().catch((error) => {
    console.error('Nie udało się zsynchronizować czatu relacji z TMS:', error)
  })
  subscribeCentralLoadQueueChat()

  if (loadQueueHousekeepingTimer) clearInterval(loadQueueHousekeepingTimer)
  loadQueueHousekeepingTimer = setInterval(() => {
    syncCentralLoadQueueToTms().catch((error) => {
      console.warn('Nie udało się wykonać okresowego porządkowania Wolnych ładunków:', error)
    })
  }, 60000)

  syncCentralLoadRequestsToTms().catch((error) => {
    console.error('Nie udało się zsynchronizować zapytań o ładunek z TMS:', error)
  })
  subscribeCentralLoadRequests()
  subscribeWeeklySettlement()

  syncWorkflowToTms()
    .then(() => subscribeWorkflow())
    .catch((error) => {
      console.error('Nie udało się zsynchronizować akceptacji i transferów z TMS:', error)
    })

  if (currentProfile.role === 'admin') {
    syncCentralAuditToTms().catch((error) => {
      console.error('Nie udało się zsynchronizować historii operacji z TMS:', error)
    })
    subscribeCentralAudit()
  } else {
    activeAuditMessage = null
    subscribeCentralAudit()
  }
}

async function routeSession(session) {
  if (!session?.user) {
    renderLogin()
    return
  }

  if (needsOnboarding(session.user)) {
    renderSetPassword(session.user)
    return
  }

  await renderDashboard(session.user)
}

async function bootstrap() {
  if (!app) throw new Error('Brak elementu #app w pliku index.html.')

  window.addEventListener('message', async (event) => {
    if (event.origin !== window.location.origin) return
    if (!activeTmsFrame?.contentWindow || event.source !== activeTmsFrame.contentWindow) return

    if (event.data?.type === 'top-dragon-ready') {
      activeTmsFrame?.contentWindow?.postMessage(activeAuthMessage, window.location.origin)
      if (activeUserDirectoryMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeUserDirectoryMessage, window.location.origin)
      }
      if (activeFleetMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeFleetMessage, window.location.origin)
      }
      if (activeRelationsMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeRelationsMessage, window.location.origin)
      }
      if (activeClientsMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeClientsMessage, window.location.origin)
      }
      if (activeLoadQueueMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeLoadQueueMessage, window.location.origin)
      }
      if (activeLoadQueueChatMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeLoadQueueChatMessage, window.location.origin)
      }
      if (activeLoadRequestsMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeLoadRequestsMessage, window.location.origin)
      }
      if (activeAuditMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeAuditMessage, window.location.origin)
      }
      if (activeWeeklySettlementMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeWeeklySettlementMessage, window.location.origin)
      }
      if (activeWorkflowMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeWorkflowMessage, window.location.origin)
      }
      return
    }

    if (event.data?.type === 'top-dragon-auth-applied') {
      document.querySelector('#tms-frame')?.classList.remove('is-loading')
      document.querySelector('#tms-loading')?.remove()
      if (openAdminDataTransferAfterAuth && isActualAdmin()) {
        openAdminDataTransferAfterAuth = false
        activeTmsFrame?.contentWindow?.postMessage({ type: 'top-dragon-open-admin-data-transfer' }, window.location.origin)
      }
      return
    }

    if (event.data?.type === 'top-dragon-truck-routing-request') {
      await handleTruckRoutingRequestFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-ai-analyzer-request') {
      await handleAiAnalyzerRequestFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-open-admin') {
      if (currentProfile?.role === 'admin') {
        await renderAdminPanel()
      }
      return
    }

    if (event.data?.type === 'top-dragon-fleet-create') {
      await createFleetSetFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-fleet-update') {
      await updateFleetSetFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-fleet-delete') {
      await deleteFleetSetFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-carrier-rate-set') {
      await setCarrierRateFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-fleet-visibility') {
      await setFleetVisibilityFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-fleet-reassign') {
      await reassignFleetSetFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-driver-row-color') {
      await setDriverRowColorFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-fleet-excel-import') {
      await importFleetExcelFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-fleet-refresh') {
      try {
        await syncFleetDataToTms()
      } catch (error) {
        sendFleetOperationResult(event.data?.requestId, false, 'refresh', error?.message || 'Nie udało się odświeżyć floty.')
      }
      return
    }

    if (event.data?.type === 'top-dragon-relations-request') {
      try {
        await syncCentralRelationsToTms()
      } catch (error) {
        sendRelationOperationResult(event.data?.requestId, false, 'load', '', '', error?.message || 'Nie udało się pobrać relacji.')
      }
      return
    }

    if (event.data?.type === 'top-dragon-relations-archive-export-request') {
      await exportCentralRelationsArchiveToTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-relation-upsert') {
      await upsertCentralRelationFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-relation-accounting-update') {
      await updateCentralRelationAccountingFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-relation-archive') {
      await archiveCentralRelationFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-clients-request') {
      try {
        await syncCentralClientsToTms()
      } catch (error) {
        sendClientOperationResult(event.data?.requestId, false, 'load', '', '', error?.message || 'Nie udało się pobrać klientów.')
      }
      return
    }

    if (event.data?.type === 'top-dragon-client-upsert') {
      await upsertCentralClientFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-client-bulk-upsert') {
      await bulkUpsertCentralClientsFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-client-archive') {
      await archiveCentralClientFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-load-queue-request') {
      try {
        await syncCentralLoadQueueToTms()
      } catch (error) {
        sendLoadQueueOperationResult(event.data?.requestId, false, 'load', '', '', '', error?.message || 'Nie udało się pobrać kolejki ładunków.')
      }
      return
    }

    if (event.data?.type === 'top-dragon-load-queue-upsert') {
      await upsertCentralLoadQueueFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-load-queue-archive') {
      await archiveCentralLoadQueueFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-load-queue-chat-request') {
      try {
        await syncCentralLoadQueueChatToTms()
      } catch (error) {
        sendLoadQueueChatOperationResult(event.data?.requestId, false, 'load', error?.message || 'Nie udało się pobrać czatu relacji.')
      }
      return
    }

    if (event.data?.type === 'top-dragon-load-queue-chat-send') {
      await createLoadQueueChatMessageFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-load-queue-chat-read') {
      await markLoadQueueChatReadFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-load-requests-request') {
      try {
        await syncCentralLoadRequestsToTms()
      } catch (error) {
        sendLoadRequestOperationResult(event.data?.requestId, false, '', '', error?.message || 'Nie udało się pobrać zapytań o ładunek.')
      }
      return
    }

    if (event.data?.type === 'top-dragon-load-request-upsert') {
      await upsertCentralLoadRequestFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-weekly-settlement-request') {
      try {
        weeklySettlementWeekStart = normalizeWeekStart(event.data?.weekStart)
        await syncWeeklySettlementToTms(weeklySettlementWeekStart)
      } catch (error) {
        sendWeeklySettlementOperationResult(event.data?.requestId, false, 'load', error?.message || 'Nie udało się pobrać tygodniowego podsumowania.')
      }
      return
    }

    if (event.data?.type === 'top-dragon-carrier-week-adjustment-create') {
      await createCarrierWeekAdjustmentFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-carrier-week-adjustment-delete') {
      await deleteCarrierWeekAdjustmentFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-dispatcher-week-transfer-create') {
      await createDispatcherWeekTransferFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-dispatcher-week-transfer-response') {
      await respondDispatcherWeekTransferFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-dispatcher-week-transfer-delete' || event.data?.type === 'top-dragon-dispatcher-week-transfer-cancel') {
      await deleteDispatcherWeekTransferFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-dispatcher-week-transfer-manager-response') {
      await approveDispatcherWeekTransferManagerFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-week-settlement-status-update') {
      await setDriverWeekSettlementStatusFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-board-weekly-settlement-request') {
      try { await syncBoardWeeklySettlementsToTms(event.data) }
      catch (error) { sendWeeklySettlementOperationResult(event.data?.requestId, false, 'board-load', error?.message || 'Nie udało się pobrać rozliczeń do planu.') }
      return
    }


    if (event.data?.type === 'top-dragon-workflow-request') {
      try { await syncWorkflowToTms() }
      catch (error) { sendWorkflowResult(event.data?.requestId, false, 'load', error?.message || 'Nie udało się pobrać akceptacji i transferów.') }
      return
    }

    if (event.data?.type === 'top-dragon-client-assignment-request-create') {
      await createClientAssignmentRequestFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-client-assignment-response') {
      await respondClientAssignmentFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-relation-transfer-create') {
      await createRelationTransferRequestFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-relation-transfer-response') {
      await respondRelationTransferFromTms(event.data)
      return
    }


    if (event.data?.type === 'top-dragon-company-dispatcher-stats-request') {
      await loadCompanyDispatcherStatisticsFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-audit-request') {
      if (currentProfile?.role === 'admin') {
        try {
          await syncCentralAuditToTms()
        } catch (error) {
          console.error('Nie udało się pobrać historii operacji:', error)
        }
      }
      return
    }

    if (event.data?.type === 'top-dragon-audit-record') {
      await writeCentralAuditFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-relation-usage-register') {
      await registerRelationUsageFromTms(event.data)
      return
    }

    if (event.data?.type === 'top-dragon-request-signout') {
      await writeCurrentUserAudit('Wylogowanie', 'session', currentUser?.id || '', '')
      auditedSessionUserId = ''
      await supabase.auth.signOut({ scope: 'local' })
    }
  })

  supabase.auth.onAuthStateChange((event, session) => {
    // bootstrap() sam pobiera bieżącą sesję przez getSession(), więc nie
    // renderujemy panel drugi raz dla INITIAL_SESSION. TOKEN_REFRESHED oraz
    // powtarzające się SIGNED_IN dla tego samego użytkownika nie mogą
    // odtwarzać iframe TMS, ponieważ wyczyściłoby to bieżący stan planu.
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return

    const sameUserSessionIsActive = Boolean(
      event === 'SIGNED_IN' &&
      session?.user?.id &&
      currentUser?.id === session.user.id
    )

    if (sameUserSessionIsActive) return

    Promise.resolve(routeSession(session)).catch(renderFatalError)
  })

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  await routeSession(data.session)
}

bootstrap().catch(renderFatalError)
