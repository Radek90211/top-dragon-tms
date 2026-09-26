import crypto from 'node:crypto';
import { dbRequest } from '../lib/supabase.js';
import { requireAdmin } from '../lib/auth.js';
import { json, allowMethods, safeError } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { BUCKET, storageRequest, objectPath, createSignedUrl } from '../lib/storage.js';

export const config = { api: { bodyParser: false } };

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function readBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let length = 0;
    req.on('data', chunk => {
      length += chunk.length;
      if (length > MAX_BYTES) reject(Object.assign(new Error('Maksymalny rozmiar zdjęcia to 8 MB.'), { status: 413 }));
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeName(value) {
  const decoded = decodeURIComponent(String(value || 'wizualizacja'));
  return decoded.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'wizualizacja';
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'DELETE'])) return;
  try {
    const admin = await requireAdmin(req, res); if (!admin) return;
    const orderId = String(req.query?.orderId || '').trim(); if (!orderId) return json(res, 400, { error: 'Brak identyfikatora zlecenia.' });

    if (req.method === 'GET') {
      const items = await dbRequest('order_visualizations', { query: { select: 'id,file_name,content_type,byte_size,created_at,storage_path,media_type,ai_analysis', order_id: `eq.${orderId}`, order: 'created_at.desc' } });
      const visualizations = await Promise.all((items || []).map(async item => ({ ...item, url: await createSignedUrl(item.storage_path) })));
      return json(res, 200, { visualizations });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query?.visualizationId || '').trim(); if (!id) return json(res, 400, { error: 'Brak identyfikatora zdjęcia.' });
      const found = await dbRequest('order_visualizations', { query: { select: 'id,storage_path', id: `eq.${id}`, order_id: `eq.${orderId}`, limit: 1 } });
      if (!found?.[0]) return json(res, 404, { error: 'Nie znaleziono zdjęcia.' });
      await storageRequest(`/object/${BUCKET}/${objectPath(found[0].storage_path)}`, { method: 'DELETE' });
      await dbRequest('order_visualizations', { method: 'DELETE', query: { id: `eq.${id}` }, prefer: 'return=minimal' });
      await audit(admin, 'visualization.delete', 'order_visualization', id, { orderId });
      return json(res, 200, { ok: true });
    }

    const type = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
    if (!ALLOWED_TYPES.has(type)) return json(res, 400, { error: 'Dozwolone są pliki JPG, PNG i WebP.' });
    const buffer = await readBuffer(req); if (!buffer.length) return json(res, 400, { error: 'Wybierz zdjęcie.' });
    const fileName = safeName(req.headers['x-file-name']);
    const mediaType = req.query?.mediaType === 'completion' ? 'completion' : 'visualization';
    const extension = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
    const storagePath = `${orderId}/${crypto.randomUUID()}.${extension}`;
    await storageRequest(`/object/${BUCKET}/${objectPath(storagePath)}`, { method: 'POST', headers: { 'Content-Type': type, 'x-upsert': 'false' }, body: buffer });
    const inserted = await dbRequest('order_visualizations', { method: 'POST', body: { order_id: orderId, storage_path: storagePath, file_name: fileName, content_type: type, byte_size: buffer.length, media_type: mediaType, created_by: admin.id } });
    await audit(admin, 'visualization.upload', 'order_visualization', inserted?.[0]?.id, { orderId, fileName, mediaType });
    return json(res, 201, { visualization: { ...inserted?.[0], url: await createSignedUrl(storagePath) } });
  } catch (error) { return safeError(res, error); }
}
