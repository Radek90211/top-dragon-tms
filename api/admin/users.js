const PRIMARY_ADMIN_EMAIL = 'radek90211@gmail.com'
const ROLES = new Set(['dispatcher', 'branch_manager', 'accounting', 'admin'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function env(name, fallback = '') {
  return String(process.env?.[name] || fallback || '').trim()
}

function supabaseUrl() {
  return env('SUPABASE_URL', env('VITE_SUPABASE_URL')).replace(/\/$/, '')
}

function secretKey() {
  return env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY'))
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
  return response.json().catch(() => ({}))
}

function serviceHeaders(extra = {}) {
  const key = secretKey()
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra }
}

async function authenticateAdmin(req) {
  const baseUrl = supabaseUrl()
  const key = secretKey()
  const token = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1] || ''
  if (!baseUrl || !key) throw Object.assign(new Error('Brak konfiguracji SUPABASE_URL lub SUPABASE_SECRET_KEY.'), { statusCode: 500 })
  if (!token) throw Object.assign(new Error('Brak tokenu sesji.'), { statusCode: 401 })

  const userResponse = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  })
  const user = await readJson(userResponse)
  if (!userResponse.ok || !user?.id) throw Object.assign(new Error('Sesja wygasła lub jest nieprawidłowa.'), { statusCode: 401 })

  const profileResponse = await fetch(`${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,active&limit=1`, {
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
  const response = await fetch(`${supabaseUrl()}${path}`, {
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

async function listUsers() {
  const [profiles, authData] = await Promise.all([
    serviceRequest('/rest/v1/profiles?select=id,display_name,role,branch_id,ui_color,active,branch:branches(name)&order=display_name.asc'),
    serviceRequest('/auth/v1/admin/users?page=1&per_page=1000'),
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
    await fetch(`${supabaseUrl()}/auth/v1/admin/users/${encodeURIComponent(invited.id)}`, { method: 'DELETE', headers: serviceHeaders() }).catch(() => {})
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
  try {
    const actor = await authenticateAdmin(req)
    if (req.method === 'GET') return json(res, 200, { ok: true, users: await listUsers() })
    if (req.method === 'POST') {
      const user = await inviteUser(req.body || {}, actor)
      return json(res, 201, { ok: true, user, message: roleMessage(user.role, 'zaproszony') })
    }
    if (req.method === 'PATCH') {
      const user = await updateUser(req.body || {}, actor)
      return json(res, 200, { ok: true, user, message: roleMessage(user.role, 'zapisany') })
    }
    res.setHeader('Allow', 'GET, POST, PATCH')
    return json(res, 405, { ok: false, message: 'Niedozwolona metoda.' })
  } catch (error) {
    const status = Number(error?.statusCode || 500)
    return json(res, status >= 400 && status < 600 ? status : 500, { ok: false, message: errorMessage(error, 'Nie udało się wykonać operacji na użytkowniku.') })
  }
}

function roleMessage(role, action) {
  const label = role === 'admin' ? 'Administrator' : role === 'branch_manager' ? 'Kierownik oddziału' : role === 'accounting' ? 'Rozliczenia' : 'Spedytor'
  return `Użytkownik został ${action}. Kategoria: ${label}.`
}
