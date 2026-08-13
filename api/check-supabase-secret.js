import { createClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'https://thxgmwxotqssbegdijpy.supabase.co'

function clean(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
}

function extractSupabaseUrl(value) {
  const cleaned = clean(value)
  const match = cleaned.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i)
  return match?.[0] || FALLBACK_SUPABASE_URL
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({
      ok: false,
      stage: 'method',
      message: 'Dozwolona jest tylko metoda GET.'
    })
  }

  const rawUrl = process.env.VITE_SUPABASE_URL
  const rawSecret = process.env.SUPABASE_SECRET_KEY

  const supabaseUrl = extractSupabaseUrl(rawUrl)
  const secretKey = clean(rawSecret)

  if (!secretKey) {
    return response.status(500).json({
      ok: false,
      stage: 'environment',
      checks: {
        urlPresent: Boolean(rawUrl),
        urlResolved: supabaseUrl,
        secretPresent: false,
        secretPrefixValid: false
      },
      message: 'Vercel nie udostępnił SUPABASE_SECRET_KEY tej funkcji.'
    })
  }

  if (!secretKey.startsWith('sb_secret_')) {
    return response.status(500).json({
      ok: false,
      stage: 'environment',
      checks: {
        urlPresent: Boolean(rawUrl),
        urlResolved: supabaseUrl,
        secretPresent: true,
        secretPrefixValid: false
      },
      message: 'SUPABASE_SECRET_KEY jest obecny, ale nie zaczyna się od sb_secret_.'
    })
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1
    })

    if (error) {
      return response.status(500).json({
        ok: false,
        stage: 'supabase-admin',
        checks: {
          urlPresent: Boolean(rawUrl),
          urlResolved: supabaseUrl,
          secretPresent: true,
          secretPrefixValid: true
        },
        supabaseError: {
          message: error.message || 'Nieznany błąd Supabase',
          status: error.status || null,
          code: error.code || null
        },
        message: 'Vercel odczytał sekret, ale Supabase odrzucił operację administracyjną.'
      })
    }

    return response.status(200).json({
      ok: true,
      stage: 'complete',
      checks: {
        urlPresent: Boolean(rawUrl),
        urlResolved: supabaseUrl,
        secretPresent: true,
        secretPrefixValid: true,
        adminRequestSucceeded: true
      },
      usersReturned: Array.isArray(data?.users) ? data.users.length : 0,
      message: 'Połączenie administracyjne Vercel → Supabase działa prawidłowo.'
    })
  } catch (error) {
    return response.status(500).json({
      ok: false,
      stage: 'exception',
      checks: {
        urlPresent: Boolean(rawUrl),
        urlResolved: supabaseUrl,
        secretPresent: true,
        secretPrefixValid: true
      },
      error: {
        name: error?.name || 'Error',
        message: error?.message || 'Nieznany wyjątek'
      },
      message: 'Funkcja napotkała wyjątek podczas tworzenia klienta lub wywołania Supabase.'
    })
  }
}
