import { api } from './api.js';
import { initKanban, loadKanban } from './kanban.js';
import { initInventory, loadInventory } from './inventory.js';
import { initExtractor } from './extractor.js';
import { toast } from './ui.js';

let inventoryLoaded = false;

function activateView(name) {
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.view === name));
  document.querySelectorAll('.admin-view').forEach(view => view.classList.toggle('hidden', view.id !== `view-${name}`));
  if (name === 'inventory' && !inventoryLoaded) {
    inventoryLoaded = true;
    loadInventory().catch(error => toast(error.message, 'error'));
  }
}

async function start() {
  try {
    const session = await api('/api/auth?action=session');
    document.getElementById('adminName').textContent = session.user.displayName || session.user.login;
    initKanban();
    initInventory();
    initExtractor();
    document.querySelectorAll('.admin-tab').forEach(tab => tab.addEventListener('click', () => activateView(tab.dataset.view)));
    document.getElementById('logoutButton').addEventListener('click', async () => {
      try { await api('/api/auth?action=logout', { method: 'POST' }); } finally { location.replace('/admin/login'); }
    });
    await loadKanban();
  } catch (error) {
    toast(error.message, 'error');
  }
}

start();
