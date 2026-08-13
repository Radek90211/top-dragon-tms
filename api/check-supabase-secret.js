import { createClient } from '@supabase/supabase-js'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').trim()
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || '').trim()

  if (!supabaseUrl || !secretKey) {
    return response.status(500).json({
      ok: false,
      message: 'Brakuje VITE_SUPABASE_URL lub SUPABASE_SECRET_KEY w środowisku Production.'
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

    const { error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1
    })

    if (error) {
      return response.status(500).json({
        ok: false,
        message: 'Klucz został odczytany przez Vercel, ale Supabase odrzucił operację administracyjną.'
      })
    }

    return response.status(200).json({
      ok: true,
      message: 'Połączenie administracyjne Vercel → Supabase działa prawidłowo.'
    })
  } catch {
    return response.status(500).json({
      ok: false,
      message: 'Nie udało się połączyć z Supabase.'
    })
  }
}
