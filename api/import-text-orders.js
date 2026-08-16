import { parseJsonBody } from '../server/admin.js'
import {
  aiErrorStatus,
  analyzerInstructions,
  auditAiAnalysis,
  requireAiUser,
  routeSchema,
  runStructuredExtraction,
} from '../server/ai-analyzer.js'

export const maxDuration = 60

const MAX_TEXT_LENGTH = 60000

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ ok: false, message: 'Dozwolona jest wyłącznie metoda POST.' })
  }

  try {
    const auth = await requireAiUser(request)
    if (!auth.ok) return response.status(auth.status).json({ ok: false, message: auth.message })

    const body = parseJsonBody(request)
    const text = String(body?.text || '').trim()
    const referenceDate = String(body?.date || '').trim()
    if (!text) return response.status(400).json({ ok: false, message: 'Brak tekstu do analizy.' })
    if (text.length > MAX_TEXT_LENGTH) {
      return response.status(413).json({ ok: false, message: `Wiadomość jest zbyt długa. Maksymalnie ${MAX_TEXT_LENGTH} znaków.` })
    }

    const schema = {
      type: 'object',
      properties: {
        routes: { type: 'array', items: routeSchema() },
        warnings: { type: 'array', items: { type: 'string' } },
      },
      required: ['routes', 'warnings'],
      additionalProperties: false,
    }

    const arrowLineCount = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && /(?:->|→|=>|⟶)/.test(line))
      .length

    const countHint = arrowLineCount > 1
      ? ` W wiadomości wykryto ${arrowLineCount} osobnych wierszy z kierunkiem trasy. Jeżeli każdy opisuje własny załadunek i rozładunek, zwróć dokładnie ${arrowLineCount} osobnych elementów routes.`
      : ''

    const { data, model } = await runStructuredExtraction({
      schema,
      instructions: `${analyzerInstructions(referenceDate)} Wiadomość może zawierać jedną lub wiele niezależnych relacji. Zwróć osobny element routes dla KAŻDEJ relacji transportowej. Nie łącz kilku pozycji klienta w jedną relację i nie pomijaj kolejnych pozycji.${countHint}`,
      parts: [{ text: `Przeanalizuj wszystkie relacje z wiadomości klienta. Zachowaj każdą osobną pozycję:\n\n${text}` }],
    })

    const routes = Array.isArray(data?.routes) ? data.routes : []
    await auditAiAnalysis(auth, 'text', { model, routeCount: routes.length })
    return response.status(200).json({ ok: true, routes, warnings: Array.isArray(data?.warnings) ? data.warnings : [], model })
  } catch (error) {
    return response.status(aiErrorStatus(error)).json({ ok: false, message: String(error?.message || 'Nie udało się przeanalizować wiadomości.') })
  }
}
