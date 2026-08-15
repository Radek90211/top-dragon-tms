import { parseJsonBody, requireActiveUser } from '../server/admin.js'

const TOMTOM_BASE = 'https://api.tomtom.com'
const MAX_ROUTE_POINTS = 12
const MAX_MATRIX_DESTINATIONS = 100

function clean(value) {
  return String(value ?? '').trim().replace(/^['"]|['"]$/g, '')
}

function finiteCoordinate(point) {
  const lat = Number(point?.lat ?? point?.latitude)
  const lng = Number(point?.lng ?? point?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function errorMessage(data, fallback) {
  return clean(
    data?.detailedError?.message
    || data?.error?.description
    || data?.error?.message
    || data?.message
    || fallback
  )
}

async function readJson(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { message: text }
  }
}

function routingKey() {
  return clean(process.env.TOMTOM_API_KEY)
}

async function calculateTruckRoute(apiKey, points) {
  const path = points.map((point) => `${point.lat},${point.lng}`).join(':')
  const url = new URL(`${TOMTOM_BASE}/routing/1/calculateRoute/${path}/json`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('routeType', 'fastest')
  url.searchParams.set('traffic', 'false')
  url.searchParams.set('travelMode', 'truck')
  url.searchParams.set('vehicleCommercial', 'true')
  url.searchParams.set('routeRepresentation', 'polyline')
  url.searchParams.set('computeTravelTimeFor', 'all')

  const upstream = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson(upstream)

  if (!upstream.ok) {
    const error = new Error(errorMessage(data, `TomTom Routing HTTP ${upstream.status}`))
    error.status = upstream.status
    throw error
  }

  const route = Array.isArray(data?.routes) ? data.routes[0] : null
  const summary = route?.summary || {}
  if (!route || !Number.isFinite(Number(summary.lengthInMeters)) || !Number.isFinite(Number(summary.travelTimeInSeconds))) {
    throw new Error('TomTom nie zwrócił prawidłowego wariantu trasy ciężarowej.')
  }

  const latLngs = []
  for (const leg of Array.isArray(route.legs) ? route.legs : []) {
    for (const point of Array.isArray(leg?.points) ? leg.points : []) {
      const lat = Number(point?.latitude)
      const lng = Number(point?.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const last = latLngs[latLngs.length - 1]
      if (last && last[0] === lat && last[1] === lng) continue
      latLngs.push([lat, lng])
    }
  }

  return {
    ok: true,
    source: 'tomtom-truck',
    profile: 'category-c-generic',
    distanceKm: Number(summary.lengthInMeters) / 1000,
    durationMin: Number(summary.travelTimeInSeconds) / 60,
    latLngs,
  }
}

async function calculateTruckMatrix(apiKey, origin, destinations) {
  const url = new URL(`${TOMTOM_BASE}/routing/matrix/2`)
  url.searchParams.set('key', apiKey)

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      origins: [{ point: { latitude: origin.lat, longitude: origin.lng } }],
      destinations: destinations.map((point) => ({
        point: { latitude: point.lat, longitude: point.lng },
      })),
      options: {
        departAt: 'any',
        traffic: 'historical',
        routeType: 'fastest',
        travelMode: 'truck',
        vehicleCommercial: true,
      },
    }),
  })

  const data = await readJson(upstream)
  if (!upstream.ok) {
    const error = new Error(errorMessage(data, `TomTom Matrix HTTP ${upstream.status}`))
    error.status = upstream.status
    throw error
  }

  const byIndex = new Map()
  for (const cell of Array.isArray(data?.data) ? data.data : []) {
    if (Number(cell?.originIndex) !== 0) continue
    const destinationIndex = Number(cell?.destinationIndex)
    if (!Number.isInteger(destinationIndex) || destinationIndex < 0) continue
    const summary = cell?.routeSummary
    if (summary && Number.isFinite(Number(summary.lengthInMeters)) && Number.isFinite(Number(summary.travelTimeInSeconds))) {
      byIndex.set(destinationIndex, {
        ok: true,
        distanceKm: Number(summary.lengthInMeters) / 1000,
        durationMin: Number(summary.travelTimeInSeconds) / 60,
      })
    } else {
      byIndex.set(destinationIndex, {
        ok: false,
        message: errorMessage(cell, 'Nie udało się wyznaczyć trasy ciężarowej.'),
      })
    }
  }

  return {
    ok: true,
    source: 'tomtom-truck-matrix',
    profile: 'category-c-generic',
    results: destinations.map((_, index) => byIndex.get(index) || ({
      ok: false,
      message: 'Brak wyniku dla tego celu.',
    })),
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ ok: false, message: 'Dozwolona jest wyłącznie metoda POST.' })
  }

  try {
    const auth = await requireActiveUser(request)
    if (!auth.ok) {
      return response.status(auth.status).json({ ok: false, message: auth.message })
    }

    const apiKey = routingKey()
    if (!apiKey) {
      return response.status(503).json({
        ok: false,
        message: 'Brak TOMTOM_API_KEY w zmiennych środowiskowych Vercel.',
      })
    }

    const body = parseJsonBody(request)
    const mode = clean(body.mode).toLowerCase()

    if (mode === 'route') {
      const points = (Array.isArray(body.points) ? body.points : []).map(finiteCoordinate).filter(Boolean)
      if (points.length < 2 || points.length > MAX_ROUTE_POINTS) {
        return response.status(400).json({ ok: false, message: `Trasa musi zawierać od 2 do ${MAX_ROUTE_POINTS} punktów.` })
      }
      const result = await calculateTruckRoute(apiKey, points)
      return response.status(200).json(result)
    }

    if (mode === 'matrix') {
      const origin = finiteCoordinate(body.origin)
      const destinations = (Array.isArray(body.destinations) ? body.destinations : []).map(finiteCoordinate).filter(Boolean)
      if (!origin) {
        return response.status(400).json({ ok: false, message: 'Brak prawidłowego punktu początkowego.' })
      }
      if (!destinations.length || destinations.length > MAX_MATRIX_DESTINATIONS) {
        return response.status(400).json({ ok: false, message: `Macierz może zawierać od 1 do ${MAX_MATRIX_DESTINATIONS} celów.` })
      }
      const result = await calculateTruckMatrix(apiKey, origin, destinations)
      return response.status(200).json(result)
    }

    return response.status(400).json({ ok: false, message: 'Nieobsługiwany tryb routingu.' })
  } catch (error) {
    const upstreamStatus = Number(error?.status)
    const status = upstreamStatus === 403 || upstreamStatus === 429 ? 502 : 500
    return response.status(status).json({
      ok: false,
      message: clean(error?.message) || 'Nie udało się wyznaczyć trasy ciężarowej.',
    })
  }
}
