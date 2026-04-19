/**
 * apply-schema.mjs
 * Idempotently applies supabase-schema.sql to the Supabase project
 * via the Supabase Management API.
 *
 * Usage:
 *   node artifacts/fraudapp/scripts/apply-schema.mjs
 *
 * Requires env vars:
 *   VITE_SUPABASE_URL        — Supabase project URL (e.g. https://xyz.supabase.co)
 *   SUPABASE_ACCESS_TOKEN    — Personal access token from supabase.com/dashboard/account/tokens
 *
 * Notes:
 *   - The schema SQL uses IF NOT EXISTS for all CREATE TABLE/EXTENSION statements,
 *     so it is safe to re-run without side effects.
 *   - Direct PostgreSQL TCP connections (port 5432/6543) are blocked in the Replit
 *     environment because the Supabase db host only resolves to IPv6. This script
 *     uses the Management API (HTTPS) instead.
 *   - The personal access token is needed for the Management API; the service role
 *     key alone is not sufficient.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL;
const ACCESS_TOKEN     = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !ACCESS_TOKEN) {
  console.error('ERROR: VITE_SUPABASE_URL and SUPABASE_ACCESS_TOKEN must be set');
  process.exit(1);
}

const PROJECT_REF = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
const MGMT_URL    = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runSql(query) {
  const res = await fetch(MGMT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`SQL error (HTTP ${res.status}): ${body}`);
  return JSON.parse(body);
}

const schemaPath = resolve(__dirname, '..', 'supabase-schema.sql');
const schemaSql  = readFileSync(schemaPath, 'utf8');

console.log('');
console.log('=== Supabase Schema Apply ===');
console.log(`Project ref: ${PROJECT_REF}`);
console.log(`Schema file: ${schemaPath}`);
console.log('');

console.log('Applying schema...');
await runSql(schemaSql);
console.log('  Schema SQL applied successfully');

console.log('Creating storage buckets...');
await runSql(`
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('company-assets',      'company-assets',      true),
         ('candidate-documents', 'candidate-documents', false)
  ON CONFLICT DO NOTHING;
`);
console.log('  Storage buckets created (or already exist)');

console.log('');
console.log('Verifying tables...');
const tables = await runSql(
  "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_type, table_name"
);
const baseTable = tables.filter(r => r.table_type === 'BASE TABLE').map(r => r.table_name);
const views     = tables.filter(r => r.table_type === 'VIEW').map(r => r.table_name);
console.log(`  Base tables (${baseTable.length}): ${baseTable.join(', ')}`);
console.log(`  Views       (${views.length}): ${views.join(', ')}`);

const functions = await runSql(
  "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name"
);
console.log(`  Functions   (${functions.length}): ${functions.map(r => r.routine_name).join(', ')}`);

const buckets = await runSql("SELECT id, public FROM storage.buckets ORDER BY id");
console.log(`  Buckets     (${buckets.length}): ${buckets.map(b => `${b.id}(${b.public ? 'public' : 'private'})`).join(', ')}`);

console.log('');
console.log('=== Done ===');
console.log('');
console.log('Next step for production: apply Row Level Security policies:');
console.log('  node artifacts/fraudapp/scripts/apply-rls.mjs');
console.log('');
