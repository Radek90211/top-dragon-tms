import './styles.css'
import { supabase } from './lib/supabase.js'

const app = document.querySelector('#app')
let activeTmsFrame = null
let activeAuthMessage = null
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

async function renderAdminPanel(message = '', messageType = 'success') {
  if (!currentUser || currentProfile?.role !== 'admin') {
    await renderDashboard(currentUser)
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
    const { branches, users } = await loadAdminData()
    const activeBranches = branches.filter((branch) => branch.active)

    app.innerHTML = `
      <main class="admin-shell">
        <header class="admin-header">
          <div>
            <div class="admin-eyebrow">Top Dragon TMS</div>
            <h1>Administracja</h1>
            <p class="muted">Zalogowany: ${escapeHtml(currentProfile.display_name || currentUser.email)}</p>
          </div>
          <button id="back-to-tms" class="secondary">← Wróć do TMS</button>
        </header>

        ${message ? `<div class="${messageType === 'error' ? 'error' : 'success'} admin-message">${escapeHtml(message)}</div>` : ''}

        <div class="admin-grid">
          <section class="admin-card">
            <div class="section-heading">
              <div>
                <h2>Oddziały</h2>
                <p class="muted">Twórz oddziały i zarządzaj ich aktywnością.</p>
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
                  <button type="button" class="primary user-save" ${lockedAdmin ? 'disabled' : ''}>Zapisz</button>
                </article>
              `
            }).join('') : '<p class="muted">Brak użytkowników.</p>'}
          </div>
        </section>
      </main>
    `

    document.querySelector('#back-to-tms')?.addEventListener('click', () => renderDashboard(currentUser))

    document.querySelector('#branch-create-form')?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const name = document.querySelector('#branch-name')?.value.trim() || ''
      try {
        await adminApi('/api/admin/branches', {
          method: 'POST',
          body: JSON.stringify({ name }),
        })
        await renderAdminPanel('Oddział został dodany.')
      } catch (error) {
        await renderAdminPanel(error.message, 'error')
      }
    })

    document.querySelectorAll('.admin-row').forEach((row) => {
      const id = row.dataset.branchId
      const branch = branches.find((item) => item.id === id)
      if (!branch) return

      row.querySelector('.branch-rename')?.addEventListener('click', async () => {
        const name = window.prompt('Nowa nazwa oddziału:', branch.name)
        if (!name || name.trim() === branch.name) return
        try {
          await adminApi('/api/admin/branches', {
            method: 'PATCH',
            body: JSON.stringify({ id, name: name.trim() }),
          })
          await renderAdminPanel('Nazwa oddziału została zmieniona.')
        } catch (error) {
          await renderAdminPanel(error.message, 'error')
        }
      })

      row.querySelector('.branch-toggle')?.addEventListener('click', async () => {
        const action = branch.active ? 'dezaktywować' : 'aktywować'
        if (!window.confirm(`Czy na pewno ${action} oddział „${branch.name}”?`)) return
        try {
          await adminApi('/api/admin/branches', {
            method: 'PATCH',
            body: JSON.stringify({ id, active: !branch.active }),
          })
          await renderAdminPanel(`Oddział został ${branch.active ? 'dezaktywowany' : 'aktywowany'}.`)
        } catch (error) {
          await renderAdminPanel(error.message, 'error')
        }
      })
    })

    document.querySelector('#user-invite-form')?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const button = event.submitter
      if (button) {
        button.disabled = true
        button.textContent = 'Wysyłanie…'
      }

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
        await renderAdminPanel(result.message || 'Zaproszenie zostało wysłane.')
      } catch (error) {
        await renderAdminPanel(error.message, 'error')
      }
    })

    document.querySelectorAll('.user-row').forEach((row) => {
      row.querySelector('.user-save')?.addEventListener('click', async () => {
        const userId = row.dataset.userId
        try {
          await adminApi('/api/admin/users', {
            method: 'PATCH',
            body: JSON.stringify({
              userId,
              displayName: row.querySelector('.user-display-name')?.value.trim(),
              role: row.querySelector('.user-role')?.value,
              branchId: row.querySelector('.user-branch')?.value,
              active: Boolean(row.querySelector('.user-active')?.checked),
            }),
          })
          await renderAdminPanel('Dane użytkownika zostały zapisane.')
        } catch (error) {
          await renderAdminPanel(error.message, 'error')
        }
      })
    })
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
      ${profile.role === 'admin' ? '<button id="open-admin" class="admin-launcher">Administracja</button>' : ''}
      <div id="tms-loading" class="tms-loading" aria-live="polite">
        <img src="/top-dragon-logo.jpg" alt="Top Dragon" />
        <span>Uruchamianie panelu…</span>
      </div>
      <iframe
        id="tms-frame"
        class="tms-frame is-loading"
        src="/tms.html?embedded=1&build=admin-panel-v1"
        title="Top Dragon TMS"
      ></iframe>
    </main>
  `

  document.querySelector('#open-admin')?.addEventListener('click', () => renderAdminPanel())

  const frame = document.querySelector('#tms-frame')
  activeTmsFrame = frame
  activeAuthMessage = {
    type: 'top-dragon-auth',
    user: {
      id: user.id,
      email: user.email || '',
      displayName: userName,
      role: profile.role,
      branchId: profile.branch_id || '',
      branch: branchName === 'Brak oddziału' ? '' : branchName,
    },
  }

  const sendIdentityToTms = () => {
    activeTmsFrame?.contentWindow?.postMessage(activeAuthMessage, window.location.origin)
  }

  frame?.addEventListener('load', sendIdentityToTms)
  sendIdentityToTms()
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
      return
    }

    if (event.data?.type === 'top-dragon-auth-applied') {
      document.querySelector('#tms-frame')?.classList.remove('is-loading')
      document.querySelector('#tms-loading')?.remove()
      return
    }

    if (event.data?.type === 'top-dragon-request-signout') {
      await supabase.auth.signOut({ scope: 'local' })
    }
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    Promise.resolve(routeSession(session)).catch(renderFatalError)
  })

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  await routeSession(data.session)
}

bootstrap().catch(renderFatalError)
