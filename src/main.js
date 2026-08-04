import './styles.css'
import { supabase } from './lib/supabase.js'

const app = document.querySelector('#app')
let activeTmsFrame = null
let activeAuthMessage = null

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
      <div id="tms-loading" class="tms-loading" aria-live="polite">
        <img src="/top-dragon-logo.jpg" alt="Top Dragon" />
        <span>Uruchamianie panelu…</span>
      </div>
      <iframe
        id="tms-frame"
        class="tms-frame is-loading"
        src="/tms.html?embedded=1"
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
      branch: branchName === 'Brak oddziału' ? '' : branchName,
    },
  }

  const sendIdentityToTms = () => {
    activeTmsFrame?.contentWindow?.postMessage(activeAuthMessage, window.location.origin)
  }

  frame?.addEventListener('load', sendIdentityToTms)
  sendIdentityToTms()
}

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
    await supabase.auth.signOut()
  }
})

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) renderDashboard(session.user)
  else {
    activeTmsFrame = null
    activeAuthMessage = null
    renderLogin()
  }
})

const { data: { session } } = await supabase.auth.getSession()
if (session?.user) renderDashboard(session.user)
else renderLogin()
