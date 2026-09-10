const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync('public/tms.html','utf8');
const orderEntry = fs.readFileSync('public/order-entry.js','utf8');
const main = fs.readFileSync('src/main.js','utf8');
const importAi = fs.readFileSync('api/import-ai-data.js','utf8');
const backup = fs.readFileSync('api/relations-backup-email.js','utf8');
const readme = fs.readFileSync('README_WDROZENIE.txt','utf8');

assert(main.includes('request-workflow-v136-unified-queue-client-backup'));
assert(html.includes('targeted-v136-route-match-hover-alerts'));
assert(html.includes('queue-match-pulse-v136'));
assert(html.includes("pointerover"));
assert(html.includes('isOwnAddition'));
assert(html.includes('!isOwnAddition'));
assert(html.includes('queue-message-indicator-v135'));

assert(!html.includes('✨ Import AI'));
assert(html.includes('Opiekunowie importowanych klientów'));
assert(html.includes('maksymalnie 3'));
assert(html.includes('adminAiSetClientDispatcher(${slot},this.value)'));
assert(html.includes('${[0,1,2].map((slot) =>'));
assert(importAi.includes('dispatchers (tablica maksymalnie 3 opiekunów)'));
assert(main.includes('normalizeCentralClientOwners'));
assert(main.includes('.slice(0, 3)'));

assert(orderEntry.includes('const isPlan = () => state.addOpen && state.prefill;'));
assert(html.includes('/order-entry.js?build=v136-unified-queue-form'));
assert(html.includes('<details class="optional-text-details" ${String(prefill.notes || "").trim() ? "open" : ""}>'));
assert(html.includes('<details class="optional-text-details" ${String(prefill.driverNotes || "").trim() ? "open" : ""}>'));

const smsStart = html.indexOf('function renderRouteSmsChoices');
const smsEnd = html.indexOf('const BOARD_ARCHIVE_DAYS', smsStart);
const smsChoices = html.slice(smsStart, smsEnd);
for (const removed of ['Kilometry','Powitanie i data','Załadunek i godzina','Rozładunek i godzina']) {
  assert(!smsChoices.includes(removed), `Usunięty wybór SMS nadal istnieje: ${removed}`);
}
assert(smsChoices.includes('Drugi załadunek'));
assert(smsChoices.includes('Drugi rozładunek'));
assert(smsChoices.includes('Informacje dla kierowcy'));

assert(html.includes('Wyślij kopię relacji e-mail'));
assert(main.includes('top-dragon-relations-backup-email-request'));
assert(backup.includes("RELATIONS_BACKUP_TO_EMAIL"));
assert(backup.includes("RESEND_API_KEY"));
assert(backup.includes("CRON_SECRET"));
assert(backup.includes("['POST','GET']"));
assert(backup.includes('PAGE_SIZE = 1000'));
assert(backup.includes('backupAttachment'));
assert(backup.includes('gzipSync'));
assert(readme.includes('AKTUALIZACJA v136'));
console.log('test-v136: OK');
