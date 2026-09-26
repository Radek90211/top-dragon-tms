import { dbRequest } from '../lib/supabase.js';
import { requireAdmin } from '../lib/auth.js';
import { json, readJson, allowMethods, safeError } from '../lib/http.js';
import { audit } from '../lib/audit.js';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'PATCH'])) return;
  try {
    const admin = await requireAdmin(req, res); if (!admin) return;
    const orderId = String(req.query?.orderId || '');
    if (!orderId) return json(res, 400, { error: 'Brak identyfikatora zlecenia.' });
    if (req.method === 'GET') {
      const [purchases, steps] = await Promise.all([
        dbRequest('order_purchase_items', { query: { select: '*', order_id: `eq.${orderId}`, order: 'created_at.asc' } }),
        dbRequest('order_build_steps', { query: { select: '*', order_id: `eq.${orderId}`, order: 'position.asc' } })
      ]);
      return json(res, 200, { purchases, steps });
    }
    const body = await readJson(req);
    if (body.purchaseItemId) {
      if (!['needed', 'ordered', 'purchased'].includes(body.status)) return json(res, 400, { error: 'Nieprawidłowy status zakupu.' });
      const updated = await dbRequest('order_purchase_items', { method: 'PATCH', query: { id: `eq.${body.purchaseItemId}`, order_id: `eq.${orderId}` }, body: { status: body.status, updated_at: new Date().toISOString() } });
      await audit(admin, 'purchase.status', 'order_purchase_item', body.purchaseItemId, { orderId, status: body.status });
      return json(res, 200, { purchase: updated?.[0] });
    }
    if (body.stepId) {
      const updated = await dbRequest('order_build_steps', { method: 'PATCH', query: { id: `eq.${body.stepId}`, order_id: `eq.${orderId}` }, body: { completed: Boolean(body.completed), updated_at: new Date().toISOString() } });
      await audit(admin, 'build_step.status', 'order_build_step', body.stepId, { orderId, completed: Boolean(body.completed) });
      return json(res, 200, { step: updated?.[0] });
    }
    return json(res, 400, { error: 'Brak danych do aktualizacji.' });
  } catch (error) { return safeError(res, error); }
}
