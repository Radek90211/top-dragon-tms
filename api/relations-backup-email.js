import { fetchWithDeadlineV155 } from '../lib/top-dragon-http-v155.js'
import { gzipSync } from 'node:zlib'

const MAX_RELATIONS = 100000
const PAGE_SIZE = 1000
const MAX_RAW_ATTACHMENT_BYTES = 8 * 1024 * 1024

function env(name, fallback = '') {
  return String(process.env?.[name] || fallback || '').trim()
}

function firstValidSupabaseUrl() {
  for (const name of ['SUPABASE_URL','VITE_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL']) {
    const value = env(name)
    if (!value) continue
    try {
      const url = new URL(value)
      if (url.protocol === 'https:' && /\.supabase\.(co|in)$/i.test(url.hostname)) return url.origin
    } catch {}
  }
  return ''
}

function firstPublicSupabaseKey() {
  return ['SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_ANON_KEY','VITE_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY']
    .map(name => env(name)).find(value => value && !/^https?:\/\//i.test(value)) || ''
}

function serviceSupabaseKey() {
  return ['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY'].map(name => env(name)).find(Boolean) || ''
}

function bearer(req) {
  const value = String(req.headers?.authorization || '')
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : ''
}

function cronAuthorized(req) {
  const secret = env('CRON_SECRET')
  return Boolean(secret && bearer(req) && bearer(req) === secret)
}

function csvCell(value) {
  const text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value)
  return `"${String(typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
}

function relationCsv(rows) {
  const columns = [
    ['ID', row => row.relation_ref],
    ['Oddział ID', row => row.branch_id],
    ['Aktywna', row => row.active !== false ? 'TAK' : 'NIE'],
    ['Data', row => row.payload?.date],
    ['Godzina start', row => row.payload?.startHour],
    ['Data końca', row => row.payload?.endDate],
    ['Godzina końca', row => row.payload?.endHour],
    ['Spedytor', row => row.payload?.ownerDispatcher || row.payload?.createdBy],
    ['Kierowca ID', row => row.payload?.driverId],
    ['Klient', row => row.payload?.client],
    ['Załadunek', row => row.payload?.load],
    ['Adres załadunku', row => row.payload?.loadAddress],
    ['Drugi załadunek', row => row.payload?.secondLoad],
    ['Rozładunek', row => row.payload?.unload],
    ['Adres rozładunku', row => row.payload?.unloadAddress],
    ['Drugi rozładunek', row => row.payload?.secondUnload],
    ['Dolot km', row => row.payload?.approachKm],
    ['Kilometry', row => row.payload?.loadedKm],
    ['Baza km', row => row.payload?.baseKm],
    ['Stawka', row => row.payload?.rate],
    ['Waluta', row => row.payload?.orderCurrency || row.payload?.currency || 'PLN'],
    ['Koszt', row => row.payload?.cost],
    ['Uwagi', row => row.payload?.notes],
    ['Informacje dla kierowcy', row => row.payload?.driverNotes],
    ['Aktualizacja', row => row.updated_at],
    ['Pełny JSON', row => row.payload],
  ]
  const lines = [columns.map(([label]) => csvCell(label)).join(';')]
  rows.forEach(row => lines.push(columns.map(([, getter]) => csvCell(getter(row))).join(';')))
  return '\ufeff' + lines.join('\r\n')
}

async function authenticateAdmin(req, supabaseUrl, publicKey) {
  const token = bearer(req)
  if (!token) throw Object.assign(new Error('Brak aktywnej sesji administratora.'), { statusCode: 401 })
  const userResponse = await fetchWithDeadlineV155(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: `Bearer ${token}` } })
  const user = await userResponse.json().catch(() => ({}))
  if (!userResponse.ok || !user?.id) throw Object.assign(new Error('Sesja Supabase jest nieważna lub wygasła.'), { statusCode: 401 })
  const profileResponse = await fetchWithDeadlineV155(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,active&limit=1`, {
    headers: { apikey: publicKey, Authorization: `Bearer ${token}` },
  })
  const profiles = await profileResponse.json().catch(() => ([]))
  const profile = Array.isArray(profiles) ? profiles[0] : null
  if (!profileResponse.ok || !profile || profile.active === false || profile.role !== 'admin') {
    throw Object.assign(new Error('Kopię relacji e-mail może wysłać wyłącznie aktywny Administrator.'), { statusCode: 403 })
  }
  return { token, user }
}

async function loadRelations(supabaseUrl, publicKey, token) {
  const privileged = serviceSupabaseKey()
  const dataKey = privileged || publicKey
  const auth = privileged || token
  const rows = []
  let pageLengthV155 = 0;
  for (let offset = 0; offset <= MAX_RELATIONS; offset += pageLengthV155) {
    const response = await fetchWithDeadlineV155(`${supabaseUrl}/rest/v1/tms_relations?select=branch_id,relation_ref,payload,active,updated_at&order=branch_id.asc,relation_ref.asc&limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: { apikey: dataKey, Authorization: `Bearer ${auth}` },
    })
    let page
    try { page = await response.json() } catch { throw new Error("Nieprawidłowa odpowiedź Supabase. Kopia nie została wysłana.") }
    if (!response.ok || !Array.isArray(page)) throw new Error(`Nie udało się pobrać relacji z Supabase: ${page?.message || response.status}`)
    if (!page.length) return rows
    if (rows.length + page.length > MAX_RELATIONS) break
    rows.push(...page)
    pageLengthV155 = page.length
  }
  throw Object.assign(new Error(`Kopia przekroczyła bezpieczny limit ${MAX_RELATIONS} relacji. Zwiększ limit lub podziel eksport, aby nie wysłać niepełnego backupu.`), { statusCode: 413 })
}

function backupAttachment(filename, text) {
  const raw = Buffer.from(text, 'utf8')
  if (raw.length <= MAX_RAW_ATTACHMENT_BYTES) return { filename, content:raw.toString('base64') }
  return { filename:`${filename}.gz`, content:gzipSync(raw, { level:9 }).toString('base64') }
}


async function sendWithResend({ to, from, subject, html, attachments }) {
  const key = env('RESEND_API_KEY')
  if (!key) throw Object.assign(new Error('Brak RESEND_API_KEY. Dodaj klucz Resend w zmiennych środowiskowych Vercel.'), { statusCode: 503 })
  if (!from) throw Object.assign(new Error('Brak RELATIONS_BACKUP_FROM_EMAIL. Ustaw zweryfikowany adres nadawcy w Vercel.'), { statusCode: 503 })
  const response = await fetchWithDeadlineV155('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, attachments }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data?.message || `Resend zwrócił HTTP ${response.status}.`), { statusCode: 502 })
  return data
}

export default async function handler(req, res) {
  if (!['POST','GET'].includes(req.method)) {
    res.setHeader('Allow', 'POST, GET')
    return res.status(405).json({ ok:false, message:'Dozwolone są metody POST i GET.' })
  }
  try {
    const supabaseUrl = firstValidSupabaseUrl()
    const publicKey = firstPublicSupabaseKey()
    const privilegedKey = serviceSupabaseKey()
    if (!supabaseUrl) throw Object.assign(new Error('Brak konfiguracji adresu Supabase dla kopii relacji.'), { statusCode: 503 })

    let token = ''
    if (req.method === 'POST') {
      if (!publicKey) throw Object.assign(new Error('Brak publicznego klucza Supabase dla kopii relacji.'), { statusCode: 503 })
      const session = await authenticateAdmin(req, supabaseUrl, publicKey)
      token = session.token
    } else {
      if (!cronAuthorized(req)) throw Object.assign(new Error('Brak autoryzacji harmonogramu kopii relacji.'), { statusCode: 401 })
      if (!privilegedKey) throw Object.assign(new Error('Automatyczna kopia wymaga SUPABASE_SERVICE_ROLE_KEY lub SUPABASE_SECRET_KEY.'), { statusCode: 503 })
    }

    const dataKey = publicKey || privilegedKey
    const to = env('RELATIONS_BACKUP_TO_EMAIL').split(/[;,]/).map(value => value.trim()).filter(Boolean).slice(0, 3)
    const from = env('RELATIONS_BACKUP_FROM_EMAIL')
    if (!to.length) throw Object.assign(new Error('Brak RELATIONS_BACKUP_TO_EMAIL. Ustaw adres odbiorcy kopii w Vercel.'), { statusCode: 503 })
    const rows = await loadRelations(supabaseUrl, dataKey, token)
    const now = new Date()
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const csv = relationCsv(rows)
    const json = JSON.stringify({ generatedAt: now.toISOString(), relationCount: rows.length, rows }, null, 2)
    const active = rows.filter(row => row?.active !== false).length
    const subject = `Top Dragon TMS — kopia relacji ${now.toISOString().slice(0,10)} (${rows.length})`
    await sendWithResend({
      to,
      from,
      subject,
      html: `<p>Kopia bezpieczeństwa danych relacji Top Dragon TMS.</p><p><b>Wszystkie rekordy:</b> ${rows.length}<br><b>Aktywne:</b> ${active}<br><b>Wygenerowano:</b> ${now.toISOString()}</p><p>W załącznikach znajdują się CSV do szybkiego odczytu oraz pełny JSON pozwalający odtworzyć dane techniczne relacji.</p>`,
      attachments: [
        backupAttachment(`top-dragon-relations-${stamp}.csv`, csv),
        backupAttachment(`top-dragon-relations-${stamp}.json`, json),
      ],
    })
    const mode = req.method === 'GET' ? 'automatyczną' : 'ręczną'
    return res.status(200).json({ ok:true, count:rows.length, message:`Wysłano ${mode} kopię ${rows.length} relacji na skonfigurowany adres e-mail.` })
  } catch (error) {
    return res.status(Number(error?.statusCode || 500)).json({ ok:false, message:String(error?.message || 'Nie udało się wysłać kopii relacji.') })
  }
}
