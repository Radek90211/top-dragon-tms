import { api } from './api.js';
import { escapeHtml, setBusy, toast, toIso, toLocalInput } from './ui.js';

let state = { orders: [] };
let visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let currentOrder = null;
let currentMedia = [];
let currentWorkflow = { purchases: [], steps: [] };
let pendingExtraction = null;

const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' });
const dayKey = value => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function tileHtml(order) {
  const thumb = order.thumbnail_url
    ? `<img src="${escapeHtml(order.thumbnail_url)}" alt="Miniatura wizualizacji">`
    : '<span class="order-tile-placeholder"><i class="fa-regular fa-image text-cocoa"></i></span>';
  return `<article class="order-tile" tabindex="0" data-order-tile="${escapeHtml(order.id)}" title="Kliknij dwukrotnie, aby otworzyć">
    ${thumb}<span class="min-w-0"><strong class="block text-xs leading-tight truncate">${escapeHtml(order.title)}</strong><button type="button" data-open-order="${escapeHtml(order.id)}" class="mt-1 text-[10px] font-bold text-cocoa underline">Otwórz</button></span>
  </article>`;
}

function renderCalendar() {
  const board = document.getElementById('calendarBoard');
  document.getElementById('calendarTitle').textContent = monthLabel.format(visibleMonth);
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(first.getDate() - mondayOffset);
  const today = dayKey(new Date());
  const headers = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'].map(day => `<div class="calendar-weekday">${day}</div>`).join('');
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start); date.setDate(start.getDate() + index);
    const key = dayKey(date);
    const orders = state.orders.filter(order => dayKey(order.event_start) === key);
    const outside = date.getMonth() !== visibleMonth.getMonth();
    return `<section class="calendar-day${outside ? ' is-outside' : ''}${key === today ? ' is-today' : ''}" data-date="${key}">
      <span class="calendar-day-number">${date.getDate()}</span>${orders.map(tileHtml).join('')}
    </section>`;
  }).join('');
  board.innerHTML = headers + days;
  board.querySelectorAll('[data-order-tile]').forEach(tile => {
    tile.addEventListener('dblclick', () => openOrderDetails(tile.dataset.orderTile));
    tile.addEventListener('keydown', event => { if (event.key === 'Enter') openOrderDetails(tile.dataset.orderTile); });
  });
  board.querySelectorAll('[data-open-order]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation(); openOrderDetails(button.dataset.openOrder);
  }));
}

export async function loadKanban() {
  state = await api('/api/orders');
  renderCalendar(); updateOrderSelects();
  return state;
}

function updateOrderSelects() {
  const select = document.querySelector('#bookingForm select[name="orderId"]');
  if (!select) return;
  select.innerHTML = '<option value="">Bez przypisanego zlecenia</option>' + state.orders.map(order => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.title)}</option>`).join('');
}

export function getOrders() { return state.orders; }

function closeSimpleModal() {
  const modal = document.getElementById('orderModal');
  const form = document.getElementById('orderForm');
  form.reset(); pendingExtraction = null; modal.classList.add('hidden');
}

function openSimpleModal() {
  closeSimpleModal();
  document.getElementById('orderModal').classList.remove('hidden');
  document.querySelector('#orderForm input[name="title"]').focus();
}

function fillDetails(order) {
  const form = document.getElementById('orderDetailsForm');
  const customer = order.customers || {};
  form.title.value = order.title || '';
  form.customerName.value = customer.name || '';
  form.contact.value = customer.email || customer.phone || '';
  form.eventStart.value = toLocalInput(order.event_start);
  form.eventEnd.value = toLocalInput(order.event_end);
  form.installationStart.value = toLocalInput(order.installation_start);
  form.teardownStart.value = toLocalInput(order.teardown_start);
  form.location.value = order.location || '';
  form.rawInquiry.value = order.raw_inquiry || '';
}

async function openOrderDetails(id) {
  currentOrder = state.orders.find(order => order.id === id);
  if (!currentOrder) return;
  document.getElementById('orderDetailsTitle').textContent = currentOrder.title;
  fillDetails(currentOrder);
  document.getElementById('orderDetailsModal').classList.remove('hidden');
  await Promise.all([loadMedia(), loadWorkflow()]).catch(error => toast(error.message, 'error'));
}

function closeDetails() {
  document.getElementById('orderDetailsModal').classList.add('hidden');
  currentOrder = null; currentMedia = []; currentWorkflow = { purchases: [], steps: [] };
}

function mediaCard(item) {
  const analysis = item.ai_analysis;
  return `<article class="media-card"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.file_name)}"></a>
    <div class="p-3"><p class="text-xs font-bold truncate">${escapeHtml(item.file_name)}</p>
      ${item.media_type === 'visualization' ? `<button data-analyze-media="${escapeHtml(item.id)}" class="mt-2 rounded-full bg-blush px-3 py-1.5 text-xs font-bold">${analysis ? 'Analizuj ponownie' : 'Analizuj AI'}</button>` : ''}
      ${analysis ? `<p class="mt-2 text-[11px] text-cocoa">Szacunkowo: ${escapeHtml(analysis.estimatedBalloonCount ?? '—')} balonów</p>` : ''}
      <button data-delete-media="${escapeHtml(item.id)}" class="mt-2 ml-2 text-xs font-bold text-red-700">Usuń</button>
    </div></article>`;
}

async function loadMedia() {
  const result = await api(`/api/order-media?orderId=${encodeURIComponent(currentOrder.id)}`);
  currentMedia = result.visualizations || [];
  const visuals = currentMedia.filter(item => item.media_type === 'visualization');
  const completed = currentMedia.filter(item => item.media_type === 'completion');
  document.getElementById('visualizationGrid').innerHTML = visuals.length ? visuals.map(mediaCard).join('') : '<p class="text-sm text-cocoa">Brak wizualizacji.</p>';
  document.getElementById('completionGrid').innerHTML = completed.length ? completed.map(mediaCard).join('') : '<p class="text-sm text-cocoa">Brak zdjęć wykonanej realizacji.</p>';
  document.querySelectorAll('[data-delete-media]').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('Usunąć to zdjęcie?')) return;
    try { await api(`/api/order-media?orderId=${encodeURIComponent(currentOrder.id)}&visualizationId=${encodeURIComponent(button.dataset.deleteMedia)}`, { method: 'DELETE' }); await loadMedia(); await loadKanban(); toast('Zdjęcie zostało usunięte.'); }
    catch (error) { toast(error.message, 'error'); }
  }));
  document.querySelectorAll('[data-analyze-media]').forEach(button => button.addEventListener('click', async () => {
    setBusy(button, true, 'Analizuję…');
    try { await api('/api/ai?action=analyze-visualization', { method: 'POST', body: { orderId: currentOrder.id, visualizationId: button.dataset.analyzeMedia } }); await Promise.all([loadMedia(), loadWorkflow()]); toast('AI przygotowało zestawienie materiałów.'); }
    catch (error) { toast(error.message, 'error'); } finally { setBusy(button, false); }
  }));
}

async function uploadMedia(form, mediaType) {
  const files = [...form.photos.files]; if (!files.length || !currentOrder) return;
  const button = form.querySelector('button'); setBusy(button, true, 'Przesyłanie…');
  try {
    for (const file of files) await api(`/api/order-media?orderId=${encodeURIComponent(currentOrder.id)}&mediaType=${mediaType}`, { method: 'POST', headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) }, body: file });
    form.reset(); await Promise.all([loadMedia(), loadKanban()]); toast('Zdjęcia zostały dodane.');
  } catch (error) { toast(error.message, 'error'); } finally { setBusy(button, false); }
}

const purchaseMeta = {
  needed: ['Do kupienia', 'purchase-needed'], ordered: ['W drodze', 'purchase-ordered'], purchased: ['Kupione', 'purchase-purchased']
};

function renderWorkflow() {
  const purchaseList = document.getElementById('purchaseList');
  purchaseList.innerHTML = currentWorkflow.purchases.length ? currentWorkflow.purchases.map(item => {
    const [label, color] = purchaseMeta[item.status] || purchaseMeta.needed;
    return `<div class="purchase-row ${color}"><div><strong>${escapeHtml(item.name)}</strong><p class="text-xs mt-1">${escapeHtml([item.quantity, item.unit, item.notes].filter(Boolean).join(' · '))}</p></div><select data-purchase-status="${escapeHtml(item.id)}" class="admin-input !w-auto !py-2 text-xs font-bold"><option value="needed" ${item.status === 'needed' ? 'selected' : ''}>Do kupienia</option><option value="ordered" ${item.status === 'ordered' ? 'selected' : ''}>W drodze</option><option value="purchased" ${item.status === 'purchased' ? 'selected' : ''}>Kupione</option></select></div>`;
  }).join('') : '<p class="text-sm text-cocoa">Przeanalizuj wizualizację, aby utworzyć listę zakupów.</p>';
  const allPurchased = currentWorkflow.purchases.length > 0 && currentWorkflow.purchases.every(item => item.status === 'purchased');
  document.getElementById('generateBuildPlan').disabled = !allPurchased;
  const steps = document.getElementById('buildSteps');
  steps.innerHTML = currentWorkflow.steps.length ? currentWorkflow.steps.map(step => `<label class="build-step${step.completed ? ' is-complete' : ''}"><input type="checkbox" class="mt-1 accent-[#4A3E3D]" data-build-step="${escapeHtml(step.id)}" ${step.completed ? 'checked' : ''}><span><span class="text-xs uppercase tracking-wider text-blushDark font-bold">${escapeHtml(step.layer_name || `Etap ${step.position}`)}</span><h4 class="font-bold mt-1">${escapeHtml(step.title)}</h4><p class="text-sm text-cocoa mt-1">${escapeHtml(step.description)}</p></span></label>`).join('') : '<p class="text-sm text-cocoa">Instrukcja pojawi się tutaj po jej wygenerowaniu.</p>';
  document.querySelectorAll('[data-purchase-status]').forEach(select => select.addEventListener('change', async () => {
    try { await api(`/api/order-workflow?orderId=${encodeURIComponent(currentOrder.id)}`, { method: 'PATCH', body: { purchaseItemId: select.dataset.purchaseStatus, status: select.value } }); await loadWorkflow(); }
    catch (error) { toast(error.message, 'error'); }
  }));
  document.querySelectorAll('[data-build-step]').forEach(checkbox => checkbox.addEventListener('change', async () => {
    try { await api(`/api/order-workflow?orderId=${encodeURIComponent(currentOrder.id)}`, { method: 'PATCH', body: { stepId: checkbox.dataset.buildStep, completed: checkbox.checked } }); await loadWorkflow(); }
    catch (error) { toast(error.message, 'error'); }
  }));
}

async function loadWorkflow() {
  currentWorkflow = await api(`/api/order-workflow?orderId=${encodeURIComponent(currentOrder.id)}`);
  renderWorkflow();
}

export function initKanban() {
  const simpleModal = document.getElementById('orderModal');
  document.querySelectorAll('[data-open-order-modal]').forEach(button => button.addEventListener('click', openSimpleModal));
  document.querySelectorAll('[data-close-order-modal]').forEach(button => button.addEventListener('click', closeSimpleModal));
  simpleModal.addEventListener('click', event => { if (event.target === simpleModal) closeSimpleModal(); });
  document.getElementById('calendarPrevious').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); renderCalendar(); });
  document.getElementById('calendarNext').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); renderCalendar(); });

  document.getElementById('orderForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); const data = new FormData(form); setBusy(button, true);
    const extraction = pendingExtraction;
    const eventStart = toIso(`${data.get('eventDate')}T12:00`);
    try {
      await api('/api/orders', { method: 'POST', body: { title: data.get('title'), eventStart, ...(extraction ? {
        customer: extraction.customerName && (extraction.email || extraction.phone) ? { name: extraction.customerName, email: extraction.email || null, phone: extraction.phone || null } : undefined,
        eventEnd: extraction.eventEnd || null, installationStart: extraction.installationStart || null, teardownStart: extraction.teardownStart || null,
        location: extraction.location || null, rawInquiry: [extraction.summary, extraction.notes].filter(Boolean).join('\n\n'), details: extraction
      } : {}) } });
      visibleMonth = new Date(`${data.get('eventDate')}T12:00`); visibleMonth.setDate(1); closeSimpleModal(); await loadKanban(); toast('Zlecenie dodano do kalendarza.');
    } catch (error) { toast(error.message, 'error'); } finally { setBusy(button, false); }
  });

  const detailsModal = document.getElementById('orderDetailsModal');
  document.querySelectorAll('[data-close-order-details]').forEach(button => button.addEventListener('click', closeDetails));
  detailsModal.addEventListener('click', event => { if (event.target === detailsModal) closeDetails(); });
  document.getElementById('orderDetailsForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!currentOrder) return; const form = event.currentTarget; const button = form.querySelector('button'); const data = new FormData(form); const contact = String(data.get('contact') || '').trim(); const customer = data.get('customerName') && contact ? { name: data.get('customerName'), ...(contact.includes('@') ? { email: contact } : { phone: contact }) } : undefined; setBusy(button, true);
    try { await api(`/api/order?id=${encodeURIComponent(currentOrder.id)}`, { method: 'PATCH', body: { title: data.get('title'), customer, eventStart: toIso(data.get('eventStart')), eventEnd: toIso(data.get('eventEnd')), installationStart: toIso(data.get('installationStart')), teardownStart: toIso(data.get('teardownStart')), location: data.get('location'), rawInquiry: data.get('rawInquiry') } }); await loadKanban(); currentOrder = state.orders.find(order => order.id === currentOrder.id); document.getElementById('orderDetailsTitle').textContent = currentOrder.title; toast('Szczegóły zostały zapisane.'); }
    catch (error) { toast(error.message, 'error'); } finally { setBusy(button, false); }
  });
  document.getElementById('visualizationUploadForm').addEventListener('submit', event => { event.preventDefault(); uploadMedia(event.currentTarget, 'visualization'); });
  document.getElementById('completionUploadForm').addEventListener('submit', event => { event.preventDefault(); uploadMedia(event.currentTarget, 'completion'); });
  document.getElementById('generateBuildPlan').addEventListener('click', async event => {
    const button = event.currentTarget; setBusy(button, true, 'Tworzę instrukcję…');
    try { const result = await api('/api/ai?action=build-plan', { method: 'POST', body: { orderId: currentOrder.id } }); const note = document.getElementById('buildSafetyNote'); note.textContent = result.safetyNote || ''; note.classList.toggle('hidden', !result.safetyNote); await loadWorkflow(); toast('Instrukcja wykonania jest gotowa.'); }
    catch (error) { toast(error.message, 'error'); } finally { setBusy(button, false); }
  });
  document.getElementById('deleteOrderButton').addEventListener('click', async () => {
    if (!currentOrder || !confirm(`Usunąć zlecenie „${currentOrder.title}”?`)) return;
    try { await api(`/api/order?id=${encodeURIComponent(currentOrder.id)}`, { method: 'DELETE' }); closeDetails(); await loadKanban(); toast('Zlecenie zostało usunięte.'); }
    catch (error) { toast(error.message, 'error'); }
  });
}

export function openOrderFormFromExtraction(data) {
  pendingExtraction = data;
  const form = document.getElementById('orderForm');
  form.title.value = [data.occasion, data.customerName].filter(Boolean).join(' — ') || 'Nowe zlecenie';
  const date = data.eventStart || data.eventDate;
  form.eventDate.value = date ? String(date).slice(0, 10) : '';
  document.getElementById('orderModal').classList.remove('hidden');
}
