import { parseJsonBody } from '../server/admin.js'
import {
  aiErrorStatus,
  auditAiAnalysis,
  requireAiUser,
  runStructuredExtraction,
} from '../server/ai-analyzer.js'

export const maxDuration = 60

const MAX_SOURCE_LENGTH = 180000
const MAX_ITEMS = 300

function clean(value) {
  return String(value ?? '').trim()
}

function stringField() {
  return { type: 'string' }
}

function numberField() {
  return { type: 'number' }
}

function confidenceField() {
  return { type: 'number', minimum: 0, maximum: 1 }
}

function booleanField() {
  return { type: 'boolean' }
}

function clientItemSchema() {
  return {
    type: 'object',
    properties: {
      sourceRow: numberField(),
      name: stringField(),
      address: stringField(),
      postalCode: stringField(),
      city: stringField(),
      nip: stringField(),
      cargoTypes: stringField(),
      businessType: stringField(),
      dispatcher: stringField(),
      lat: numberField(),
      lng: numberField(),
      approximate: booleanField(),
      qualityRating: numberField(),
      paymentDays: numberField(),
      cooperationNotes: stringField(),
      lastContactAt: stringField(),
      confidence: confidenceField(),
    },
    required: [
      'sourceRow', 'name', 'address', 'postalCode', 'city', 'nip', 'cargoTypes',
      'businessType', 'dispatcher', 'lat', 'lng', 'approximate', 'qualityRating',
      'paymentDays', 'cooperationNotes', 'lastContactAt', 'confidence',
    ],
    additionalProperties: false,
  }
}

function vehicleItemSchema() {
  return {
    type: 'object',
    properties: {
      sourceRow: numberField(),
      carrierName: stringField(),
      driverName: stringField(),
      phone: stringField(),
      nationality: stringField(),
      baseLocation: stringField(),
      vehicleRegistrationNo: stringField(),
      vehicleBrand: stringField(),
      trailerRegistrationNo: stringField(),
      trailerHeightM: numberField(),
      dispatcher: stringField(),
      hidden: booleanField(),
      confidence: confidenceField(),
    },
    required: [
      'sourceRow', 'carrierName', 'driverName', 'phone', 'nationality',
      'baseLocation', 'vehicleRegistrationNo', 'vehicleBrand',
      'trailerRegistrationNo', 'trailerHeightM', 'dispatcher', 'hidden', 'confidence',
    ],
    additionalProperties: false,
  }
}

function relationItemSchema() {
  return {
    type: 'object',
    properties: {
      sourceRow: numberField(),
      date: stringField(),
      loadDate: stringField(),
      loadTime: stringField(),
      load: stringField(),
      loadAddress: stringField(),
      unloadDate: stringField(),
      unloadTime: stringField(),
      unload: stringField(),
      unloadAddress: stringField(),
      client: stringField(),
      reference: stringField(),
      dispatcher: stringField(),
      rate: numberField(),
      cost: numberField(),
      loadedKm: numberField(),
      approachKm: numberField(),
      baseKm: numberField(),
      notes: stringField(),
      confidence: confidenceField(),
    },
    required: [
      'sourceRow', 'date', 'loadDate', 'loadTime', 'load', 'loadAddress',
      'unloadDate', 'unloadTime', 'unload', 'unloadAddress', 'client',
      'reference', 'dispatcher', 'rate', 'cost', 'loadedKm', 'approachKm',
      'baseKm', 'notes', 'confidence',
    ],
    additionalProperties: false,
  }
}

function kindConfiguration(kind) {
  if (kind === 'clients') {
    return {
      itemSchema: clientItemSchema(),
      noun: 'klientów',
      instructions: [
        'Rozpoznaj rekordy klientów i lokalizacji z dowolnej tabeli, CSV, listy lub tekstu.',
        'Każda fizyczna lokalizacja klienta ma być osobnym rekordem.',
        'Nie zgaduj NIP, współrzędnych, opiekuna, oceny ani terminu płatności.',
        'Jeżeli współrzędnych nie ma w źródle, zwróć lat=0 i lng=0; aplikacja spróbuje ustalić je lokalnie z kodu pocztowego lub miejscowości.',
        'Jeżeli adres składa się tylko z kodu i miejscowości, zachowaj taki adres.',
        'qualityRating zwróć 0, jeżeli źródło nie zawiera oceny; paymentDays zwróć 0, jeżeli źródło nie zawiera terminu.',
      ].join(' '),
    }
  }
  if (kind === 'vehicles') {
    return {
      itemSchema: vehicleItemSchema(),
      noun: 'pojazdów',
      instructions: [
        'Rozpoznaj flotę transportową. Jeden rekord ma opisywać jeden aktywny zestaw kierowca + ciągnik + opcjonalna naczepa + przewoźnik.',
        'Nie wymyślaj numerów rejestracyjnych, telefonu, narodowości ani spedytora.',
        'Numery rejestracyjne zwracaj bez zmiany treści poza usunięciem zbędnych spacji na początku i końcu.',
        'trailerHeightM zwróć 0, jeżeli wysokość nie występuje w źródle. nationality zwróć pusty string, jeżeli brak danych.',
      ].join(' '),
    }
  }
  return {
    itemSchema: relationItemSchema(),
    noun: 'relacji',
    instructions: [
      'Rozpoznaj relacje/ładunki transportowe. Każdy niezależny załadunek -> rozładunek ma być osobnym rekordem.',
      'Daty normalizuj do YYYY-MM-DD, godziny do HH:MM.',
      'Nie zgaduj stawek, kosztów ani kilometrów. Brakującą liczbę zwróć jako 0.',
      'Nie łącz kilku relacji w jeden rekord. Jeżeli źródło zawiera kilka wierszy, zachowaj ich rozdzielenie.',
      'W polu load/unload podaj możliwie krótki opis lokalizacji, a pełniejsze dane ulicy/numeru w loadAddress/unloadAddress.',
    ].join(' '),
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ ok: false, message: 'Dozwolona jest wyłącznie metoda POST.' })
  }

  try {
    const auth = await requireAiUser(request)
    if (!auth.ok) return response.status(auth.status).json({ ok: false, message: auth.message })
    if (String(auth.profile?.role || '') !== 'admin') {
      return response.status(403).json({ ok: false, message: 'Import danych przez AI jest dostępny wyłącznie dla administratora.' })
    }

    const body = parseJsonBody(request)
    const kindRaw = clean(body?.kind).toLowerCase()
    const kind = ['clients', 'vehicles', 'relations'].includes(kindRaw) ? kindRaw : ''
    const sourceText = clean(body?.sourceText)
    const sourceName = clean(body?.sourceName)
    const referenceDate = clean(body?.referenceDate)

    if (!kind) return response.status(400).json({ ok: false, message: 'Nieprawidłowy typ importu AI.' })
    if (!sourceText) return response.status(400).json({ ok: false, message: 'Brak danych do analizy.' })
    if (sourceText.length > MAX_SOURCE_LENGTH) {
      return response.status(413).json({ ok: false, message: `Materiał jest zbyt duży. Maksymalnie ${MAX_SOURCE_LENGTH} znaków na jedną analizę.` })
    }

    const config = kindConfiguration(kind)
    const schema = {
      type: 'object',
      properties: {
        items: { type: 'array', maxItems: MAX_ITEMS, items: config.itemSchema },
        warnings: { type: 'array', items: { type: 'string' } },
      },
      required: ['items', 'warnings'],
      additionalProperties: false,
    }

    const commonInstructions = [
      `Jesteś modułem importu danych systemu transportowego Top Dragon TMS. Analizujesz ${config.noun}.`,
      'Źródło może mieć błędne nagłówki, przesunięte kolumny, skróty, literówki i puste komórki.',
      'Wartości arkuszowych błędów #REF!, #N/A, #VALUE!, #NAME?, #DIV/0!, #NUM! i #NULL! traktuj zawsze jako brak danych, nigdy jako rzeczywistą wartość.',
      'Zwróć tylko informacje wynikające ze źródła. Nie twórz fikcyjnych rekordów ani danych.',
      'sourceRow to 1-based numer wiersza danych, a dla tekstu bez tabeli kolejny numer rekordu.',
      'confidence ma być liczbą od 0 do 1.',
      'Jeżeli rekord jest nieczytelny, pomiń go i opisz problem w warnings.',
      `Nie zwracaj więcej niż ${MAX_ITEMS} rekordów.`,
      referenceDate ? `Datą odniesienia jest ${referenceDate}.` : '',
      config.instructions,
    ].filter(Boolean).join(' ')

    const { data, model, elapsedMs } = await runStructuredExtraction({
      schema,
      instructions: commonInstructions,
      parts: [{ text: `ŹRÓDŁO: ${sourceName || 'dane wklejone przez administratora'}\n\n${sourceText}` }],
      timeoutMs: 55000,
    })

    const rawItems = Array.isArray(data?.items) ? data.items.slice(0, MAX_ITEMS) : []
    const errorTokens = new Set(['#REF!', '#N/A', '#VALUE!', '#NAME?', '#DIV/0!', '#NUM!', '#NULL!'])
    const scrub = (value) => {
      const text = clean(value)
      return errorTokens.has(text.toUpperCase()) ? '' : text
    }
    const items = rawItems.map((item) => {
      const copy = { ...(item || {}) }
      Object.keys(copy).forEach((key) => {
        if (typeof copy[key] === 'string') copy[key] = scrub(copy[key])
      })
      copy.confidence = Math.max(0, Math.min(1, Number(copy.confidence || 0)))
      return copy
    })
    const warnings = Array.isArray(data?.warnings) ? data.warnings.map(scrub).filter(Boolean) : []
    await auditAiAnalysis(auth, `admin_import_${kind}`, {
      model,
      fileName: sourceName,
      routeCount: items.length,
      elapsedMs,
    })

    return response.status(200).json({ ok: true, kind, items, warnings, model, elapsedMs })
  } catch (error) {
    return response.status(aiErrorStatus(error)).json({
      ok: false,
      message: String(error?.message || 'Nie udało się przeanalizować danych do importu.'),
    })
  }
}
