// Deployment boundary: this server entry point must also work in legacy partial uploads.
// The signal remains active while readJson consumes the response body.
function fetchAdminResponse(url, options = {}) {
  return fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(30000) })
}
const PRIMARY_ADMIN_EMAIL = 'radek90211@gmail.com'
const ROLES = new Set(['dispatcher', 'branch_manager', 'accounting', 'admin'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function env(name, fallback = '') {
  return String(process.env?.[name] || fallback || '').trim()
}

function supabaseUrl() {
  const candidates = [
    'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
    // Akceptujemy również zamienione miejscami wartości, aby panel nie budował
    // adresu typu "sb_publishable_…/auth/v1/user".
    'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].map((name) => env(name)).filter(Boolean)

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate)
      if (url.protocol === 'https:' && /\.supabase\.(co|in)$/i.test(url.hostname)) return url.origin
    } catch {}
  }
  return ''
}

function secretKey() {
  return [env('SUPABASE_SECRET_KEY'), env('SUPABASE_SERVICE_ROLE_KEY')]
    .find((value) => value && !/^(?:https?:\/\/|sb_publishable_)/i.test(value)) || ''
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function json(res, status, body) {
  res.status(status).json(body)
}

function errorMessage(value, fallback) {
  return String(value?.message || value?.msg || value?.error_description || value?.error || fallback)
}

async function readJson(response) {
  const text = await response.text()
  if (!text.trim() && response.status === 204) return null
  try { return JSON.parse(text) } catch { throw Object.assign(new Error('Serwer zwrócił nieprawidłowy JSON.'), {statusCode:502}) }
}

function serviceHeaders(extra = {}) {
  const key = secretKey()
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra }
}

async function authenticateAdmin(req) {
  const baseUrl = supabaseUrl()
  const key = secretKey()
  const token = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1] || ''
  if (!baseUrl || !key) throw Object.assign(new Error('Nieprawidłowa konfiguracja Supabase. Ustaw SUPABASE_URL jako adres https://…supabase.co, a SUPABASE_SECRET_KEY jako tajny klucz serwera.'), { statusCode: 503, code:'ADMIN_CONFIGURATION_MISSING' })
  if (!token) throw Object.assign(new Error('Brak tokenu sesji.'), { statusCode: 401 })

  const userResponse = await fetchAdminResponse(`${baseUrl}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  })
  const user = await readJson(userResponse)
  if (!userResponse.ok || !user?.id) throw Object.assign(new Error('Sesja wygasła lub jest nieprawidłowa.'), { statusCode: 401 })

  const profileResponse = await fetchAdminResponse(`${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,active&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  })
  const profiles = await readJson(profileResponse)
  const profile = Array.isArray(profiles) ? profiles[0] : null
  if (!profileResponse.ok || profile?.role !== 'admin' || profile?.active === false) {
    throw Object.assign(new Error('Panel użytkowników jest dostępny wyłącznie dla aktywnego administratora.'), { statusCode: 403 })
  }
  return { user, primary: normalizeEmail(user.email) === PRIMARY_ADMIN_EMAIL }
}

async function serviceRequest(path, options = {}) {
  const response = await fetchAdminResponse(`${supabaseUrl()}${path}`, {
    ...options,
    headers: serviceHeaders(options.headers || {}),
  })
  const data = await readJson(response)
  if (!response.ok) throw Object.assign(new Error(errorMessage(data, `Supabase zwrócił HTTP ${response.status}.`)), { statusCode: response.status })
  return data
}

async function authUser(userId) {
  return serviceRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`)
}

async function allAdminUsersV154() {
  const users=[];
  for(let page=1;;page++) {const data=await serviceRequest('/auth/v1/admin/users?page='+page+'&per_page=500');const rows=data?.users;if(!Array.isArray(rows))throw new Error('Nieprawidłowa lista kont.');users.push(...rows);if(rows.length===0)return {users};}
}
async function allProfilesV154() {
  const profiles=[];
  for(let offset=0;;) {const rows=await serviceRequest('/rest/v1/profiles?select=id,display_name,role,branch_id,ui_color,active,branch:branches(name)&order=id.asc&limit=500&offset='+offset);if(!Array.isArray(rows))throw new Error('Nieprawidłowa odpowiedź listy profili.');profiles.push(...rows);offset+=rows.length;if(rows.length===0)return profiles.sort((a,b)=>String(a.display_name||'').localeCompare(String(b.display_name||''),'pl'));}
}
async function listUsers() {
  const [profiles, authData] = await Promise.all([
    allProfilesV154(),
    allAdminUsersV154(),
  ])
  const emails = new Map((authData?.users || []).map(user => [String(user.id), String(user.email || '')]))
  return (Array.isArray(profiles) ? profiles : []).map(profile => ({
    ...profile,
    email: emails.get(String(profile.id)) || '',
  }))
}

function profilePayload(body, role) {
  const displayName = String(body?.displayName || '').trim()
  if (displayName.length < 2) throw Object.assign(new Error('Nazwa użytkownika musi mieć co najmniej 2 znaki.'), { statusCode: 400 })
  const branchId = String(body?.branchId || '').trim()
  if (branchId && !UUID_PATTERN.test(branchId)) throw Object.assign(new Error('Nieprawidłowy oddział.'), { statusCode: 400 })
  const uiColor = /^#[0-9a-f]{6}$/i.test(String(body?.uiColor || '')) ? String(body.uiColor).toUpperCase() : '#E2E8F0'
  return {
    display_name: displayName,
    role,
    branch_id: role === 'admin' ? null : (branchId || null),
    ui_color: role === 'admin' ? '#EF4444' : uiColor,
    ...(typeof body?.active === 'boolean' ? { active: body.active } : {}),
  }
}

function validateRole(body, actor) {
  const role = String(body?.role || '').trim()
  if (!ROLES.has(role)) throw Object.assign(new Error('Nieprawidłowa kategoria użytkownika.'), { statusCode: 400 })
  if (role === 'admin' && !actor.primary) {
    throw Object.assign(new Error(`Rolę Administratora może nadawać wyłącznie ${PRIMARY_ADMIN_EMAIL}.`), { statusCode: 403 })
  }
  return role
}

async function inviteUser(body, actor) {
  const role = validateRole(body, actor)
  const email = normalizeEmail(body?.email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Podaj prawidłowy adres e-mail.'), { statusCode: 400 })
  const payload = profilePayload(body, role)

  const invited = await serviceRequest('/auth/v1/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, data: { onboarding_required: true } }),
  })
  try {
    const rows = await serviceRequest('/rest/v1/profiles?on_conflict=id&select=id,display_name,role,branch_id,ui_color,active,branch:branches(name)', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id: invited.id, active: true, ...payload }),
    })
    return { ...(Array.isArray(rows) ? rows[0] : rows), email }
  } catch (error) {
    await fetchAdminResponse(`${supabaseUrl()}/auth/v1/admin/users/${encodeURIComponent(invited.id)}`, { method: 'DELETE', headers: serviceHeaders() }).catch(() => {})
    throw error
  }
}

async function updateUser(body, actor) {
  const userId = String(body?.userId || '').trim()
  if (!UUID_PATTERN.test(userId)) throw Object.assign(new Error('Nieprawidłowy użytkownik.'), { statusCode: 400 })
  const role = validateRole(body, actor)
  const [targetRows, targetAuth] = await Promise.all([
    serviceRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,role&limit=1`),
    authUser(userId),
  ])
  const target = Array.isArray(targetRows) ? targetRows[0] : null
  if (!target) throw Object.assign(new Error('Nie znaleziono użytkownika.'), { statusCode: 404 })
  if (target.role === 'admin' && role !== 'admin' && !actor.primary) {
    throw Object.assign(new Error(`Tylko ${PRIMARY_ADMIN_EMAIL} może odebrać rolę Administratora.`), { statusCode: 403 })
  }
  if (normalizeEmail(targetAuth?.email) === PRIMARY_ADMIN_EMAIL && (role !== 'admin' || body?.active === false)) {
    throw Object.assign(new Error('Głównego konta administratora nie można zdezaktywować ani zmienić jego kategorii.'), { statusCode: 403 })
  }

  const rows = await serviceRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,display_name,role,branch_id,ui_color,active,branch:branches(name)`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(profilePayload(body, role)),
  })
  const updated = Array.isArray(rows) ? rows[0] : rows
  if (!updated) throw Object.assign(new Error('Profil użytkownika nie został zaktualizowany.'), { statusCode: 404 })
  return { ...updated, email: String(targetAuth?.email || '') }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store')
  res.setHeader('X-Top-Dragon-Admin-Build','v156')
  if(!['GET','POST','PATCH'].includes(req.method)) {res.setHeader('Allow','GET, POST, PATCH');return json(res,405,{ok:false,message:'Niedozwolona metoda.'});}
  let phase='authenticate'
  try {
    const actor = await authenticateAdmin(req)
    if (req.method === 'GET') { phase='list-users';return json(res, 200, { ok: true, users: await listUsers() }); }
    if (req.method === 'POST') {
      phase='invite-user'
      const user = await inviteUser(req.body || {}, actor)
      return json(res, 201, { ok: true, user, message: roleMessage(user.role, 'zaproszony') })
    }
    if (req.method === 'PATCH') {
      phase='update-user'
      const user = await updateUser(req.body || {}, actor)
      return json(res, 200, { ok: true, user, message: roleMessage(user.role, 'zapisany') })
    }
    res.setHeader('Allow', 'GET, POST, PATCH')
    return json(res, 405, { ok: false, message: 'Niedozwolona metoda.' })
  } catch (error) {
    const timeout=['AbortError','TimeoutError'].includes(error?.name)
    const status = timeout?504:Number(error?.statusCode || 500)
    return json(res, status >= 400 && status < 600 ? status : 500, { ok:false, phase, code:timeout?'ADMIN_UPSTREAM_TIMEOUT':String(error?.code || 'ADMIN_API_ERROR'), message:timeout?'Supabase nie odpowiedziało w wymaganym czasie. Spróbuj ponownie.':errorMessage(error, 'Nie udało się wykonać operacji na użytkowniku.') })
  }
}

function roleMessage(role, action) {
  const label = role === 'admin' ? 'Administrator' : role === 'branch_manager' ? 'Kierownik oddziału' : role === 'accounting' ? 'Rozliczenia' : 'Spedytor'
  return `Użytkownik został ${action}. Kategoria: ${label}.`
}
