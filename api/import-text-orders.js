/*
 * Chroniony endpoint analizy tekstowych wiadomości ze zleceniami transportowymi.
 * Token użytkownika jest weryfikowany w Supabase, a klucz Gemini pozostaje
 * wyłącznie po stronie serwera.
 */

const MAX_TEXT_LENGTH = 80000

export const maxDuration = 120

function env(name, fallback = '') {
  return String(process.env?.[name] || fallback || '').trim()
}

function configuredGeminiModel() {
  const configured = env('GEMINI_IMPORT_MODEL', env('GEMINI_MODEL')).replace(/^models\//i, '')
  if (!configured || configured === 'gemini-2.5-flash') return 'gemini-3.6-flash'
  return configured
}

function firstValidSupabaseUrl() {
  const candidates = [
    'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]
    .map((name) => env(name))
    .filter(Boolean)
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate)
      if (url.protocol === 'https:' && /\.supabase\.(co|in)$/i.test(url.hostname)) return url.origin
    } catch {}
  }
  return ''
}

function firstValidSupabaseKey() {
  return [
    'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
  ]
    .map((name) => env(name))
    .find((value) => value && !/^https?:\/\//i.test(value)) || ''
}

function json(res, status, body) {
  res.status(status).json(body)
}

function errorMessage(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value?.message) return String(value.message)
  return fallback
}

async function authenticateOperationalUser(req) {
  const authorization = String(req.headers?.authorization || '')
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) throw Object.assign(new Error('Brak tokenu sesji Supabase.'), { statusCode: 401 })

  const supabaseUrl = firstValidSupabaseUrl()
  const anonKey = firstValidSupabaseKey()
  if (!supabaseUrl || !anonKey) {
    throw Object.assign(new Error('Nieprawidłowa konfiguracja Supabase. SUPABASE_URL musi zawierać adres https://…supabase.co, a klucz publikowalny należy ustawić osobno.'), { statusCode: 500 })
  }

  const headers = { apikey: anonKey, Authorization: `Bearer ${match[1]}` }
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers })
  const userData = await userResponse.json().catch(() => ({}))
  if (!userResponse.ok || !userData?.id) throw Object.assign(new Error('Sesja Supabase jest nieważna lub wygasła.'), { statusCode: 401 })

  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userData.id)}&select=role,active&limit=1`, { headers })
  const profileData = await profileResponse.json().catch(() => ([]))
  const profile = Array.isArray(profileData) ? profileData[0] : null
  if (!profileResponse.ok || !profile || profile.active === false || !['dispatcher', 'admin'].includes(String(profile.role || ''))) {
    throw Object.assign(new Error('Analiza zleceń AI jest dostępna wyłącznie dla spedytora i administratora.'), { statusCode: 403 })
  }
}

function instructions(referenceDate = '') {
  return [
    'Jesteś modułem ekstrakcji wielu zleceń transportowych dla Top Dragon TMS.',
    'Odczytaj wszystkie relacje występujące w wiadomości. Każde zlecenie zwróć jako osobny element tablicy routes.',
    'Nie zgaduj danych. Brakujące teksty pozostaw puste, a brakujące liczby ustaw na 0.',
    `Data odniesienia do interpretacji dat względnych: ${referenceDate || 'brak'}.`,
    'Zwróć wyłącznie poprawny JSON bez Markdown i komentarzy.',
    'Format: {"routes":[{"pickup":{"date":"YYYY-MM-DD","time":"HH:MM","city":"","postalCode":"","address":"","fullAddress":""},"delivery":{"date":"YYYY-MM-DD","time":"HH:MM","city":"","postalCode":"","address":"","fullAddress":""},"client":"","clientNip":"","clientAddress":"","reference":"","rate":0,"currency":"","loadedKm":0,"cost":0,"oversizedCost":0,"extraInfo":[],"driverNotes":[],"confidence":0}],"warnings":[]}.',
    'Relację zwróć tylko wtedy, gdy można wskazać miejsce załadunku i rozładunku.',
    'Oddziel miejscowość i kod pocztowy od dokładnego adresu. fullAddress ma być pełnym adresem możliwym do wyszukania w mapach: nazwa obiektu, ulica i numer, kod pocztowy, miejscowość oraz kraj, jeśli są podane.',
    'Nie przenoś adresu z poprzedniej ani innej relacji. Jeśli nie da się jednoznacznie przypisać adresu do załadunku albo rozładunku, pozostaw go pusty.',
    'W client podaj nazwę zleceniodawcy, w clientNip jego polski NIP (same cyfry), a w clientAddress adres siedziby, jeśli wiadomość zawiera te dane jednoznacznie.',
    'Do driverNotes wpisz tylko informacje potrzebne kierowcy. Pomiń stawkę, koszty, marżę, rozliczenia i komentarze wewnętrzne.',
  ].join('\n')
}

function outputText(data) {
  const interactionText = data?.steps
    ?.flatMap((step) => step?.content || [])
    ?.filter((item) => item?.type === 'text')
    ?.map((item) => item?.text || '')
    ?.join('')
  return String(data?.output_text || interactionText || data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('') || '').trim()
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function shouldRetryGemini(status) {
  return [429, 500, 502, 503, 504].includes(Number(status))
}

const TEXT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    routes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pickup: {
            type: 'object',
            properties: {
              date: { type: 'string' }, time: { type: 'string' }, city: { type: 'string' },
              postalCode: { type: 'string' }, address: { type: 'string' }, fullAddress: { type: 'string' },
            },
            required: ['date', 'time', 'city', 'postalCode', 'address', 'fullAddress'],
          },
          delivery: {
            type: 'object',
            properties: {
              date: { type: 'string' }, time: { type: 'string' }, city: { type: 'string' },
              postalCode: { type: 'string' }, address: { type: 'string' }, fullAddress: { type: 'string' },
            },
            required: ['date', 'time', 'city', 'postalCode', 'address', 'fullAddress'],
          },
          client: { type: 'string' }, clientNip: { type: 'string' }, clientAddress: { type: 'string' }, reference: { type: 'string' }, rate: { type: 'number' },
          currency: { type: 'string' }, loadedKm: { type: 'number' }, cost: { type: 'number' },
          oversizedCost: { type: 'number' }, extraInfo: { type: 'array', items: { type: 'string' } },
          driverNotes: { type: 'array', items: { type: 'string' } }, confidence: { type: 'number' },
        },
        required: ['pickup', 'delivery', 'client', 'clientNip', 'clientAddress', 'reference', 'rate', 'currency', 'loadedKm', 'cost', 'oversizedCost', 'extraInfo', 'driverNotes', 'confidence'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['routes', 'warnings'],
}

function parseJsonOutput(data) {
  const raw = outputText(data).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(raw) } catch {}
  for (const [startChar, endChar] of [['{', '}'], ['[', ']']]) {
    const start = raw.indexOf(startChar)
    const end = raw.lastIndexOf(endChar)
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)) } catch {}
    }
  }
  throw new Error('Model Gemini zwrócił niepoprawny format danych.')
}

function normalizeDate(value) {
  const text = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function normalizePoint(input = {}) {
  return {
    date: normalizeDate(input?.date),
    time: String(input?.time || input?.hour || '').trim().slice(0, 5),
    city: String(input?.city || input?.place || '').trim().slice(0, 300),
    postalCode: String(input?.postalCode || input?.postcode || '').trim().slice(0, 40),
    address: String(input?.address || '').trim().slice(0, 600),
    fullAddress: String(input?.fullAddress || input?.location || '').trim().slice(0, 700),
  }
}

function pointLabel(point) {
  return String(point?.fullAddress || [point?.postalCode, point?.city].filter(Boolean).join(' ') || point?.address || '').trim()
}

function finiteNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function normalizeRoute(value = {}) {
  const pickup = normalizePoint(value.pickup || value.load || value.loading || value.zaladunek || value.załadunek)
  const delivery = normalizePoint(value.delivery || value.unload || value.unloading || value.rozladunek || value.rozładunek)
  if (!pointLabel(pickup) || !pointLabel(delivery)) return null
  return {
    pickup,
    delivery,
    client: String(value.client || value.customer || '').trim().slice(0, 500),
    clientNip: String(value.clientNip || value.nip || value.taxId || '').replace(/\D/g, '').slice(0, 10),
    clientAddress: String(value.clientAddress || value.customerAddress || '').trim().slice(0, 700),
    reference: String(value.reference || value.orderReference || '').trim().slice(0, 500),
    rate: finiteNumber(value.rate),
    currency: String(value.currency || '').trim().toUpperCase().slice(0, 10),
    loadedKm: finiteNumber(value.loadedKm || value.distanceKm || value.kilometers),
    cost: finiteNumber(value.cost || value.carrierCost || value.transportCost),
    oversizedCost: finiteNumber(value.oversizedCost || value.gabarytCost),
    extraInfo: (Array.isArray(value.extraInfo || value.notes) ? (value.extraInfo || value.notes) : [value.extraInfo || value.notes])
      .map((item) => String(item || '').trim()).filter(Boolean).slice(0, 30),
    driverNotes: (Array.isArray(value.driverNotes || value.driverInstructions) ? (value.driverNotes || value.driverInstructions) : [value.driverNotes || value.driverInstructions])
      .map((item) => String(item || '').trim()).filter(Boolean).slice(0, 30),
    confidence: Math.max(0, Math.min(1, finiteNumber(value.confidence))),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { ok: false, message: 'Dozwolona jest wyłącznie metoda POST.' })
  }

  const startedAt = Date.now()
  try {
    await authenticateOperationalUser(req)
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const text = String(body.text || '').trim()
    const referenceDate = normalizeDate(body.date)
    if (text.length < 3) return json(res, 400, { ok: false, message: 'Wklej wiadomość klienta przed analizą.' })
    if (text.length > MAX_TEXT_LENGTH) return json(res, 413, { ok: false, message: `Wiadomość jest za długa. Maksimum to ${MAX_TEXT_LENGTH} znaków.` })

    const geminiKey = env('GEMINI_API_KEY')
    if (!geminiKey) return json(res, 503, { ok: false, message: 'Brak GEMINI_API_KEY w konfiguracji wdrożenia.' })
    const geminiModel = configuredGeminiModel()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 110000)
    let geminiResponse
    try {
      const requestBody = JSON.stringify({
        model: geminiModel,
        system_instruction: instructions(referenceDate),
        input: [{ type: 'text', text }],
        response_format: { type: 'text', mime_type: 'application/json', schema: TEXT_RESPONSE_SCHEMA },
        generation_config: { max_output_tokens: 5000, thinking_level: 'minimal' },
        store: false,
      })
      for (let attempt = 0; attempt < 2; attempt += 1) {
        geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey, 'Api-Revision': '2026-05-20' },
          signal: controller.signal,
          body: requestBody,
        })
        if (!shouldRetryGemini(geminiResponse.status) || attempt === 1) break
        await geminiResponse.body?.cancel?.().catch(() => {})
        await delay(700 + Math.floor(Math.random() * 350))
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Analiza wiadomości trwała zbyt długo. Spróbuj ponownie lub podziel tekst na mniejsze części.')
      throw error
    } finally {
      clearTimeout(timeout)
    }

    const geminiData = await geminiResponse.json().catch(() => ({}))
    if (!geminiResponse.ok) {
      return json(res, 502, { ok: false, message: `Analiza AI nie powiodła się: ${errorMessage(geminiData?.error, `Gemini zwróciło HTTP ${geminiResponse.status}.`)}` })
    }

    const parsed = parseJsonOutput(geminiData)
    const sourceRoutes = Array.isArray(parsed) ? parsed : (parsed?.routes || parsed?.relations || parsed?.loads || parsed?.items || [])
    const routes = (Array.isArray(sourceRoutes) ? sourceRoutes : []).slice(0, 500).map(normalizeRoute).filter(Boolean)
    const warnings = (Array.isArray(parsed?.warnings) ? parsed.warnings : []).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 100)
    if (!routes.length) warnings.unshift('Nie rozpoznano relacji zawierającej zarówno załadunek, jak i rozładunek.')
    return json(res, 200, {
      ok: true,
      routes,
      warnings,
      model: geminiModel,
      elapsedMs: Date.now() - startedAt,
    })
  } catch (error) {
    const status = Number(error?.statusCode || 500)
    return json(res, status >= 400 && status < 600 ? status : 500, { ok: false, message: errorMessage(error, 'Nie udało się przeanalizować wiadomości.') })
  }
}
