import { createClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'https://thxgmwxotqssbegdijpy.supabase.co'
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_SVrzYBeqaUXOXd0JzFfwgQ_BSJrE1N4'

function cleanEnvironmentValue(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .split(/\s+/)[0]
}

function isValidSupabaseUrl(value) {
  if (!value || value.includes('YOUR_PROJECT')) return false

  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.supabase.co')
    )
  } catch {
    return false
  }
}

function isValidPublishableKey(value) {
  return Boolean(
    value &&
      !value.includes('REPLACE_ME') &&
      value.startsWith('sb_publishable_')
  )
}

const environmentUrl = cleanEnvironmentValue(
  import.meta.env.VITE_SUPABASE_URL
)
const environmentPublishableKey = cleanEnvironmentValue(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

export const supabaseUrl = isValidSupabaseUrl(environmentUrl)
  ? environmentUrl
  : FALLBACK_SUPABASE_URL

export const supabasePublishableKey =
  isValidPublishableKey(environmentPublishableKey)
    ? environmentPublishableKey
    : FALLBACK_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
