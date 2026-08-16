import { normalizeText, requireActiveUser, writeAudit } from './admin.js'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const LEGACY_MODEL_ALIASES = new Map([
  ['gemini-2.5-flash-lite', DEFAULT_MODEL],
  ['models/gemini-2.5-flash-lite', DEFAULT_MODEL],
])
const ALLOWED_ROLES = new Set(['dispatcher', 'branch_manager', 'admin'])

function clean(value) {
  return String(value ?? '').trim()
}

function geminiKey() {
  return clean(process.env.GEMINI_API_KEY)
}

function geminiModel() {
  const configured = clean(process.env.GEMINI_MODEL)
  if (!configured) return DEFAULT_MODEL
  return LEGACY_MODEL_ALIASES.get(configured.toLowerCase()) || configured.replace(/^models\//i, '')
}

export async function requireAiUser(request) {
  const auth = await requireActiveUser(request)
  if (!auth.ok) return auth
  if (!ALLOWED_ROLES.has(auth.profile?.role)) {
    return {
      ok: false,
      status: 403,
      message: 'Analizator AI jest dostępny dla spedytorów, kierowników oddziału i administratora.',
    }
  }
  return auth
}

export function aiConfiguration() {
  const apiKey = geminiKey()
  if (!apiKey) {
    const error = new Error('Brak GEMINI_API_KEY w zmiennych środowiskowych Vercel.')
    error.status = 503
    throw error
  }
  return { apiKey, model: geminiModel() }
}

function extractGeminiText(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : []
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
    const text = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim()
    if (text) return text
  }

  const blockReason = clean(payload?.promptFeedback?.blockReason)
  if (blockReason) {
    throw new Error(`Gemini zablokował analizę (${blockReason}).`)
  }
  throw new Error('Gemini nie zwrócił danych z analizy.')
}

async function readGeminiJson(response) {
  const text = await response.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: { message: text } }
  }

  if (!response.ok) {
    const apiMessage = clean(data?.error?.message) || clean(data?.message)
    let message = apiMessage || `Gemini API HTTP ${response.status}`
    if (response.status === 400 && /api key/i.test(message)) {
      message = 'Klucz GEMINI_API_KEY został odrzucony przez Gemini. Sprawdź klucz i wykonaj Redeploy w Vercel.'
    } else if (response.status === 403) {
      message = apiMessage || 'Gemini odrzucił dostęp. Sprawdź uprawnienia klucza API i projektu Google AI Studio.'
    } else if (response.status === 429) {
      message = 'Przekroczono aktualny limit zapytań Gemini. Odczekaj chwilę lub sprawdź limity projektu w Google AI Studio.'
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return data
}

function normalizeGeminiParts(parts) {
  if (!Array.isArray(parts)) return []
  return parts.map((part) => {
    if (typeof part === 'string') return { text: part }
    if (part?.text !== undefined) return { text: String(part.text ?? '') }
    if (part?.inlineData) return { inlineData: part.inlineData }
    if (part?.inline_data) return { inlineData: {
      mimeType: part.inline_data.mime_type || part.inline_data.mimeType,
      data: part.inline_data.data,
    } }
    return part
  }).filter(Boolean)
}

export async function runStructuredExtraction({ parts, schema, instructions }) {
  const { apiKey, model } = aiConfiguration()
  const endpoint = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: instructions }],
      },
      contents: [{
        role: 'user',
        parts: normalizeGeminiParts(parts),
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    }),
  })

  const raw = await readGeminiJson(response)
  const text = extractGeminiText(raw)
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini zwrócił odpowiedź, której nie udało się odczytać jako danych relacji.')
  }
  return { data: parsed, model, provider: 'gemini' }
}

export function pointSchema() {
  return {
    type: 'object',
    properties: {
      date: { type: 'string' },
      time: { type: 'string' },
      city: { type: 'string' },
      postalCode: { type: 'string' },
      address: { type: 'string' },
      fullAddress: { type: 'string' },
    },
    required: ['date', 'time', 'city', 'postalCode', 'address', 'fullAddress'],
    additionalProperties: false,
  }
}

export function routeSchema() {
  return {
    type: 'object',
    properties: {
      client: { type: 'string' },
      reference: { type: 'string' },
      pickup: pointSchema(),
      delivery: pointSchema(),
      rate: { type: 'number' },
      currency: { type: 'string' },
      notes: { type: 'array', items: { type: 'string' } },
      reminders: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['client', 'reference', 'pickup', 'delivery', 'rate', 'currency', 'notes', 'reminders', 'confidence'],
    additionalProperties: false,
  }
}

export function analyzerInstructions(referenceDate = '') {
  const baseDate = normalizeText(referenceDate)
  return [
    'Jesteś analizatorem zleceń transportowych dla polskiej firmy spedycyjnej Top Dragon.',
    'Wyodrębniaj wyłącznie dane faktycznie obecne w dokumencie lub wiadomości. Nie zgaduj brakujących danych.',
    'Jeżeli pole jest nieznane, zwróć pusty string, pustą tablicę albo 0 zgodnie ze schematem.',
    'Daty normalizuj do YYYY-MM-DD, godziny do HH:MM w formacie 24-godzinnym.',
    'Adres zachowuj możliwie wiernie. Miasto i kod pocztowy rozdzielaj, jeżeli są jednoznaczne.',
    'Stawkę zwracaj jako liczbę bez symbolu waluty. Walutę zwracaj jako kod, np. PLN, EUR, GBP.',
    'Uwagi obejmują m.in. numery referencyjne dodatkowe, wymagania, rodzaj towaru, wagę, palety i instrukcje kierowcy.',
    'Przypomnienia obejmują tylko wyraźne polecenia wymagające późniejszej akcji spedytora.',
    'confidence ma być liczbą 0-1 opisującą pewność poprawności całej relacji.',
    baseDate ? `Datą odniesienia dla określeń względnych typu „jutro” lub „w poniedziałek” jest ${baseDate}.` : '',
  ].filter(Boolean).join(' ')
}

export async function auditAiAnalysis(auth, source, details = {}) {
  try {
    await writeAudit(
      auth.admin,
      auth.user.id,
      `ai_analyze_${source}`,
      'ai_analysis',
      null,
      null,
      {
        source,
        provider: 'gemini',
        model: clean(details.model),
        file_name: clean(details.fileName),
        route_count: Number(details.routeCount || 0),
      },
    )
  } catch (error) {
    console.error('AI audit failed:', error?.message || error)
  }
}

export function aiErrorStatus(error) {
  const status = Number(error?.status)
  if (status === 400 || status === 401 || status === 403 || status === 413 || status === 429 || status === 503) return status
  if (status >= 400 && status < 500) return 502
  return 500
}
