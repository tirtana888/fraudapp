/**
 * verify-rls.mjs
 * Verifies that RLS policies are active and correctly configured on all base
 * tables.  Runs SQL-level checks via the Supabase Management API.
 *
 * Usage:
 *   node artifacts/fraudapp/scripts/verify-rls.mjs
 *
 * Requires env vars:
 *   VITE_SUPABASE_URL        — Supabase project URL (e.g. https://xyz.supabase.co)
 *   SUPABASE_ACCESS_TOKEN    — Personal access token from supabase.com/dashboard/account/tokens
 *
 * What is verified:
 *   1. RLS is enabled on every required base table.
 *   2. All three helper functions exist (auth_company_id, auth_user_role, is_system_admin).
 *   3. Each table has at least one policy defined.
 *   4. The _users insert policy blocks the 'System Admin' role for self-service inserts.
 *   5. The _users update policy has a WITH CHECK expression that references company_id and role.
 *   6. No table has zero policies while RLS is enabled (open-deny trap).
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

const BASE_TABLES = [
  '_users', '_companies', '_jobs', '_applications',
  '_interview_sessions', '_assessment_invites', '_workflows',
  '_notifications', '_credit_transactions', '_system_config',
  '_audit_logs', '_pricing_config', '_promo_codes', '_payment_transactions',
];

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

console.log('');
console.log('=== RLS Policy Verification ===');
console.log(`Project: ${PROJECT_REF}`);
console.log('');

// ── 1. RLS enabled on all base tables ────────────────────────────────────────
console.log('--- 1. RLS enabled on all base tables ---');
const rlsStatus = await runSql(`
  select relname as table_name, relrowsecurity as rls_enabled
  from pg_class
  where relname = any(array[${BASE_TABLES.map(t => `'${t}'`).join(',')}])
    and relnamespace = 'public'::regnamespace
  order by relname;
`);

const rlsMap = {};
for (const row of rlsStatus) {
  rlsMap[row.table_name] = row.rls_enabled;
  if (row.rls_enabled) {
    ok(`${row.table_name}: RLS enabled`);
  } else {
    fail(`${row.table_name}`, 'RLS NOT enabled');
  }
}
for (const t of BASE_TABLES) {
  if (!(t in rlsMap)) {
    fail(t, 'table not found in pg_class');
  }
}

// ── 2. Helper functions exist ─────────────────────────────────────────────────
console.log('');
console.log('--- 2. Helper functions ---');
const fns = await runSql(`
  select routine_name, security_type
  from information_schema.routines
  where routine_schema = 'public'
    and routine_name in ('auth_company_id', 'auth_user_role', 'is_system_admin', 'company_member_ids')
  order by routine_name;
`);
const fnNames = fns.map(r => r.routine_name);
for (const name of ['auth_company_id', 'auth_user_role', 'is_system_admin', 'company_member_ids']) {
  if (fnNames.includes(name)) {
    const fn = fns.find(r => r.routine_name === name);
    ok(`${name}() exists (security: ${fn.security_type})`);
  } else {
    fail(`${name}()`, 'function missing');
  }
}

// ── 3. Each table has at least one policy ─────────────────────────────────────
console.log('');
console.log('--- 3. Policy counts per table ---');
const policyCounts = await runSql(`
  select tablename, count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = any(array[${BASE_TABLES.map(t => `'${t}'`).join(',')}])
  group by tablename
  order by tablename;
`);
const policyMap = {};
for (const row of policyCounts) {
  policyMap[row.tablename] = parseInt(row.policy_count, 10);
}
for (const t of BASE_TABLES) {
  const count = policyMap[t] || 0;
  if (count > 0) {
    ok(`${t}: ${count} policy/policies`);
  } else {
    fail(`${t}`, 'no policies defined (all rows blocked by default)');
  }
}

// ── 4. _users insert policy blocks System Admin role self-assignment ──────────
console.log('');
console.log('--- 4. _users insert policy blocks System Admin role at signup ---');
const insertPolicy = await runSql(`
  select policyname, qual, with_check
  from pg_policies
  where schemaname = 'public'
    and tablename = '_users'
    and cmd = 'INSERT'
  order by policyname;
`);
if (insertPolicy.length === 0) {
  fail('_users INSERT policy', 'no INSERT policy found');
} else {
  for (const p of insertPolicy) {
    const withCheck = (p.with_check || '').toLowerCase();
    const blocksAdminRole = withCheck.includes("'system admin'") || withCheck.includes('"system admin"');
    if (blocksAdminRole) {
      ok(`${p.policyname}: WITH CHECK blocks 'System Admin' role at insert`);
    } else {
      fail(`${p.policyname}`, 'WITH CHECK does not block System Admin role — privilege escalation risk');
    }
  }
}

// ── 5. _users update policy has WITH CHECK on company_id and role ─────────────
console.log('');
console.log('--- 5. _users update policy guards company_id and role changes ---');
const updatePolicy = await runSql(`
  select policyname, qual, with_check
  from pg_policies
  where schemaname = 'public'
    and tablename = '_users'
    and cmd = 'UPDATE'
  order by policyname;
`);
if (updatePolicy.length === 0) {
  fail('_users UPDATE policy', 'no UPDATE policy found');
} else {
  for (const p of updatePolicy) {
    const withCheck = (p.with_check || '').toLowerCase();
    const hasCompanyIdGuard = withCheck.includes('company_id');
    const hasRoleGuard      = withCheck.includes('role');
    if (hasCompanyIdGuard && hasRoleGuard) {
      ok(`${p.policyname}: WITH CHECK guards both company_id and role`);
    } else {
      fail(`${p.policyname}`, `WITH CHECK missing guards — company_id: ${hasCompanyIdGuard}, role: ${hasRoleGuard}`);
    }
  }
}

// ── 6. No table has RLS enabled but zero policies ─────────────────────────────
console.log('');
console.log('--- 6. No RLS-enabled table has zero policies (avoid deny-all) ---');
for (const t of BASE_TABLES) {
  const hasRls    = rlsMap[t];
  const hasPolicy = (policyMap[t] || 0) > 0;
  if (hasRls && !hasPolicy) {
    fail(t, 'RLS enabled but no policies — all operations will be denied');
  } else if (hasRls && hasPolicy) {
    ok(`${t}: RLS on, policies present`);
  }
}

// ── 7. Public candidate flows use SECURITY DEFINER RPCs (no anon policies) ─────
console.log('');
console.log('--- 7. Public candidate flows handled by SECURITY DEFINER RPCs ---');
const publicRpcs = await runSql(`
  select proname, prosecdef
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and proname in ('get_company_for_public', 'verify_access_code', 'mark_access_code_used')
  order by proname;
`);
const rpcMap = {};
for (const r of publicRpcs) { rpcMap[r.proname] = r.prosecdef; }
for (const fn of ['get_company_for_public', 'verify_access_code', 'mark_access_code_used']) {
  if (rpcMap[fn] === true || rpcMap[fn] === 't') {
    ok(`${fn}(): SECURITY DEFINER — public flow enabled without anonymous RLS policy`);
  } else if (rpcMap[fn] !== undefined) {
    fail(fn, 'function exists but is NOT security definer — public flow may bypass RLS incorrectly');
  } else {
    fail(fn, 'SECURITY DEFINER function missing — public assessment flow will fail');
  }
}
// Confirm no blanket anonymous policies exist on sensitive tables
const anonPolicies = await runSql(`
  select tablename, policyname
  from pg_policies
  where schemaname = 'public'
    and tablename in ('_assessment_invites', '_companies')
    and (qual ilike '%uid() is null%' or with_check ilike '%uid() is null%');
`);
if (anonPolicies.length === 0) {
  ok('No blanket anonymous policies on _companies or _assessment_invites (public access via RPC only)');
} else {
  for (const p of anonPolicies) {
    fail(`${p.tablename}`, `anonymous policy "${p.policyname}" allows enumeration — replace with SECURITY DEFINER RPC`);
  }
}

// ── 8. Views have security_invoker = on ───────────────────────────────────────
console.log('');
console.log('--- 8. camelCase views use security_invoker to enforce RLS ---');
const VIEWS = [
  'users', 'companies', 'jobs', 'applications', 'interview_sessions',
  'assessment_invites', 'workflows', 'notifications', 'credit_transactions',
  'system_config', 'audit_logs', 'pricing_config', 'promo_codes', 'payment_transactions',
];
const viewSecurity = await runSql(`
  select viewname,
         (relacl is not null) as has_acl,
         reloptions
  from pg_views
  join pg_class on relname = viewname
  where schemaname = 'public'
    and viewname = any(array[${VIEWS.map(v => `'${v}'`).join(',')}])
  order by viewname;
`);
const viewMap = {};
for (const row of viewSecurity) {
  viewMap[row.viewname] = row.reloptions;
}
for (const v of VIEWS) {
  const opts = (viewMap[v] || []).join(',').toLowerCase();
  if (opts.includes('security_invoker=on') || opts.includes('security_invoker=true')) {
    ok(`${v}: security_invoker = on`);
  } else {
    fail(`${v}`, 'security_invoker not set — RLS may be bypassed via view owner privileges');
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log(`=== Result: ${passed} passed, ${failed} failed ===`);
console.log('');
if (failed > 0) process.exit(1);
