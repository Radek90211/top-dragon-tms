import {
  normalizeText,
  parseJsonBody,
  requireActiveAdmin,
  writeAudit,
} from '../../server/admin.js'

const ALLOWED_ROLES = new Set(['dispatcher', 'branch_manager', 'accounting'])
const DEFAULT_UI_COLOR = '#D9F99D'

function normalizeUiColor(value) {
  const color = normalizeText(value).toUpperCase()
  return /^#[0-9A-F]{6}$/.test(color) ? color : ''
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function getActiveBranch(admin, branchId) {
  const { data, error } = await admin
    .from('branches')
    .select('id, name, active')
    .eq('id', branchId)
    .maybeSingle()

  if (error) throw error
  return data?.active ? data : null
}

async function loadUsers(admin) {
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (authError) throw authError

  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, display_name, role, branch_id, active, ui_color, created_at, updated_at, branch:branches(id,name,active)')
    .order('display_name', { ascending: true })

  if (profileError) throw profileError

  const authById = new Map((authData?.users || []).map((item) => [item.id, item]))

  return (profiles || []).map((profile) => {
    const authUser = authById.get(profile.id)
    return {
      ...profile,
      email: authUser?.email || '',
      invitedAt: authUser?.invited_at || null,
      lastSignInAt: authUser?.last_sign_in_at || null,
    }
  })
}

export default async function handler(request, response) {
  try {
    const auth = await requireActiveAdmin(request)
    if (!auth.ok) {
      return response.status(auth.status).json({ ok: false, message: auth.message })
    }

    const { admin, user } = auth

    if (request.method === 'GET') {
      const users = await loadUsers(admin)
      return response.status(200).json({ ok: true, users })
    }

    if (request.method === 'POST') {
      const body = parseJsonBody(request)
      const email = normalizeText(body.email).toLowerCase()
      const displayName = normalizeText(body.displayName)
      const role = normalizeText(body.role)
      const branchId = normalizeText(body.branchId)
      const uiColor = normalizeUiColor(body.uiColor) || DEFAULT_UI_COLOR

      if (!validEmail(email)) {
        return response.status(400).json({ ok: false, message: 'Podaj prawidłowy adres e-mail.' })
      }
      if (displayName.length < 2) {
        return response.status(400).json({ ok: false, message: 'Nazwa użytkownika musi mieć co najmniej 2 znaki.' })
      }
      if (!ALLOWED_ROLES.has(role)) {
        return response.status(400).json({ ok: false, message: 'Nieprawidłowa rola użytkownika.' })
      }
      if (!branchId) {
        return response.status(400).json({ ok: false, message: 'Wybierz oddział użytkownika.' })
      }

      const branch = await getActiveBranch(admin, branchId)
      if (!branch) {
        return response.status(400).json({ ok: false, message: 'Wybrany oddział nie istnieje albo jest nieaktywny.' })
      }

      const redirectTo = normalizeText(process.env.APP_URL) || 'https://topdragon.dyspiqon.pl'

      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          display_name: displayName,
          onboarding_required: true,
        },
        redirectTo,
      })

      if (inviteError || !inviteData?.user) {
        return response.status(409).json({
          ok: false,
          message: inviteError?.message || 'Nie udało się utworzyć zaproszenia.',
        })
      }

      const invitedUser = inviteData.user

      const profilePayload = {
        id: invitedUser.id,
        display_name: displayName,
        role,
        branch_id: branchId,
        active: true,
        ui_color: uiColor,
        updated_at: new Date().toISOString(),
      }

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' })
        .select('id, display_name, role, branch_id, active, ui_color, created_at, updated_at')
        .single()

      if (profileError) {
        await admin.auth.admin.deleteUser(invitedUser.id)
        return response.status(500).json({
          ok: false,
          message: `Zaproszenie zostało cofnięte, ponieważ nie udało się utworzyć profilu: ${profileError.message}`,
        })
      }

      await writeAudit(admin, user.id, 'invite', 'profile', invitedUser.id, null, {
        ...profile,
        email,
        branch_name: branch.name,
      })

      return response.status(201).json({
        ok: true,
        message: 'Użytkownik został zaproszony. Na podany adres e-mail wysłano link aktywacyjny.',
        user: {
          ...profile,
          email,
          branch,
        },
      })
    }

    if (request.method === 'PATCH') {
      const body = parseJsonBody(request)
      const userId = normalizeText(body.userId)

      if (!userId) {
        return response.status(400).json({ ok: false, message: 'Brak identyfikatora użytkownika.' })
      }

      const { data: oldProfile, error: oldProfileError } = await admin
        .from('profiles')
        .select('id, display_name, role, branch_id, active, ui_color, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle()

      if (oldProfileError) {
        return response.status(500).json({ ok: false, message: oldProfileError.message })
      }
      if (!oldProfile) {
        return response.status(404).json({ ok: false, message: 'Nie znaleziono profilu użytkownika.' })
      }
      if (oldProfile.role === 'admin') {
        return response.status(403).json({
          ok: false,
          message: 'Konta administratora nie są edytowane w tym panelu.',
        })
      }

      const patch = {}

      if ('displayName' in body) {
        const displayName = normalizeText(body.displayName)
        if (displayName.length < 2) {
          return response.status(400).json({ ok: false, message: 'Nazwa użytkownika musi mieć co najmniej 2 znaki.' })
        }
        patch.display_name = displayName
      }

      if ('role' in body) {
        const role = normalizeText(body.role)
        if (!ALLOWED_ROLES.has(role)) {
          return response.status(400).json({ ok: false, message: 'Nieprawidłowa rola użytkownika.' })
        }
        patch.role = role
      }

      if ('branchId' in body) {
        const branchId = normalizeText(body.branchId)
        const branch = await getActiveBranch(admin, branchId)
        if (!branch) {
          return response.status(400).json({ ok: false, message: 'Wybrany oddział nie istnieje albo jest nieaktywny.' })
        }
        patch.branch_id = branchId
      }

      if ('uiColor' in body) {
        const uiColor = normalizeUiColor(body.uiColor)
        if (!uiColor) {
          return response.status(400).json({ ok: false, message: 'Wybierz prawidłowy kolor użytkownika.' })
        }
        patch.ui_color = uiColor
      }

      if ('active' in body) {
        patch.active = Boolean(body.active)
      }

      if (!Object.keys(patch).length) {
        return response.status(400).json({ ok: false, message: 'Brak zmian do zapisania.' })
      }

      patch.updated_at = new Date().toISOString()

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .update(patch)
        .eq('id', userId)
        .select('id, display_name, role, branch_id, active, ui_color, created_at, updated_at')
        .single()

      if (profileError) {
        return response.status(500).json({ ok: false, message: profileError.message })
      }

      if (patch.display_name) {
        await admin.auth.admin.updateUserById(userId, {
          user_metadata: {
            display_name: patch.display_name,
          },
        })
      }

      await writeAudit(admin, user.id, 'update', 'profile', userId, oldProfile, profile)
      return response.status(200).json({ ok: true, user: profile })
    }

    return response.status(405).json({ ok: false, message: 'Method not allowed' })
  } catch (error) {
    return response.status(500).json({
      ok: false,
      message: error?.message || 'Nie udało się wykonać operacji na użytkownikach.',
    })
  }
}
