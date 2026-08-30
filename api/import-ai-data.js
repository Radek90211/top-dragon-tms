/*
 * Chroniony endpoint Vercel dla administracyjnego importu AI.
 * Nie używa klucza OpenAI w przeglądarce: iframe przekazuje tylko tekst źródłowy
 * i aktualny token Supabase, a odpowiedź jest zawsze ograniczona do JSON.
 */

const ALLOWED_KINDS = new Set(['clients', 'relations', 'vehicles'])
const MAX_SOURCE_LENGTH = 120000
const MAX_ITEMS = 1000

function env(name, fallback = '') {
  return String(process.env?.[name] || fallback || '').trim()
}

function json(res, status, body) {
  res.status(status).json(body)
}

function errorMessage(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value?.message) return String(value.message)
  return fallback
}

async function authenticateAdmin(req) {
  const authorization = String(req.headers?.authorization || '')
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) throw Object.assign(new Error('Brak tokenu sesji Supabase.'), { statusCode: 401 })

  const supabaseUrl = env('SUPABASE_URL') || env('VITE_SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = env('SUPABASE_ANON_KEY') || env('SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_ANON_KEY') || env('VITE_SUPABASE_PUBLISHABLE_KEY') || env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) throw Object.assign(new Error('Brak konfiguracji SUPABASE_URL/SUPABASE_ANON_KEY dla endpointu importu AI.'), { statusCode: 500 })

  const userResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${match[1]}` },
  })
  const userData = await userResponse.json().catch(() => ({}))
  if (!userResponse.ok || !userData?.id) throw Object.assign(new Error('Sesja Supabase jest nieważna lub wygasła.'), { statusCode: 401 })

  const profileUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${encodeURIComponent(userData.id)}&select=role,active&limit=1`
  const profileResponse = await fetch(profileUrl, {
    headers: { apikey: anonKey, Authorization: `Bearer ${match[1]}` },
  })
  const profileData = await profileResponse.json().catch(() => ([]))
  const profile = Array.isArray(profileData) ? profileData[0] : null
  if (!profileResponse.ok || !profile || profile.active === false || profile.role !== 'admin') {
    throw Object.assign(new Error('Import administracyjny AI wymaga aktywnego konta Administratora.'), { statusCode: 403 })
  }
  return { token: match[1], user: userData, profile }
}

function schemaForKind(kind) {
  if (kind === 'clients') {
    return `items zawierające wyłącznie klientów z polami: id, name, address, postalCode, city, nip, cargoTypes, businessType, dispatcher, lat, lng, approximate, qualityRating, paymentDays, cooperationNotes, lastContactAt, confidence.`
  }
  if (kind === 'vehicles') {
    return `items zawierające zestawy floty z polami: id, dispatcher, carrierName, driverName, phone, nationality, baseLocation, vehicleRegistrationNo, vehicleBrand, trailerRegistrationNo, trailerHeightM, hidden, confidence.`
  }
  return `items zawierające planowane relacje z polami: id, dispatcher, loadDate, unloadDate, loadTime, unloadTime, load, loadAddress, unload, unloadAddress, client, approachKm, loadedKm, baseKm, rate, cost, reference, notes, confidence.`
}

function instructionsForKind(kind) {
  return [
    'Jesteś modułem ekstrakcji danych dla Top Dragon TMS.',
    'Zwróć wyłącznie poprawny JSON w formacie {"items":[],"warnings":[]}; bez Markdown, komentarzy i dodatkowych kluczy.',
    'Nie wymyślaj danych. Jeśli wartość nie występuje w źródle, użyj pustego tekstu, null albo 0 zgodnie z typem.',
    'Zachowaj polskie znaki, nie zmieniaj identyfikatorów i nie łącz dwóch rekordów w jeden.',
    schemaForKind(kind),
    kind === 'clients' ? 'Klient jest poprawny tylko wtedy, gdy ma name i address albo jednoznaczny adres z postalCode/city.' : '',
    kind === 'relations' ? 'Relacja jest poprawna tylko wtedy, gdy ma load, unload i datę załadunku.' : '',
    kind === 'vehicles' ? 'Zestaw jest poprawny tylko wtedy, gdy ma driverName lub vehicleRegistrationNo.' : '',
  ].filter(Boolean).join('\n')
}

function normalizeItems(kind, items) {
  return (Array.isArray(items) ? items : []).slice(0, MAX_ITEMS).map((item) => {
    if (!item || typeof item !== 'object') return null
    const normalized = {}
    Object.entries(item).slice(0, 40).forEach(([key, value]) => {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) return
      if (typeof value === 'string') normalized[key] = value.slice(0, 2000)
      else if (typeof value === 'number' && Number.isFinite(value)) normalized[key] = value
      else if (typeof value === 'boolean') normalized[key] = value
      else if (value == null) normalized[key] = null
    })
    if (kind === 'clients' && (!String(normalized.name || '').trim() || (!String(normalized.address || '').trim() && !String(normalized.city || '').trim()))) return null
    if (kind === 'relations' && (!String(normalized.load || '').trim() || !String(normalized.unload || '').trim())) return null
    if (kind === 'vehicles' && (!String(normalized.driverName || '').trim() && !String(normalized.vehicleRegistrationNo || '').trim())) return null
    return normalized
  }).filter(Boolean)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { ok: false, message: 'Dozwolona jest wyłącznie metoda POST.' })
  }

  const startedAt = Date.now()
  try {
    const { token } = await authenticateAdmin(req)
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const kind = String(body.kind || '').trim().toLowerCase()
    const sourceText = String(body.sourceText || '').trim()
    const sourceName = String(body.sourceName || 'import').trim().slice(0, 160)
    if (!ALLOWED_KINDS.has(kind)) return json(res, 400, { ok: false, message: 'Nieobsługiwany rodzaj importu AI.' })
    if (sourceText.length < 3) return json(res, 400, { ok: false, message: 'Brak danych źródłowych do analizy AI.' })
    if (sourceText.length > MAX_SOURCE_LENGTH) return json(res, 413, { ok: false, message: `Dane źródłowe są za długie. Maksimum to ${MAX_SOURCE_LENGTH} znaków.` })

    const openAiKey = env('OPENAI_API_KEY')
    if (!openAiKey) return json(res, 503, { ok: false, message: 'Brak OPENAI_API_KEY w konfiguracji wdrożenia. Import AI jest chwilowo niedostępny.' })

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: env('OPENAI_IMPORT_MODEL', 'gpt-4.1-mini'),
        store: false,
        instructions: instructionsForKind(kind),
        input: `Rodzaj importu: ${kind}\nNazwa źródła: ${sourceName}\n\nDANE ŹRÓDŁOWE:\n${sourceText}`,
        text: { format: { type: 'json_object' } },
      }),
    })
    const openAiData = await openAiResponse.json().catch(() => ({}))
    if (!openAiResponse.ok) {
      const providerMessage = errorMessage(openAiData?.error, `OpenAI zwróciło HTTP ${openAiResponse.status}.`)
      return json(res, 502, { ok: false, message: `Analiza AI nie powiodła się: ${providerMessage}` })
    }

    const outputText = String(openAiData?.output_text || openAiData?.output?.flatMap((item) => item?.content || []).find((item) => item?.type === 'output_text')?.text || '').trim()
    let parsed
    try { parsed = JSON.parse(outputText) } catch { throw new Error('Model AI zwrócił niepoprawny JSON. Spróbuj ponownie z krótszym lub bardziej uporządkowanym źródłem.') }
    const items = normalizeItems(kind, parsed?.items)
    const warnings = (Array.isArray(parsed?.warnings) ? parsed.warnings : []).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 100)
    return json(res, 200, {
      ok: true,
      kind,
      items,
      warnings,
      model: String(openAiData?.model || env('OPENAI_IMPORT_MODEL', 'gpt-4.1-mini')),
      elapsedMs: Date.now() - startedAt,
    })
  } catch (error) {
    const status = Number(error?.statusCode || 500)
    return json(res, status >= 400 && status < 600 ? status : 500, { ok: false, message: errorMessage(error, 'Nie udało się wykonać importu AI.') })
  }
}
