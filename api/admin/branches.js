import {
  normalizeText,
  parseJsonBody,
  requireActiveAdmin,
  writeAudit,
} from '../../server/admin.js'

export default async function handler(request, response) {
  try {
    const auth = await requireActiveAdmin(request)
    if (!auth.ok) {
      return response.status(auth.status).json({ ok: false, message: auth.message })
    }

    const { admin, user } = auth

    if (request.method === 'GET') {
      const { data, error } = await admin
        .from('branches')
        .select('id, name, active, created_at')
        .order('name', { ascending: true })

      if (error) {
        return response.status(500).json({ ok: false, message: error.message })
      }

      return response.status(200).json({ ok: true, branches: data || [] })
    }

    if (request.method === 'POST') {
      const body = parseJsonBody(request)
      const name = normalizeText(body.name)

      if (name.length < 2) {
        return response.status(400).json({ ok: false, message: 'Nazwa oddziału musi mieć co najmniej 2 znaki.' })
      }

      const { data, error } = await admin
        .from('branches')
        .insert({ name, active: true })
        .select('id, name, active, created_at')
        .single()

      if (error) {
        const duplicate = String(error.code) === '23505'
        return response.status(duplicate ? 409 : 500).json({
          ok: false,
          message: duplicate ? 'Oddział o takiej nazwie już istnieje.' : error.message,
        })
      }

      await writeAudit(admin, user.id, 'create', 'branch', data.id, null, data)
      return response.status(201).json({ ok: true, branch: data })
    }

    if (request.method === 'PATCH') {
      const body = parseJsonBody(request)
      const id = normalizeText(body.id)
      const patch = {}

      if (!id) {
        return response.status(400).json({ ok: false, message: 'Brak identyfikatora oddziału.' })
      }

      if ('name' in body) {
        const name = normalizeText(body.name)
        if (name.length < 2) {
          return response.status(400).json({ ok: false, message: 'Nazwa oddziału musi mieć co najmniej 2 znaki.' })
        }
        patch.name = name
      }

      if ('active' in body) {
        patch.active = Boolean(body.active)
      }

      if (!Object.keys(patch).length) {
        return response.status(400).json({ ok: false, message: 'Brak zmian do zapisania.' })
      }

      const { data: oldBranch, error: oldError } = await admin
        .from('branches')
        .select('id, name, active, created_at')
        .eq('id', id)
        .maybeSingle()

      if (oldError) {
        return response.status(500).json({ ok: false, message: oldError.message })
      }
      if (!oldBranch) {
        return response.status(404).json({ ok: false, message: 'Nie znaleziono oddziału.' })
      }

      if (patch.active === false) {
        const { count, error: countError } = await admin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('branch_id', id)
          .eq('active', true)

        if (countError) {
          return response.status(500).json({ ok: false, message: countError.message })
        }

        if ((count || 0) > 0) {
          return response.status(409).json({
            ok: false,
            message: 'Nie można dezaktywować oddziału, do którego są przypisani aktywni użytkownicy.',
          })
        }
      }

      const { data, error } = await admin
        .from('branches')
        .update(patch)
        .eq('id', id)
        .select('id, name, active, created_at')
        .single()

      if (error) {
        const duplicate = String(error.code) === '23505'
        return response.status(duplicate ? 409 : 500).json({
          ok: false,
          message: duplicate ? 'Oddział o takiej nazwie już istnieje.' : error.message,
        })
      }

      await writeAudit(admin, user.id, 'update', 'branch', id, oldBranch, data)
      return response.status(200).json({ ok: true, branch: data })
    }

    return response.status(405).json({ ok: false, message: 'Method not allowed' })
  } catch (error) {
    return response.status(500).json({
      ok: false,
      message: error?.message || 'Nie udało się wykonać operacji na oddziałach.',
    })
  }
}
