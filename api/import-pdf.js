import {
  aiErrorStatus,
  analyzerInstructions,
  auditAiAnalysis,
  requireAiUser,
  routeSchema,
  runStructuredExtraction,
} from '../server/ai-analyzer.js'

export const maxDuration = 60

const MAX_PDF_BYTES = 10 * 1024 * 1024

export const config = {
  api: {
    bodyParser: false,
  },
}

async function readRawBody(request) {
  if (Buffer.isBuffer(request.body)) return request.body
  if (request.body instanceof Uint8Array) return Buffer.from(request.body)
  if (request.body instanceof ArrayBuffer) return Buffer.from(request.body)
  if (typeof request.body === 'string' && request.body.length) return Buffer.from(request.body, 'binary')

  const chunks = []
  let total = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_PDF_BYTES) {
      const error = new Error('Plik PDF jest zbyt duży. Maksymalny rozmiar to 10 MB.')
      error.status = 413
      throw error
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

function decodeFileName(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'zlecenie.pdf'
  try {
    return decodeURIComponent(raw).replace(/[\\/\r\n]/g, '_').slice(0, 180) || 'zlecenie.pdf'
  } catch {
    return raw.replace(/[\\/\r\n]/g, '_').slice(0, 180) || 'zlecenie.pdf'
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ ok: false, message: 'Dozwolona jest wyłącznie metoda POST.' })
  }

  try {
    const auth = await requireAiUser(request)
    if (!auth.ok) return response.status(auth.status).json({ ok: false, message: auth.message })

    const contentType = String(request.headers?.['content-type'] || '').toLowerCase()
    if (!contentType.includes('application/pdf')) {
      return response.status(400).json({ ok: false, message: 'Analizator PDF przyjmuje wyłącznie pliki PDF.' })
    }

    const pdf = await readRawBody(request)
    if (!pdf.length) return response.status(400).json({ ok: false, message: 'Przesłany plik PDF jest pusty.' })
    if (pdf.length > MAX_PDF_BYTES) return response.status(413).json({ ok: false, message: 'Plik PDF jest zbyt duży. Maksymalny rozmiar to 10 MB.' })
    if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return response.status(400).json({ ok: false, message: 'Przesłany plik nie wygląda jak prawidłowy dokument PDF.' })
    }

    const fileName = decodeFileName(request.headers?.['x-file-name'])
    const referenceDate = String(request.headers?.['x-reference-date'] || '').trim()
    const fileData = pdf.toString('base64')

    const { data, model } = await runStructuredExtraction({
      schema: routeSchema(),
      instructions: `${analyzerInstructions(referenceDate)} Analizujesz pojedyncze zlecenie transportowe PDF. Jeżeli dokument zawiera kilka etapów tego samego przewozu, wybierz główny pierwszy załadunek i końcowy rozładunek, a pozostałe punkty opisz w notes.`,
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: fileData } },
        { text: `Plik: ${fileName}. Wyodrębnij dane zlecenia transportowego do podanego schematu. Nie wymyślaj brakujących danych.` },
      ],
    })

    await auditAiAnalysis(auth, 'pdf', { model, fileName, routeCount: 1 })
    return response.status(200).json({ ok: true, ...data, model })
  } catch (error) {
    return response.status(aiErrorStatus(error)).json({ ok: false, message: String(error?.message || 'Nie udało się przeanalizować PDF.') })
  }
}
