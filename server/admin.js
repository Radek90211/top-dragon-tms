import { createClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'https://thxgmwxotqssbegdijpy.supabase.co'

function clean(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
}

function resolveSupabaseUrl() {
  const candidate = clean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)
  const match = candidate.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i)
  return match?.[0] || FALLBACK_SUPABASE_URL
}

function resolveSecretKey() {
  return clean(process.env.SUPABASE_SECRET_KEY)
}

export function getAdminClient() {
  const url = resolveSupabaseUrl()
  const secretKey = resolveSecretKey()

  if (!secretKey || !secretKey.startsWith('sb_secret_')) {
    throw new Error('Brak poprawnego SUPABASE_SECRET_KEY po stronie Vercel.')
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

export function getBearerToken(request) {
  const header = String(request.headers?.authorization || '')
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

export async function requireActiveAdmin(request) {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false, status: 401, message: 'Brak tokenu użytkownika.' }
  }

  const admin = getAdminClient()
  const { data: authData, error: authError } = await admin.auth.getUser(token)

  if (authError || !authData?.user) {
    return { ok: false, status: 401, message: 'Sesja użytkownika jest nieprawidłowa lub wygasła.' }
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, display_name, role, active, branch_id')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false, status: 500, message: `Nie udało się sprawdzić profilu administratora: ${profileError.message}` }
  }

  if (!profile?.active || profile.role !== 'admin') {
    return { ok: false, status: 403, message: 'Ta operacja jest dostępna wyłącznie dla aktywnego administratora.' }
  }

  return {
    ok: true,
    admin,
    user: authData.user,
    profile,
  }
}

export function parseJsonBody(request) {
  if (!request.body) return {}
  if (typeof request.body === 'object') return request.body

  try {
    return JSON.parse(request.body)
  } catch {
    return {}
  }
}

export async function writeAudit(admin, actorId, action, entityType, entityId, oldData = null, newData = null) {
  const { error } = await admin.from('operation_audit').insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    old_data: oldData,
    new_data: newData,
  })

  if (error) {
    console.error('Audit write failed:', error.message)
  }
}

export function normalizeText(value) {
  return String(value ?? '').trim()
}
