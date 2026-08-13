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


    if (request.method === 'DELETE') {
      const body = parseJsonBody(request)
      const id = normalizeText(body.id)

      if (!id) {
        return response.status(400).json({ ok: false, message: 'Brak identyfikatora oddziału.' })
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

      const referenceTables = [
        ['profiles', 'użytkownicy'],
        ['carriers', 'przewoźnicy'],
        ['drivers', 'kierowcy'],
        ['vehicles', 'pojazdy'],
        ['trailers', 'naczepy'],
        ['fleet_assignments', 'zestawy'],
        ['fleet_relation_usage', 'historia relacji'],
      ]

      const referenceChecks = await Promise.all(
        referenceTables.map(async ([table, label]) => {
          const { count, error } = await admin
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', id)

          if (error) throw error
          return { table, label, count: count || 0 }
        })
      )

      const usedBy = referenceChecks.filter((item) => item.count > 0)

      if (usedBy.length) {
        return response.status(409).json({
          ok: false,
          message: `Nie można usunąć oddziału „${oldBranch.name}”, ponieważ jest już używany (${usedBy.map((item) => `${item.label}: ${item.count}`).join(', ')}). Użyj opcji „Dezaktywuj”, aby zachować historię.`,
        })
      }

      const { error: deleteError } = await admin
        .from('branches')
        .delete()
        .eq('id', id)

      if (deleteError) {
        return response.status(500).json({ ok: false, message: deleteError.message })
      }

      await writeAudit(admin, user.id, 'delete', 'branch', id, oldBranch, null)
      return response.status(200).json({
        ok: true,
        message: `Oddział „${oldBranch.name}” został trwale usunięty.`,
        id,
      })
    }

    return response.status(405).json({ ok: false, message: 'Method not allowed' })
  } catch (error) {
    return response.status(500).json({
      ok: false,
      message: error?.message || 'Nie udało się wykonać operacji na oddziałach.',
    })
  }
}
