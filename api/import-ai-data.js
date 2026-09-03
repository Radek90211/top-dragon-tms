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

function plainTableCell(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#x20;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseStructuredVehicleTable(sourceText) {
  const lines = String(sourceText || '').replace(/\r/g, '').split('\n')
  const aliases = {
    carrierName: new Set(['firma', 'przewoznik', 'carrier', 'carriername']),
    driverName: new Set(['kierowca', 'driver', 'drivername']),
    registrations: new Set(['nrrej', 'nrrejestracyjny', 'numeryrejestracyjne', 'registration']),
    identityDocumentNumber: new Set(['nrdowodu', 'dowod', 'identitydocumentnumber', 'idcard']),
    phone: new Set(['tel', 'telefon', 'phone']),
  }
  let headerIndex = -1
  let delimiter = ''
  let indexes = null
  for (let index = 0; index < lines.length; index += 1) {
    const candidateDelimiter = tableDelimiter(lines[index])
    if (!candidateDelimiter) continue
    const headers = splitTableLine(lines[index], candidateDelimiter).map(tableHeaderKey)
    const indexFor = (key) => headers.findIndex((header) => aliases[key].has(header))
    const candidate = Object.fromEntries(Object.keys(aliases).map((key) => [key, indexFor(key)]))
    if (candidate.driverName >= 0 && (candidate.carrierName >= 0 || candidate.registrations >= 0)) {
      headerIndex = index
      delimiter = candidateDelimiter
      indexes = candidate
      break
    }
  }
  if (headerIndex < 0 || !indexes) return null

  const items = []
  const warnings = []
  for (const line of lines.slice(headerIndex + 1)) {
    if (!String(line || '').trim()) continue
    if (tableDelimiter(line) !== delimiter && delimiter !== '\t') continue
    const cells = splitTableLine(line, delimiter)
    if (cells.every((cell) => !cell || /^:?-{3,}:?$/.test(cell))) continue
    const get = (key) => indexes[key] >= 0 ? plainTableCell(cells[indexes[key]]) : ''
    const driverName = get('driverName')
    const registrationParts = get('registrations').split(/[\/;,]+/).map((value) => value.trim().toUpperCase()).filter(Boolean)
    if (!driverName && !registrationParts.length) continue
    items.push({
      id: '', dispatcher: '', carrierName: get('carrierName'), driverName,
      phone: get('phone').replace(/\s+/g, ''), nationality: 'PL', baseLocation: '',
      vehicleRegistrationNo: registrationParts[0] || '', vehicleBrand: '',
      trailerRegistrationNo: registrationParts[1] || '', trailerHeightM: 0,
      identityDocumentNumber: get('identityDocumentNumber'), hidden: false, confidence: 1,
    })
  }
  if (!items.length) return null
  if (items.some((item) => !item.carrierName)) warnings.push('Część wierszy nie zawiera nazwy przewoźnika.')
  return { items, warnings, structured: true }
}

function tableHeaderKey(value) {
  return plainTableCell(value)
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function tableDelimiter(line) {
  const text = String(line || '')
  if ((text.match(/\|/g) || []).length >= 2) return '|'
  if (text.includes('\t')) return '\t'
  if ((text.match(/;/g) || []).length >= 2) return ';'
  return ''
}

function splitTableLine(line, delimiter) {
  let text = String(line || '').trim()
  if (delimiter === '|') text = text.replace(/^\|/, '').replace(/\|$/, '')
  return text.split(delimiter).map(plainTableCell)
}

function parseStructuredClientTable(sourceText) {
  const lines = String(sourceText || '').replace(/\r/g, '').split('\n')
  const aliases = {
    name: new Set(['klient', 'nazwa', 'nazwaklienta', 'client', 'customer', 'name']),
    city: new Set(['miejscowosc', 'miasto', 'city', 'lokalizacja', 'location']),
    address: new Set(['adres', 'address']),
    postalCode: new Set(['kodpocztowy', 'kod', 'postalcode', 'postcode']),
    kind: new Set(['rodzaj', 'typ', 'branza', 'branża', 'ladunki', 'typyladunkow', 'cargotypes', 'businesstype']),
    nip: new Set(['nip', 'taxid']),
  }
  let headerIndex = -1
  let delimiter = ''
  let headers = []
  let indexes = null

  for (let index = 0; index < lines.length; index += 1) {
    const candidateDelimiter = tableDelimiter(lines[index])
    if (!candidateDelimiter) continue
    const candidateHeaders = splitTableLine(lines[index], candidateDelimiter).map(tableHeaderKey)
    const indexFor = (key) => candidateHeaders.findIndex((header) => aliases[key].has(header))
    const candidate = {
      name: indexFor('name'), city: indexFor('city'), address: indexFor('address'),
      postalCode: indexFor('postalCode'), kind: indexFor('kind'), nip: indexFor('nip'),
    }
    if (candidate.name >= 0 && [candidate.city, candidate.address, candidate.postalCode].some((value) => value >= 0)) {
      headerIndex = index
      delimiter = candidateDelimiter
      headers = candidateHeaders
      indexes = candidate
      break
    }
  }
  if (headerIndex < 0 || !indexes) return null

  const items = []
  const rejectedItems = []
  for (const [rowOffset, line] of lines.slice(headerIndex + 1).entries()) {
    if (!String(line || '').trim()) continue
    if (tableDelimiter(line) !== delimiter && delimiter !== '\t') continue
    const cells = splitTableLine(line, delimiter)
    if (cells.every((cell) => !cell || /^:?-{3,}:?$/.test(cell))) continue
    const get = (index) => index >= 0 ? plainTableCell(cells[index]) : ''
    const name = get(indexes.name)
    const city = get(indexes.city)
    const postalCode = get(indexes.postalCode)
    const explicitAddress = get(indexes.address)
    const address = explicitAddress || [postalCode, city].filter(Boolean).join(' ')
    const kind = get(indexes.kind)
    if (!name || !address) {
      if (cells.some(Boolean)) {
        rejectedItems.push({
          sourceRow: headerIndex + rowOffset + 2,
          name,
          address: explicitAddress,
          postalCode,
          city,
          nip: get(indexes.nip),
          cargoTypes: kind,
          businessType: kind,
          reason: !name && !address
            ? 'Brak nazwy klienta oraz miejscowości/adresu.'
            : !name
              ? 'Brak nazwy klienta.'
              : 'Brak miejscowości lub adresu.',
        })
      }
      continue
    }
    items.push({
      id: '', name, address, postalCode, city, nip: get(indexes.nip),
      cargoTypes: kind, businessType: kind, dispatcher: '', lat: 0, lng: 0,
      approximate: true, qualityRating: 3, paymentDays: 30,
      cooperationNotes: '', lastContactAt: '', confidence: 1,
    })
  }
  if (!items.length && !rejectedItems.length) return null
  const correctionEnding = rejectedItems.length === 1
    ? 'wiersz wymagający'
    : rejectedItems.length >= 2 && rejectedItems.length <= 4
      ? 'wiersze wymagające'
      : 'wierszy wymagających'
  const warnings = rejectedItems.length
    ? [`Wykryto ${rejectedItems.length} ${correctionEnding} sprawdzenia i uzupełnienia przed importem.`]
    : []
  return { items, rejectedItems, warnings, detectedColumns: headers.length }
}

async function authenticateAdmin(req) {
  const authorization = String(req.headers?.authorization || '')
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) throw Object.assign(new Error('Brak tokenu sesji Supabase.'), { statusCode: 401 })

  const supabaseUrl = firstValidSupabaseUrl()
  const anonKey = firstValidSupabaseKey()
  if (!supabaseUrl || !anonKey) throw Object.assign(new Error('Nieprawidłowa konfiguracja Supabase. SUPABASE_URL musi zawierać adres https://…supabase.co, a klucz publikowalny należy ustawić osobno.'), { statusCode: 500 })

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

function instructionsForKind(kind, referenceDate = '') {
  return [
    'Jesteś modułem ekstrakcji danych dla Top Dragon TMS.',
    'Zwróć wyłącznie poprawny JSON w formacie {"items":[],"warnings":[]}; bez Markdown, komentarzy i dodatkowych kluczy.',
    'Nie wymyślaj danych. Jeśli wartość nie występuje w źródle, użyj pustego tekstu, null albo 0 zgodnie z typem.',
    'Zachowaj polskie znaki, nie zmieniaj identyfikatorów i nie łącz dwóch rekordów w jeden.',
    schemaForKind(kind),
    kind === 'clients' ? 'Klient jest poprawny tylko wtedy, gdy ma name i address albo jednoznaczny adres z postalCode/city.' : '',
    kind === 'relations' ? 'Relacja jest poprawna tylko wtedy, gdy ma load, unload i datę załadunku.' : '',
    kind === 'relations' ? `Data odniesienia do interpretacji dat względnych: ${referenceDate || 'brak'}.` : '',
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
    const referenceDate = String(body.referenceDate || '').trim().slice(0, 10)
    if (!ALLOWED_KINDS.has(kind)) return json(res, 400, { ok: false, message: 'Nieobsługiwany rodzaj importu AI.' })
    if (sourceText.length < 3) return json(res, 400, { ok: false, message: 'Brak danych źródłowych do analizy AI.' })
    if (sourceText.length > MAX_SOURCE_LENGTH) return json(res, 413, { ok: false, message: `Dane źródłowe są za długie. Maksimum to ${MAX_SOURCE_LENGTH} znaków.` })

    const structuredClients = kind === 'clients' ? parseStructuredClientTable(sourceText) : null
    const structuredVehicles = kind === 'vehicles' ? parseStructuredVehicleTable(sourceText) : null
    const structuredResult = structuredClients || structuredVehicles
    if (structuredResult && (structuredResult.items.length || structuredResult.rejectedItems?.length)) {
      return json(res, 200, {
        ok: true,
        kind,
        items: normalizeItems(kind, structuredResult.items),
        rejectedItems: structuredResult.rejectedItems || [],
        warnings: structuredResult.warnings || [],
        model: structuredClients ? 'parser-tabeli-klientow' : 'parser-tabeli-floty',
        structured: true,
        elapsedMs: Date.now() - startedAt,
      })
    }

    const geminiKey = env('GEMINI_API_KEY')
    if (!geminiKey) return json(res, 503, { ok: false, message: 'Brak GEMINI_API_KEY w konfiguracji wdrożenia. Import AI jest chwilowo niedostępny.' })
    const geminiModel = configuredGeminiModel()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 75000)
    let geminiResponse
    try {
      geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructionsForKind(kind, referenceDate) }] },
          contents: [{ role: 'user', parts: [{ text: `Rodzaj importu: ${kind}\nNazwa źródła: ${sourceName}\n\nDANE ŹRÓDŁOWE:\n${sourceText}` }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: kind === 'clients' ? 24000 : 12000, temperature: 0 },
        }),
      })
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Analiza AI trwała zbyt długo. Spróbuj ponownie lub podziel dane na mniejsze części.')
      throw error
    } finally {
      clearTimeout(timeout)
    }
    const geminiData = await geminiResponse.json().catch(() => ({}))
    if (!geminiResponse.ok) {
      const providerMessage = errorMessage(geminiData?.error, `Gemini zwróciło HTTP ${geminiResponse.status}.`)
      return json(res, 502, { ok: false, message: `Analiza AI nie powiodła się: ${providerMessage}` })
    }

    const outputText = String(geminiData?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('') || '')
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    let parsed
    try { parsed = JSON.parse(outputText) } catch {
      const start = outputText.indexOf('{')
      const end = outputText.lastIndexOf('}')
      try {
        if (start < 0 || end <= start) throw new Error('brak JSON')
        parsed = JSON.parse(outputText.slice(start, end + 1))
      } catch {
        throw new Error('Model Gemini zwrócił niepoprawny JSON. Spróbuj ponownie z krótszym lub bardziej uporządkowanym źródłem.')
      }
    }
    const items = normalizeItems(kind, parsed?.items)
    const warnings = (Array.isArray(parsed?.warnings) ? parsed.warnings : []).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 100)
    return json(res, 200, {
      ok: true,
      kind,
      items,
      warnings,
      model: geminiModel,
      elapsedMs: Date.now() - startedAt,
    })
  } catch (error) {
    const status = Number(error?.statusCode || 500)
    return json(res, status >= 400 && status < 600 ? status : 500, { ok: false, message: errorMessage(error, 'Nie udało się wykonać importu AI.') })
  }
}
