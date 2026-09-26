import { dbRequest } from '../lib/supabase.js';
import { requireAdmin } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { json, readJson, allowMethods, safeError } from '../lib/http.js';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['PATCH', 'DELETE'])) return;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = String(req.query?.id || '').trim();
    if (!id) return json(res, 400, { error: 'Brak identyfikatora zlecenia.' });

    if (req.method === 'DELETE') {
      await dbRequest('orders', { method: 'DELETE', query: { id: `eq.${id}` }, prefer: 'return=minimal' });
      await audit(admin, 'order.delete', 'order', id);
      return json(res, 200, { ok: true });
    }

    const body = await readJson(req);
    const current = await dbRequest('orders', { query: { select: '*', id: `eq.${id}`, limit: 1 } });
    if (!current?.[0]) return json(res, 404, { error: 'Nie znaleziono zlecenia.' });
    const allowed = {
      title: body.title,
      kanban_column_id: body.kanbanColumnId,
      event_start: body.eventStart,
      event_end: body.eventEnd,
      installation_start: body.installationStart,
      installation_end: body.installationEnd,
      teardown_start: body.teardownStart,
      teardown_end: body.teardownEnd,
      location: body.location,
      raw_inquiry: body.rawInquiry,
      details: body.details,
      budget_min: body.budgetMin,
      budget_max: body.budgetMax,
      priority: body.priority
    };
    if (body.customer?.name && (body.customer.email || body.customer.phone)) {
      if (current[0].customer_id) {
        await dbRequest('customers', {
          method: 'PATCH', query: { id: `eq.${current[0].customer_id}` },
          body: {
            name: String(body.customer.name).trim(),
            email: body.customer.email ? String(body.customer.email).trim() : null,
            phone: body.customer.phone ? String(body.customer.phone).trim() : null,
            updated_at: new Date().toISOString()
          }, prefer: 'return=minimal'
        });
      } else {
        const customers = await dbRequest('customers', {
          method: 'POST', body: {
            name: String(body.customer.name).trim(),
            email: body.customer.email ? String(body.customer.email).trim() : null,
            phone: body.customer.phone ? String(body.customer.phone).trim() : null
          }
        });
        allowed.customer_id = customers?.[0]?.id || null;
      }
    }
    Object.keys(allowed).forEach(key => allowed[key] === undefined && delete allowed[key]);
    allowed.updated_at = new Date().toISOString();

    const updated = await dbRequest('orders', {
      method: 'PATCH',
      query: { id: `eq.${id}` },
      body: allowed
    });

    if (body.kanbanColumnId && body.kanbanColumnId !== current[0].kanban_column_id) {
      await dbRequest('order_status_history', {
        method: 'POST',
        body: {
          order_id: id,
          from_column_id: current[0].kanban_column_id,
          to_column_id: body.kanbanColumnId,
          changed_by: admin.id,
          note: body.statusNote || null
        },
        prefer: 'return=minimal'
      });
    }
    await audit(admin, 'order.update', 'order', id, allowed);
    return json(res, 200, { order: updated?.[0] });
  } catch (error) {
    return safeError(res, error);
  }
};
