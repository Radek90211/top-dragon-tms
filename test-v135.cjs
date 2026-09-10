const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync('public/tms.html','utf8');
const main = fs.readFileSync('src/main.js','utf8');
const readme = fs.readFileSync('README_WDROZENIE.txt','utf8');

assert(html.includes('targeted-v135-queue-attention-alerts'));
assert(html.includes('queue-alert-blue-v135'));
assert(html.includes('queue-alert-green-v135'));
assert(html.includes('queue-message-indicator-v135'));
assert(html.includes("message.type === 'top-dragon-load-queue-data'"));
assert(html.includes("message.type === 'top-dragon-load-queue-chat-data'"));
assert(html.includes("queueMarkPanelOpenedV135('proposed')"));
assert(html.includes("queueMarkPanelOpenedV135('future')"));
assert(html.includes('preferredQueueMatchRows(proposedDistancesForRoute'));
assert(html.includes("['spedytor','kierownik']"));
assert(/request-workflow-v13[56]-/.test(main));
assert(readme.includes('AKTUALIZACJA v135'));
console.log('test-v135: OK');
