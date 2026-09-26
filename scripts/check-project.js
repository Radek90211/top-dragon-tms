import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'vercel.json',
  'admin/index.html',
  'admin/login.html',
  'api/admin-page.js',
  'api/auth.js',
  'api/orders/index.js',
  'api/inventory/availability.js',
  'api/ai.js',
  'supabase/migrations/001_admin_schema.sql',
  'supabase/migrations/002_admin_login.sql',
  'supabase/migrations/003_visualizations_and_schedule.sql',
  'supabase/migrations/004_calendar_ai_workflow.sql'
];

const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Brak plików: ${missing.join(', ')}`);

const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const packageConfig = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (packageConfig.type !== 'module') throw new Error('Funkcje Vercel wymagają konfiguracji ESM.');
const incompatibleRoutingKeys = ['headers', 'rewrites', 'redirects', 'cleanUrls', 'trailingSlash'].filter(key => key in vercelConfig);
if (vercelConfig.routes && incompatibleRoutingKeys.length) {
  throw new Error(`Nie łącz "routes" z: ${incompatibleRoutingKeys.join(', ')}`);
}

const serverFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js') && !full.includes(`${path.sep}admin${path.sep}assets${path.sep}`)) serverFiles.push(full);
  }
}
walk(path.join(root, 'api'));
walk(path.join(root, 'lib'));
walk(path.join(root, 'scripts'));
for (const file of serverFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `Błąd składni: ${file}`);
}

const migration = fs.readFileSync(path.join(root, 'supabase/migrations/001_admin_schema.sql'), 'utf8');
for (const table of ['admin_users', 'orders', 'inventory_units', 'inventory_bookings', 'ai_extractions']) {
  if (!migration.includes(`public.${table}`)) throw new Error(`Migracja nie zawiera tabeli ${table}`);
}
const loginMigration = fs.readFileSync(path.join(root, 'supabase/migrations/002_admin_login.sql'), 'utf8');
if (!loginMigration.includes('admin_users') || !loginMigration.includes('login')) {
  throw new Error('Migracja logowania administratora jest nieprawidłowa.');
}
const workflowMigration = fs.readFileSync(path.join(root, 'supabase/migrations/004_calendar_ai_workflow.sql'), 'utf8');
for (const table of ['order_purchase_items', 'order_build_steps']) {
  if (!workflowMigration.includes(`public.${table}`)) throw new Error(`Migracja procesu nie zawiera tabeli ${table}`);
}

process.stdout.write(`Sprawdzono ${required.length} wymaganych plików i ${serverFiles.length} skryptów serwera. OK\n`);
