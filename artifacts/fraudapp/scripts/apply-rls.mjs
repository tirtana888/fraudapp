/**
 * apply-rls.mjs
 * Applies supabase-rls-policies.sql to the Supabase project via the
 * Supabase Management API.  Run this after apply-schema.mjs when
 * deploying to production.
 *
 * Usage:
 *   node artifacts/fraudapp/scripts/apply-rls.mjs
 *
 * Requires env vars:
 *   VITE_SUPABASE_URL        — Supabase project URL (e.g. https://xyz.supabase.co)
 *   SUPABASE_ACCESS_TOKEN    — Personal access token from supabase.com/dashboard/account/tokens
 *
 * Notes:
 *   - The script drops existing policies before re-applying so it is safe to
 *     re-run (idempotent).
 *   - Direct PostgreSQL TCP connections (port 5432/6543) are blocked in the
 *     Replit environment. This script uses the Management API (HTTPS) instead.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const ACCESS_TOKEN  = process.env.SUPABASE_ACCESS_TOKEN;

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

const rlsPath = resolve(__dirname, '..', 'supabase-rls-policies.sql');
const rlsSql  = readFileSync(rlsPath, 'utf8');

console.log('');
console.log('=== Supabase RLS Policy Apply ===');
console.log(`Project ref: ${PROJECT_REF}`);
console.log(`RLS file:    ${rlsPath}`);
console.log('');

// Drop all existing policies on the base tables so re-applying is idempotent.
console.log('Dropping existing policies (for idempotency)...');
const BASE_TABLES = [
  '_users', '_companies', '_jobs', '_applications',
  '_interview_sessions', '_assessment_invites', '_workflows',
  '_notifications', '_credit_transactions', '_system_config',
  '_audit_logs', '_pricing_config', '_promo_codes', '_payment_transactions',
];

const dropSql = BASE_TABLES.map(t =>
  `do $$ declare r record; begin
     for r in (select policyname from pg_policies where schemaname='public' and tablename='${t}')
     loop execute 'drop policy if exists ' || quote_ident(r.policyname) || ' on ${t}'; end loop;
   end $$;`
).join('\n');

await runSql(dropSql);
console.log('  Existing policies dropped.');

// Also drop and recreate the helper functions so the file is fully idempotent.
console.log('Applying RLS policies...');
await runSql(rlsSql);
console.log('  RLS SQL applied successfully.');

// Verify RLS is enabled on all base tables.
console.log('');
console.log('Verifying RLS status...');
const rlsStatus = await runSql(`
  select relname as table_name, relrowsecurity as rls_enabled
  from pg_class
  where relname in (${BASE_TABLES.map(t => `'${t}'`).join(',')})
    and relnamespace = 'public'::regnamespace
  order by relname;
`);

let allEnabled = true;
for (const row of rlsStatus) {
  if (row.rls_enabled) {
    console.log(`  ✓ ${row.table_name}: RLS enabled`);
  } else {
    console.error(`  ✗ ${row.table_name}: RLS NOT enabled`);
    allEnabled = false;
  }
}

// Verify policy count.
console.log('');
console.log('Verifying policies...');
const policyCount = await runSql(`
  select tablename, count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = any(array[${BASE_TABLES.map(t => `'${t}'`).join(',')}])
  group by tablename
  order by tablename;
`);

for (const row of policyCount) {
  console.log(`  ${row.tablename}: ${row.policy_count} policies`);
}

// Verify helper functions exist.
console.log('');
console.log('Verifying helper functions...');
const fns = await runSql(`
  select routine_name
  from information_schema.routines
  where routine_schema = 'public'
    and routine_name in ('auth_company_id', 'auth_user_role', 'is_system_admin', 'company_member_ids')
  order by routine_name;
`);
for (const fn of fns) {
  console.log(`  ✓ ${fn.routine_name}()`);
}
if (fns.length < 4) {
  console.error('  ✗ One or more helper functions are missing!');
  allEnabled = false;
}

console.log('');
if (allEnabled) {
  console.log('=== Done — RLS is active on all base tables ===');
} else {
  console.error('=== FAILED — Some tables or functions are not configured correctly ===');
  process.exit(1);
}
console.log('');
