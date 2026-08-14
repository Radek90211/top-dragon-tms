import './styles.css'
import { supabase } from './lib/supabase.js'

const app = document.querySelector('#app')
let activeTmsFrame = null
let activeAuthMessage = null
let activeUserDirectoryMessage = null
let activeFleetMessage = null
let activeRelationsMessage = null
let relationsChannel = null
let relationsReloadTimer = null
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
  if (relationsReloadTimer) {
    clearTimeout(relationsReloadTimer)
    relationsReloadTimer = null
  }
  if (relationsChannel) {
    supabase.removeChannel(relationsChannel)
    relationsChannel = null
  }

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
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, branch_id, active, branch:branches(name)')
    .eq('active', true)
    .order('display_name', { ascending: true })

  if (error) {
    throw new Error(`Nie udało się pobrać listy użytkowników: ${error.message}`)
  }

  return (data || []).map((profile) => ({
    id: profile.id,
    displayName: profile.display_name,
    role: profile.role,
    branchId: profile.branch_id || '',
    branch: profile.branch?.name || '',
    login: normalizedTmsLogin(profile),
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

  if (currentProfile.role !== 'admin') {
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

  try {
    const { error } = await supabase.rpc('upsert_tms_relation', {
      p_branch_id: branchId,
      p_relation: relation,
    })
    if (error) throw error

    sendRelationOperationResult(requestId, true, 'upsert', relationId, branchId, 'Relacja została zapisana w Supabase.')
    await syncCentralRelationsToTms()
  } catch (error) {
    sendRelationOperationResult(requestId, false, 'upsert', relationId, branchId, error?.message || 'Nie udało się zapisać relacji.')
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

async function renderDashboard(user) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name, role, active, branch_id, branch:branches(name)')
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
        src="/tms.html?embedded=1&build=central-relations-v7"
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
      branch: branchName === 'Brak oddziału' ? '' : branchName,
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
      return
    }

    if (event.data?.type === 'top-dragon-auth-applied') {
      document.querySelector('#tms-frame')?.classList.remove('is-loading')
      document.querySelector('#tms-loading')?.remove()
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

    if (event.data?.type === 'top-dragon-fleet-delete') {
      await deleteFleetSetFromTms(event.data)
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

    if (event.data?.type === 'top-dragon-relation-archive') {
      await archiveCentralRelationFromTms(event.data)
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
