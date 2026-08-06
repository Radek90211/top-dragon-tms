import { createClient } from '@supabase/supabase-js'

// Vercel/Vite pozostają podstawowym źródłem konfiguracji.
// Wartości zapasowe są publicznym adresem projektu i publicznym kluczem
// publishable, więc mogą znajdować się w kodzie aplikacji przeglądarkowej.
const fallbackSupabaseUrl = 'https://thxgmwxotqssbegdijpy.supabase.co'
const fallbackSupabasePublishableKey = 'sb_publishable_SVrzYBeqaUXOXd0JzFfwgQ_BSJrE1N4'

export const supabaseUrl =
  String(import.meta.env.VITE_SUPABASE_URL || '').trim() || fallbackSupabaseUrl

export const supabasePublishableKey =
  String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim() ||
  fallbackSupabasePublishableKey

if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  throw new Error('Nieprawidłowy adres projektu Supabase.')
}

if (!supabasePublishableKey.startsWith('sb_publishable_')) {
  throw new Error('Nieprawidłowy klucz publishable Supabase.')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
