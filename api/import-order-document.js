/*
 * Chroniony endpoint analizy zleceń transportowych zapisanych jako PDF lub Word.
 * Plik jest przekazywany do OpenAI jako input_file; klucz API pozostaje wyłącznie
 * po stronie serwera.
 */

const MAX_FILE_BYTES = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx'])
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
])

export const config = {
  api: { bodyParser: false },
}

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

function safeHeader(value) {
  try { return decodeURIComponent(String(value || '')) } catch { return String(value || '') }
}

function fileExtension(fileName) {
  return String(fileName || '').toLowerCase().split('.').pop() || ''
}

function mimeForExtension(extension, incomingType = '') {
  const type = String(incomingType || '').split(';')[0].trim().toLowerCase()
  if (type && type !== 'application/octet-stream') return type
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'doc') return 'application/msword'
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return type || 'application/octet-stream'
}

async function readRawBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_FILE_BYTES) {
      throw Object.assign(new Error('Plik jest za duży. Maksymalny rozmiar to 20 MB.'), { statusCode: 413 })
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

async function authenticateOperationalUser(req) {
  const authorization = String(req.headers?.authorization || '')
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) throw Object.assign(new Error('Brak tokenu sesji Supabase.'), { statusCode: 401 })

  const supabaseUrl = firstValidSupabaseUrl()
  const anonKey = firstValidSupabaseKey()
  if (!supabaseUrl || !anonKey) throw Object.assign(new Error('Nieprawidłowa konfiguracja Supabase. SUPABASE_URL musi zawierać adres https://…supabase.co, a klucz publikowalny należy ustawić osobno.'), { statusCode: 500 })

  const baseUrl = supabaseUrl.replace(/\/$/, '')
  const headers = { apikey: anonKey, Authorization: `Bearer ${match[1]}` }
  const userResponse = await fetch(`${baseUrl}/auth/v1/user`, { headers })
  const userData = await userResponse.json().catch(() => ({}))
  if (!userResponse.ok || !userData?.id) throw Object.assign(new Error('Sesja Supabase jest nieważna lub wygasła.'), { statusCode: 401 })

  const profileResponse = await fetch(`${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userData.id)}&select=role,active&limit=1`, { headers })
  const profileData = await profileResponse.json().catch(() => ([]))
  const profile = Array.isArray(profileData) ? profileData[0] : null
  if (!profileResponse.ok || !profile || profile.active === false || !['dispatcher', 'admin'].includes(String(profile.role || ''))) {
    throw Object.assign(new Error('Analiza zleceń AI jest dostępna wyłącznie dla spedytora i administratora.'), { statusCode: 403 })
  }
  return { user: userData, profile }
}

function analysisInstructions(referenceDate = '') {
  return [
    'Jesteś modułem ekstrakcji zleceń transportowych dla Top Dragon TMS.',
    'Odczytaj wyłącznie dane występujące w dokumencie. Nie zgaduj i nie uzupełniaj braków.',
    `Data odniesienia do interpretacji dat względnych: ${referenceDate || 'brak'}.`,
    'Zwróć wyłącznie poprawny JSON bez Markdown i bez dodatkowego tekstu.',
    'Format odpowiedzi:',
    '{"pickup":{"date":"YYYY-MM-DD","time":"HH:MM","city":"","postalCode":"","address":"","fullAddress":""},"delivery":{"date":"YYYY-MM-DD","time":"HH:MM","city":"","postalCode":"","address":"","fullAddress":""},"client":"","reference":"","rate":0,"currency":"","loadedKm":0,"cost":0,"oversizedCost":0,"extraInfo":[],"reminders":[],"confidence":0}',
    'confidence ma być liczbą od 0 do 1. Kwoty i kilometry zwracaj jako liczby. Brakujące wartości pozostaw puste lub ustaw na 0.',
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

function parseJsonOutput(data) {
  const raw = outputText(data).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(raw) } catch {}
  const objectStart = raw.indexOf('{')
  const objectEnd = raw.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) return JSON.parse(raw.slice(objectStart, objectEnd + 1))
  throw new Error('Model Gemini zwrócił niepoprawny format danych.')
}

function normalizeResult(value = {}) {
  const point = (input = {}) => ({
    date: String(input?.date || '').slice(0, 10),
    time: String(input?.time || input?.hour || '').slice(0, 5),
    city: String(input?.city || input?.place || '').trim().slice(0, 300),
    postalCode: String(input?.postalCode || '').trim().slice(0, 40),
    address: String(input?.address || '').trim().slice(0, 600),
    fullAddress: String(input?.fullAddress || '').trim().slice(0, 700),
  })
  const number = (input) => Number.isFinite(Number(input)) ? Number(input) : 0
  const textList = (input) => (Array.isArray(input) ? input : [input]).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 30)
  return {
    pickup: point(value.pickup || value.load || value.loading),
    delivery: point(value.delivery || value.unload || value.unloading),
    client: String(value.client || value.customer || '').trim().slice(0, 500),
    reference: String(value.reference || value.orderReference || '').trim().slice(0, 500),
    rate: number(value.rate),
    currency: String(value.currency || '').trim().toUpperCase().slice(0, 10),
    loadedKm: number(value.loadedKm || value.distanceKm || value.kilometers),
    cost: number(value.cost || value.carrierCost || value.transportCost),
    oversizedCost: number(value.oversizedCost || value.gabarytCost),
    extraInfo: textList(value.extraInfo || value.notes),
    reminders: textList(value.reminders),
    confidence: Math.max(0, Math.min(1, number(value.confidence))),
  }
}

const ORDER_RESPONSE_SCHEMA = {
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
    client: { type: 'string' }, reference: { type: 'string' }, rate: { type: 'number' },
    currency: { type: 'string' }, loadedKm: { type: 'number' }, cost: { type: 'number' },
    oversizedCost: { type: 'number' }, extraInfo: { type: 'array', items: { type: 'string' } },
    reminders: { type: 'array', items: { type: 'string' } }, confidence: { type: 'number' },
  },
  required: ['pickup', 'delivery', 'client', 'reference', 'rate', 'currency', 'loadedKm', 'cost', 'oversizedCost', 'extraInfo', 'reminders', 'confidence'],
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { ok: false, message: 'Dozwolona jest wyłącznie metoda POST.' })
  }

  const startedAt = Date.now()
  try {
    await authenticateOperationalUser(req)
    const fileName = safeHeader(req.headers?.['x-file-name'] || 'zlecenie.pdf').trim().slice(0, 220)
    const referenceDate = safeHeader(req.headers?.['x-reference-date'] || '').slice(0, 10)
    const extension = fileExtension(fileName)
    const incomingType = String(req.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase()
    const mimeType = mimeForExtension(extension, incomingType)
    if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(incomingType || mimeType) || !ALLOWED_MIME_TYPES.has(mimeType)) {
      return json(res, 415, { ok: false, message: 'Obsługiwane są zlecenia w formacie PDF, DOC i DOCX.' })
    }

    const file = await readRawBody(req)
    if (!file.length) return json(res, 400, { ok: false, message: 'Przekazany plik jest pusty.' })

    const geminiKey = env('GEMINI_API_KEY')
    if (!geminiKey) return json(res, 503, { ok: false, message: 'Brak GEMINI_API_KEY w konfiguracji wdrożenia.' })
    const geminiModel = configuredGeminiModel()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55000)
    let geminiResponse
    try {
      geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey, 'Api-Revision': '2026-05-20' },
        signal: controller.signal,
        body: JSON.stringify({
          model: geminiModel,
          system_instruction: analysisInstructions(referenceDate),
          input: [
            { type: 'text', text: `Nazwa pliku: ${fileName}\nWyodrębnij dane z załączonego zlecenia transportowego.` },
            { type: 'document', data: file.toString('base64'), mime_type: mimeType },
          ],
          response_format: { type: 'text', mime_type: 'application/json', schema: ORDER_RESPONSE_SCHEMA },
          generation_config: { max_output_tokens: 2200, thinking_level: 'minimal' },
          store: false,
        }),
      })
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Analiza dokumentu trwała zbyt długo. Spróbuj ponownie.')
      throw error
    } finally {
      clearTimeout(timeout)
    }

    const geminiData = await geminiResponse.json().catch(() => ({}))
    if (!geminiResponse.ok) {
      return json(res, 502, { ok: false, message: `Analiza AI nie powiodła się: ${errorMessage(geminiData?.error, `Gemini zwróciło HTTP ${geminiResponse.status}.`)}` })
    }
    const parsed = parseJsonOutput(geminiData)
    return json(res, 200, {
      ok: true,
      ...normalizeResult(parsed),
      fileName,
      fileType: extension,
      model: geminiModel,
      elapsedMs: Date.now() - startedAt,
    })
  } catch (error) {
    const status = Number(error?.statusCode || 500)
    return json(res, status >= 400 && status < 600 ? status : 500, { ok: false, message: errorMessage(error, 'Nie udało się przeanalizować zlecenia.') })
  }
}
