import './styles.css'
import { supabase } from './lib/supabase.js'

const app = document.querySelector('#app')
let activeTmsFrame = null
let activeAuthMessage = null
let activeUserDirectoryMessage = null
let activeFleetMessage = null
let activeRelationsMessage = null
let activeClientsMessage = null
let activeLoadQueueMessage = null
let activeLoadRequestsMessage = null
let activeAuditMessage = null
let activeWeeklySettlementMessage = null
let relationsChannel = null
let relationsReloadTimer = null
let clientsChannel = null
let clientsReloadTimer = null
let loadQueueChannel = null
let loadQueueReloadTimer = null
let loadRequestsChannel = null
let loadRequestsReloadTimer = null
let auditChannel = null
let auditReloadTimer = null
let weeklySettlementChannel = null
let weeklySettlementReloadTimer = null
let weeklySettlementWeekStart = ''
let currentUser = null
let currentProfile = null

const ROLE_LABELS = {
  dispatcher: 'Spedytor',
  branch_manager: 'Kierownik oddziału',
  accounting: 'Rozliczenia',
  admin: 'Administrator',
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
  activeTmsFrame = null
  activeAuthMessage = null
  activeUserDirectoryMessage = null
  activeFleetMessage = null
  activeRelationsMessage = null
  activeClientsMessage = null
  activeLoadQueueMessage = null
  activeLoadRequestsMessage = null
  activeAuditMessage = null
  activeWeeklySettlementMessage = null
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
  if (loadQueueChannel) {
    supabase.removeChannel(loadQueueChannel)
    loadQueueChannel = null
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

async function loadAdminData() {
  const [branchesResult, usersResult] = await Promise.all([
    adminApi('/api/admin/branches'),
    adminApi('/api/admin/users'),
  ])

  return {
    branches: branchesResult.branches || [],
    users: usersResult.users || [],
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
    '#branch-create-form button, .branch-rename, .branch-toggle, .branch-delete, #user-invite-form button, .user-save, #admin-refresh'
  ).forEach((button) => {
    button.disabled = busy || button.dataset.locked === 'true'
  })
}

function renderAdminPanelFromCache(message = '', messageType = 'success') {
  if (!adminCache) return

  const branches = adminCache.branches || []
  const users = adminCache.users || []
  const activeBranches = branches.filter((branch) => branch.active)

  app.innerHTML = `
    <main class="admin-shell">
      <header class="admin-header">
        <div>
          <div class="admin-eyebrow">Top Dragon TMS</div>
          <h1>Administracja</h1>
          <p class="muted">Zalogowany: ${escapeHtml(currentProfile.display_name || currentUser.email)}</p>
        </div>
        <div class="admin-header-actions">
          <button id="admin-refresh" class="secondary">Odśwież dane</button>
          <button id="back-to-tms" class="secondary">← Wróć do TMS</button>
        </div>
      </header>

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
            <h2>Użytkownicy</h2>
            <p class="muted">Zmiana statusu na nieaktywny zachowuje użytkownika i jego historię.</p>
          </div>
          <span class="count-pill">${users.length}</span>
        </div>

        <div class="user-list">
          ${users.length ? users.map((item) => {
            const lockedAdmin = item.role === 'admin'
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
                  <span class="user-color-field"><input class="user-ui-color" type="color" value="${escapeHtml(item.ui_color || '#E2E8F0')}" ${lockedAdmin ? 'disabled' : ''} /><span>${escapeHtml(item.ui_color || '#E2E8F0')}</span></span>
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

  document.querySelector('#back-to-tms')?.addEventListener('click', () => renderDashboard(currentUser))

  document.querySelector('#admin-refresh')?.addEventListener('click', async () => {
    if (adminPanelBusy) return
    setAdminBusy(true)
    try {
      adminCache = await loadAdminData()
      renderAdminPanelFromCache('Dane zostały odświeżone.')
    } catch (error) {
      showAdminMessage(error.message, 'error')
      setAdminBusy(false)
    }
  })

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
      updateAdminCacheUser(result.user)
      renderAdminPanelFromCache(result.message || 'Zaproszenie zostało wysłane.')
    } catch (error) {
      showAdminMessage(error.message, 'error')
      setAdminBusy(false)
      if (button) button.textContent = 'Wyślij zaproszenie'
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

  if (adminCache && !forceReload) {
    renderAdminPanelFromCache(message, messageType)
    return
  }

  app.innerHTML = `
    <main class="admin-shell">
      <header class="admin-header">
        <div>
          <div class="admin-eyebrow">Top Dragon TMS</div>
          <h1>Administracja</h1>
          <p class="muted">Użytkownicy i oddziały</p>
        </div>
        <button id="back-to-tms" class="secondary">← Wróć do TMS</button>
      </header>
      <section class="admin-loading">Pobieranie danych…</section>
    </main>
  `

  document.querySelector('#back-to-tms')?.addEventListener('click', () => renderDashboard(currentUser))

  try {
    adminCache = await loadAdminData()
    renderAdminPanelFromCache(message, messageType)
  } catch (error) {
    app.innerHTML = `
      <main class="admin-shell">
        <header class="admin-header">
          <div>
            <div class="admin-eyebrow">Top Dragon TMS</div>
            <h1>Administracja</h1>
          </div>
          <button id="back-to-tms" class="secondary">← Wróć do TMS</button>
        </header>
        <div class="error">${escapeHtml(error.message)}</div>
      </main>
    `
    document.querySelector('#back-to-tms')?.addEventListener('click', () => renderDashboard(currentUser))
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
    uiColor: profile.ui_color || '#E2E8F0',
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
  const { data: assignments, error: assignmentsError } = await supabase
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
  if (currentProfile?.role === 'dispatcher' && currentUser?.id) {
    const { data: preferences, error: preferencesError } = await supabase
      .from('driver_row_preferences')
      .select('driver_id, color')
      .eq('user_id', currentUser.id)

    if (preferencesError) {
      throw new Error(`Nie udało się pobrać prywatnych kolorów kierowców: ${preferencesError.message}`)
    }
    preferenceRows = preferences || []
  }
  const preferenceByDriver = new Map(preferenceRows.map((item) => [String(item.driver_id || ''), String(item.color || '')]))

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
      carrier: carrier ? { id: carrier.id, name: carrier.name || '' } : null,
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


async function loadCentralRelations() {
  if (!currentProfile) return []

  let query = supabase
    .from('tms_relations')
    .select('branch_id, relation_ref, payload, updated_at')
    .eq('active', true)
    .order('updated_at', { ascending: true })

  if (!['admin', 'accounting'].includes(String(currentProfile.role || ''))) {
    if (!currentProfile.branch_id) return []
    query = query.eq('branch_id', currentProfile.branch_id)
  }

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

  const channelName = `tms-relations-${currentProfile.branch_id || 'all'}-${currentUser?.id || 'user'}`
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
    currentProfile?.role === 'admin'
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!relationId || !branchId || !relation || typeof relation !== 'object') {
    sendRelationOperationResult(requestId, false, 'upsert', relationId, branchId, 'Brak identyfikatora relacji lub oddziału.')
    return
  }

  if (currentProfile?.role === 'dispatcher') {
    const actor = String(currentProfile?.display_name || '').trim()
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
    ['admin', 'accounting'].includes(String(currentProfile?.role || ''))
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!relationId || !branchId || !patch) {
    sendRelationOperationResult(requestId, false, 'accounting', relationId, branchId, 'Brak danych statusu rozliczeń.')
    return
  }

  if (!['accounting', 'admin'].includes(String(currentProfile?.role || ''))) {
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
    currentProfile?.role === 'admin'
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!relationId || !branchId) {
    sendRelationOperationResult(requestId, false, 'archive', relationId, branchId, 'Brak identyfikatora relacji lub oddziału.')
    return
  }

  try {
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

  let query = supabase
    .from('tms_clients_central')
    .select('branch_id, client_ref, payload, updated_at')
    .eq('active', true)
    .order('updated_at', { ascending: true })

  if (!['admin', 'accounting'].includes(String(currentProfile.role || ''))) {
    if (!currentProfile.branch_id) return []
    query = query.eq('branch_id', currentProfile.branch_id)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Nie udało się pobrać klientów: ${error.message}`)
  }

  return (data || [])
    .filter((row) => row?.payload && row?.client_ref)
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

  const channelName = `tms-clients-${currentProfile.branch_id || 'all'}-${currentUser?.id || 'user'}`
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
    branchId: String(branchId || ''),
    message: String(message || ''),
  }, window.location.origin)
}

async function upsertCentralClientFromTms(message) {
  const requestId = String(message?.requestId || '')
  const client = message?.client
  const clientId = String(client?.id || '').trim()
  const branchId = String(
    currentProfile?.role === 'admin'
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!clientId || !branchId || !client || typeof client !== 'object') {
    sendClientOperationResult(requestId, false, 'upsert', clientId, branchId, 'Brak identyfikatora klienta lub oddziału.')
    return
  }

  try {
    const { error } = await supabase.rpc('upsert_tms_client', {
      p_branch_id: branchId,
      p_client: client,
    })
    if (error) throw error

    sendClientOperationResult(requestId, true, 'upsert', clientId, branchId, 'Klient został zapisany w Supabase.')
    await syncCentralClientsToTms()
  } catch (error) {
    sendClientOperationResult(requestId, false, 'upsert', clientId, branchId, error?.message || 'Nie udało się zapisać klienta.')
  }
}

async function archiveCentralClientFromTms(message) {
  const requestId = String(message?.requestId || '')
  const clientId = String(message?.clientId || '').trim()
  const branchId = String(
    currentProfile?.role === 'admin'
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!clientId || !branchId) {
    sendClientOperationResult(requestId, false, 'archive', clientId, branchId, 'Brak identyfikatora klienta lub oddziału.')
    return
  }

  try {
    const { error } = await supabase.rpc('archive_tms_client', {
      p_branch_id: branchId,
      p_client_ref: clientId,
    })
    if (error) throw error

    sendClientOperationResult(requestId, true, 'archive', clientId, branchId, 'Klient został usunięty z aktywnej bazy.')
    await syncCentralClientsToTms()
  } catch (error) {
    sendClientOperationResult(requestId, false, 'archive', clientId, branchId, error?.message || 'Nie udało się usunąć klienta z aktywnej bazy.')
  }
}


async function loadCentralLoadQueue() {
  if (!currentProfile) return []

  const { data, error } = await supabase
    .from('tms_load_queue')
    .select('branch_id, queue_type, load_ref, payload, updated_at')
    .eq('active', true)
    .order('updated_at', { ascending: true })

  if (error) {
    throw new Error(`Nie udało się pobrać kolejki ładunków: ${error.message}`)
  }

  return (data || [])
    .filter((row) => row?.payload && row?.load_ref && ['future', 'proposed'].includes(row?.queue_type))
    .map((row) => ({
      id: String(row.load_ref || ''),
      branchId: String(row.branch_id || ''),
      queueType: String(row.queue_type || ''),
      payload: row.payload,
      updatedAt: String(row.updated_at || ''),
    }))
}

async function syncCentralLoadQueueToTms() {
  const rows = await loadCentralLoadQueue()
  activeLoadQueueMessage = {
    type: 'top-dragon-load-queue-data',
    rows,
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

  const channelName = `tms-load-queue-${currentProfile.branch_id || 'all'}-${currentUser?.id || 'user'}`
  loadQueueChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tms_load_queue' },
      () => scheduleCentralLoadQueueReload(90)
    )
    .subscribe()
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
    currentProfile?.role === 'admin'
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!load || typeof load !== 'object' || !loadId || !branchId || !['future', 'proposed'].includes(queueType)) {
    sendLoadQueueOperationResult(requestId, false, 'upsert', queueType, loadId, branchId, 'Brak identyfikatora ładunku, oddziału lub typu kolejki.')
    return
  }

  const requestedBranchId = String(message?.branchId || '').trim()
  if (currentProfile?.role !== 'admin' && requestedBranchId && requestedBranchId !== String(currentProfile?.branch_id || '').trim()) {
    sendLoadQueueOperationResult(requestId, false, 'upsert', queueType, loadId, branchId, 'Nie możesz zmieniać wpisu należącego do innego oddziału.')
    return
  }

  if (currentProfile?.role === 'dispatcher') {
    const actor = String(currentProfile?.display_name || '').trim().toLocaleLowerCase('pl')
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
    currentProfile?.role === 'admin'
      ? (message?.branchId || currentProfile?.branch_id || '')
      : (currentProfile?.branch_id || '')
  ).trim()

  if (!loadId || !branchId || !['future', 'proposed'].includes(queueType)) {
    sendLoadQueueOperationResult(requestId, false, 'archive', queueType, loadId, branchId, 'Brak identyfikatora ładunku, oddziału lub typu kolejki.')
    return
  }

  const requestedBranchId = String(message?.branchId || '').trim()
  if (currentProfile?.role !== 'admin' && requestedBranchId && requestedBranchId !== String(currentProfile?.branch_id || '').trim()) {
    sendLoadQueueOperationResult(requestId, false, 'archive', queueType, loadId, branchId, 'Nie możesz usuwać wpisu należącego do innego oddziału.')
    return
  }

  try {
    const { error } = await supabase.rpc('archive_tms_load_queue', {
      p_branch_id: branchId,
      p_queue_type: queueType,
      p_load_ref: loadId,
    })
    if (error) throw error

    sendLoadQueueOperationResult(requestId, true, 'archive', queueType, loadId, branchId, 'Wpis został usunięty z aktywnej kolejki.')
    await syncCentralLoadQueueToTms()
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

  const channelName = `tms-load-requests-${currentUser?.id || 'user'}`
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

  const { data, error } = await supabase
    .from('operation_audit')
    .select('id, actor_id, actor_name, actor_role, branch_id, branch_name, action, entity_type, entity_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(2500)

  if (error) {
    throw new Error(`Nie udało się pobrać historii operacji: ${error.message}`)
  }

  return (data || []).map((row) => ({
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

  try {
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

  try {
    const { error } = await supabase.rpc('create_fleet_set', {
      p_carrier_name: String(payload.carrierName || '').trim(),
      p_driver_name: String(payload.driverName || '').trim(),
      p_assigned_dispatcher_id: payload.assignedDispatcherId || null,
      p_branch_id: payload.branchId || null,
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
    sendFleetOperationResult(requestId, true, 'create', 'Zestaw został zapisany w Supabase i jest wspólny dla użytkowników oddziału.')
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

  try {
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

async function deleteFleetSetFromTms(message) {
  const requestId = message?.requestId || ''
  const assignmentId = String(message?.assignmentId || '').trim()

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
    sendFleetOperationResult(requestId, true, 'delete', 'Zestaw został usunięty z centralnej floty.')
  } catch (error) {
    sendFleetOperationResult(requestId, false, 'delete', error?.message || 'Nie udało się usunąć zestawu.')
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

  try {
    const { error } = await supabase.rpc('set_fleet_assignment_hidden', {
      p_assignment_id: assignmentId,
      p_hidden: hidden,
    })
    if (error) throw error

    await syncFleetDataToTms()
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

async function setDriverRowColorFromTms(message) {
  const requestId = String(message?.requestId || '')
  const driverId = String(message?.driverId || '').trim()
  const color = String(message?.color || '').trim().toLowerCase()
  const allowedColors = new Set(['', 'yellow', 'green', 'blue', 'pink', 'purple', 'orange', 'gray'])

  if (currentProfile?.role !== 'dispatcher' || !currentUser?.id) {
    sendFleetOperationResult(requestId, false, 'color', 'Kolor wiersza może ustawić wyłącznie prowadzący spedytor.')
    return
  }
  if (!driverId || !allowedColors.has(color)) {
    sendFleetOperationResult(requestId, false, 'color', 'Nieprawidłowy kierowca lub kolor.')
    return
  }

  try {
    const { data: ownedAssignments, error: ownershipError } = await supabase
      .from('fleet_assignments')
      .select('id')
      .eq('driver_id', driverId)
      .eq('assigned_dispatcher_id', currentUser.id)
      .eq('active', true)
      .limit(1)
    if (ownershipError) throw ownershipError
    if (!ownedAssignments?.length) throw new Error('Możesz oznaczać kolorem tylko kierowców, których prowadzisz.')

    if (!color) {
      const { error } = await supabase
        .from('driver_row_preferences')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('driver_id', driverId)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('driver_row_preferences')
        .upsert({
          user_id: currentUser.id,
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
  const rows = Array.isArray(message?.rows) ? message.rows : []

  if (!currentProfile || !['admin', 'branch_manager', 'dispatcher'].includes(currentProfile.role)) {
    sendFleetOperationResult(requestId, false, 'import', 'Brak uprawnień do importu floty.')
    return
  }
  if (!rows.length) {
    sendFleetOperationResult(requestId, false, 'import', 'Arkusz nie zawiera żadnych danych floty.')
    return
  }
  if (rows.length > 2000) {
    sendFleetOperationResult(requestId, false, 'import', 'Jednorazowo można zaimportować maksymalnie 2000 wierszy floty.')
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
  const date = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  const isoDay = date.getDay() || 7
  date.setDate(date.getDate() - isoDay + 1)
  return date.toISOString().slice(0, 10)
}

async function loadWeeklySettlementData(weekStart) {
  const normalizedWeek = normalizeWeekStart(weekStart)
  if (!normalizedWeek) throw new Error('Nieprawidłowy tydzień rozliczeniowy.')

  const [{ data: adjustments, error: adjustmentsError }, { data: transfers, error: transfersError }] = await Promise.all([
    supabase
      .from('tms_carrier_week_adjustments')
      .select('id,week_start,branch_id,carrier_id,carrier_name,amount,comment,created_by,created_at,active')
      .eq('week_start', normalizedWeek)
      .eq('active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('tms_dispatcher_week_transfers')
      .select('id,week_start,from_dispatcher_id,to_dispatcher_id,from_branch_id,to_branch_id,amount,comment,status,created_at,responded_at')
      .eq('week_start', normalizedWeek)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true }),
  ])

  if (adjustmentsError) throw new Error(`Nie udało się pobrać wyrównań przewoźników: ${adjustmentsError.message}`)
  if (transfersError) throw new Error(`Nie udało się pobrać przelewów spedytorów: ${transfersError.message}`)

  return {
    weekStart: normalizedWeek,
    carrierAdjustments: (adjustments || []).map((row) => ({
      id: String(row.id || ''),
      weekStart: String(row.week_start || normalizedWeek),
      branchId: String(row.branch_id || ''),
      carrierId: String(row.carrier_id || ''),
      carrierName: String(row.carrier_name || ''),
      amount: Number(row.amount || 0),
      comment: String(row.comment || ''),
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at || ''),
    })),
    transfers: (transfers || []).map((row) => ({
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
    .channel(`tms-weekly-settlement-${currentUser?.id || 'user'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_carrier_week_adjustments' }, () => scheduleWeeklySettlementReload(70))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_dispatcher_week_transfers' }, () => scheduleWeeklySettlementReload(70))
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

async function createCarrierWeekAdjustmentFromTms(message) {
  const requestId = String(message?.requestId || '')
  try {
    const { error } = await supabase.rpc('create_tms_carrier_week_adjustment', {
      p_week_start: normalizeWeekStart(message?.weekStart),
      p_carrier_id: String(message?.carrierId || '').trim() || null,
      p_amount: Number(message?.amount || 0),
      p_comment: String(message?.comment || '').trim(),
    })
    if (error) throw error
    weeklySettlementWeekStart = normalizeWeekStart(message?.weekStart)
    await syncWeeklySettlementToTms(weeklySettlementWeekStart)
    sendWeeklySettlementOperationResult(requestId, true, 'carrier-adjustment-create', 'Wyrównanie przewoźnika zostało zapisane.')
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'carrier-adjustment-create', error?.message || 'Nie udało się zapisać wyrównania przewoźnika.')
  }
}

async function deleteCarrierWeekAdjustmentFromTms(message) {
  const requestId = String(message?.requestId || '')
  try {
    const { error } = await supabase.rpc('archive_tms_carrier_week_adjustment', {
      p_adjustment_id: String(message?.adjustmentId || '').trim() || null,
    })
    if (error) throw error
    await syncWeeklySettlementToTms(weeklySettlementWeekStart)
    sendWeeklySettlementOperationResult(requestId, true, 'carrier-adjustment-delete', 'Wyrównanie zostało usunięte z aktywnego podsumowania.')
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'carrier-adjustment-delete', error?.message || 'Nie udało się usunąć wyrównania.')
  }
}

async function createDispatcherWeekTransferFromTms(message) {
  const requestId = String(message?.requestId || '')
  try {
    const { error } = await supabase.rpc('create_tms_dispatcher_week_transfer', {
      p_week_start: normalizeWeekStart(message?.weekStart),
      p_to_dispatcher_id: String(message?.toDispatcherId || '').trim() || null,
      p_amount: Number(message?.amount || 0),
      p_comment: String(message?.comment || '').trim(),
    })
    if (error) throw error
    weeklySettlementWeekStart = normalizeWeekStart(message?.weekStart)
    await syncWeeklySettlementToTms(weeklySettlementWeekStart)
    sendWeeklySettlementOperationResult(requestId, true, 'dispatcher-transfer-create', 'Przelew został wysłany do akceptacji odbiorcy.')
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'dispatcher-transfer-create', error?.message || 'Nie udało się utworzyć przelewu.')
  }
}

async function respondDispatcherWeekTransferFromTms(message) {
  const requestId = String(message?.requestId || '')
  const status = String(message?.status || '').trim().toLowerCase()
  try {
    const { error } = await supabase.rpc('respond_tms_dispatcher_week_transfer', {
      p_transfer_id: String(message?.transferId || '').trim() || null,
      p_status: status,
    })
    if (error) throw error
    await syncWeeklySettlementToTms(weeklySettlementWeekStart)
    sendWeeklySettlementOperationResult(requestId, true, 'dispatcher-transfer-response', status === 'accepted' ? 'Przelew został zaakceptowany.' : 'Przelew został odrzucony.')
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'dispatcher-transfer-response', error?.message || 'Nie udało się rozpatrzyć przelewu.')
  }
}

async function cancelDispatcherWeekTransferFromTms(message) {
  const requestId = String(message?.requestId || '')
  try {
    const { error } = await supabase.rpc('cancel_tms_dispatcher_week_transfer', {
      p_transfer_id: String(message?.transferId || '').trim() || null,
    })
    if (error) throw error
    await syncWeeklySettlementToTms(weeklySettlementWeekStart)
    sendWeeklySettlementOperationResult(requestId, true, 'dispatcher-transfer-cancel', 'Oczekujący przelew został anulowany.')
  } catch (error) {
    sendWeeklySettlementOperationResult(requestId, false, 'dispatcher-transfer-cancel', error?.message || 'Nie udało się anulować przelewu.')
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
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const token = sessionData?.session?.access_token
    if (!token) throw new Error('Sesja użytkownika wygasła. Zaloguj się ponownie.')

    const payload = message?.payload && typeof message.payload === 'object' ? message.payload : {}
    let response

    if (kind === 'pdf') {
      const file = payload.file
      if (!(file instanceof Blob)) throw new Error('Nie przekazano prawidłowego pliku PDF.')
      const fileName = String(payload.fileName || file.name || 'zlecenie.pdf')
      response = await fetch('/api/import-pdf', {
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
    send(true, (data || []).map((row) => ({
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

  const userName = profile.display_name || user.email
  const branchName = profile.branch?.name || 'Brak oddziału'

  app.innerHTML = `
    <main class="workspace">
      <div id="tms-loading" class="tms-loading" aria-live="polite">
        <img src="/top-dragon-logo.jpg" alt="Top Dragon" />
        <span>Uruchamianie panelu…</span>
      </div>
      <iframe
        id="tms-frame"
        class="tms-frame is-loading"
        src="/tms.html?embedded=1&build=request-workflow-v49-multi-load-date-cutoff-fix"
        title="Top Dragon TMS"
      ></iframe>
    </main>
  `

  const frame = document.querySelector('#tms-frame')
  activeTmsFrame = frame
  activeAuthMessage = {
    type: 'top-dragon-auth',
    user: {
      id: user.id,
      email: user.email || '',
      displayName: userName,
      role: profile.role,
      supabaseRole: profile.role,
      branchId: profile.branch_id || '',
      uiColor: profile.ui_color || '#E2E8F0',
      branch: profile.role === 'accounting'
        ? 'Wszystkie oddziały'
        : (branchName === 'Brak oddziału' ? '' : branchName),
    },
  }

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

  syncCentralLoadRequestsToTms().catch((error) => {
    console.error('Nie udało się zsynchronizować zapytań o ładunek z TMS:', error)
  })
  subscribeCentralLoadRequests()
  subscribeWeeklySettlement()

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
      if (activeLoadRequestsMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeLoadRequestsMessage, window.location.origin)
      }
      if (activeAuditMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeAuditMessage, window.location.origin)
      }
      if (activeWeeklySettlementMessage) {
        activeTmsFrame?.contentWindow?.postMessage(activeWeeklySettlementMessage, window.location.origin)
      }
      return
    }

    if (event.data?.type === 'top-dragon-auth-applied') {
      document.querySelector('#tms-frame')?.classList.remove('is-loading')
      document.querySelector('#tms-loading')?.remove()
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

    if (event.data?.type === 'top-dragon-fleet-visibility') {
      await setFleetVisibilityFromTms(event.data)
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

    if (event.data?.type === 'top-dragon-dispatcher-week-transfer-cancel') {
      await cancelDispatcherWeekTransferFromTms(event.data)
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
      await supabase.auth.signOut({ scope: 'local' })
    }
  })

  supabase.auth.onAuthStateChange((event, session) => {
    // bootstrap() sam pobiera bieżącą sesję przez getSession(), więc nie
    // renderujemy panel drugi raz dla INITIAL_SESSION. TOKEN_REFRESHED oraz
    // powtarzające się SIGNED_IN dla tego samego użytkownika nie mogą
    // odtwarzać iframe TMS, ponieważ wyczyściłoby to bieżący stan planu.
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return

    const sameUserDashboardIsActive = Boolean(
      event === 'SIGNED_IN' &&
      session?.user?.id &&
      currentUser?.id === session.user.id &&
      activeTmsFrame?.isConnected
    )

    if (sameUserDashboardIsActive) return

    Promise.resolve(routeSession(session)).catch(renderFatalError)
  })

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  await routeSession(data.session)
}

bootstrap().catch(renderFatalError)
