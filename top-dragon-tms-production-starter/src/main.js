import './styles.css'
import { supabase } from './lib/supabase.js'

const app = document.querySelector('#app')

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderLogin(message = '') {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <h1>Top Dragon TMS</h1>
        <p>Zaloguj się, aby przejść do systemu.</p>
        <form id="login-form">
          <label>E-mail
            <input id="email" type="email" autocomplete="username" required />
          </label>
          <label>Hasło
            <input id="password" type="password" autocomplete="current-password" required minlength="8" />
          </label>
          ${message ? `<div class="error">${escapeHtml(message)}</div>` : ''}
          <button class="primary" type="submit">Zaloguj</button>
        </form>
      </section>
    </main>
  `

  document.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const email = document.querySelector('#email').value.trim()
    const password = document.querySelector('#password').value
    const button = event.submitter
    button.disabled = true
    button.textContent = 'Logowanie…'

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) renderLogin('Nieprawidłowy e-mail lub hasło.')
  })
}

async function renderDashboard(user) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name, role, active, branch:branches(name)')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    app.innerHTML = '<main class="login-shell"><section class="login-card"><div class="error">Nie udało się pobrać profilu użytkownika.</div></section></main>'
    return
  }

  if (!profile?.active) {
    await supabase.auth.signOut()
    renderLogin('Konto nie zostało jeszcze aktywowane przez administratora.')
    return
  }

  const userName = profile.display_name || user.email
  const branchName = profile.branch?.name || 'Brak oddziału'

  app.innerHTML = `
    <main class="workspace">
      <header class="workspace-bar">
        <div class="workspace-brand">
          <strong>Top Dragon TMS</strong>
          <span>${escapeHtml(userName)} · ${escapeHtml(profile.role)} · ${escapeHtml(branchName)}</span>
        </div>
        <button id="logout" class="secondary" type="button">Wyloguj</button>
      </header>
      <iframe
        class="tms-frame"
        src="/tms.html"
        title="Top Dragon TMS"
      ></iframe>
    </main>
  `

  document.querySelector('#logout').addEventListener('click', async () => {
    await supabase.auth.signOut()
  })
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) renderDashboard(session.user)
  else renderLogin()
})

const { data: { session } } = await supabase.auth.getSession()
if (session?.user) renderDashboard(session.user)
else renderLogin()
