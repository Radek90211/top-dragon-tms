import { api } from './api.js';
import { escapeHtml, setBusy, toast } from './ui.js';
import { openOrderFormFromExtraction } from './kanban.js';

let lastExtraction = null;

function render(data) {
  const fields = [
    ['Klient', data.customerName],
    ['Kontakt', data.email || data.phone],
    ['Data', data.eventDate],
    ['Start wydarzenia', data.eventStart],
    ['Koniec wydarzenia', data.eventEnd],
    ['Montaż — start', data.installationStart],
    ['Montaż — koniec', data.installationEnd],
    ['Demontaż — start', data.teardownStart],
    ['Demontaż — koniec', data.teardownEnd],
    ['Miejsce', data.location],
    ['Okazja', data.occasion],
    ['Budżet', data.budgetMin || data.budgetMax ? `${data.budgetMin ?? '—'}–${data.budgetMax ?? '—'} zł` : null],
    ['Kolory', (data.colors || []).join(', ')],
    ['Elementy', (data.requestedElements || []).join(', ')],
    ['Uwagi', data.notes],
    ['Podsumowanie', data.summary],
    ['Pewność', Number.isFinite(data.confidence) ? `${Math.round(data.confidence * 100)}%` : null]
  ];
  document.getElementById('extractorResult').innerHTML = `<dl class="space-y-3">${fields.map(([label, value]) => `<div class="rounded-2xl bg-[#FAF7F4] p-4"><dt class="text-xs uppercase tracking-wider text-cocoa font-bold">${label}</dt><dd class="mt-1 font-bold text-brown">${escapeHtml(value || 'Nie podano')}</dd></div>`).join('')}</dl>`;
}

export function initExtractor() {
  const form = document.getElementById('extractorForm');
  const createButton = document.getElementById('createOrderFromAi');
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('button'); setBusy(button, true, 'Analizuję…');
    try {
      const result = await api('/api/ai?action=extract-inquiry', { method: 'POST', body: { text: form.text.value } });
      lastExtraction = { ...result.data, notes: [result.data.notes, `Oryginalne zapytanie:\n${form.text.value}`].filter(Boolean).join('\n\n') };
      render(result.data); createButton.classList.remove('hidden'); toast('Dane zostały wyodrębnione.');
    } catch (error) { toast(error.message, 'error'); }
    finally { setBusy(button, false); }
  });
  createButton.addEventListener('click', () => { if (lastExtraction) openOrderFormFromExtraction(lastExtraction); });
}
