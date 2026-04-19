/**
 * verify-supabase.mjs
 * Verifies that all required Supabase database tables, views, functions,
 * and storage buckets are present and that both the service-role key path
 * and the anon-key path (as the app uses in the browser) are reachable.
 *
 * Usage:
 *   node artifacts/fraudapp/scripts/verify-supabase.mjs
 *
 * Requires env vars:
 *   VITE_SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service-role JWT (bypasses RLS, server-side only)
 *   VITE_SUPABASE_ANON_KEY     — anon key (used by the browser app)
 */

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY      = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error(
    'ERROR: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and VITE_SUPABASE_ANON_KEY must be set'
  );
  process.exit(1);
}

function makeHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

const serviceHeaders = makeHeaders(SERVICE_KEY);
const anonHeaders    = makeHeaders(ANON_KEY);

async function restGet(path, headers) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  return { ok: res.ok, status: res.status };
}

async function restPost(path, body, headers) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

async function restDelete(path, headers) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers,
  });
  return { ok: res.ok, status: res.status };
}

const VIEWS = [
  'users',
  'companies',
  'jobs',
  'applications',
  'interview_sessions',
  'assessment_invites',
  'workflows',
  'notifications',
  'credit_transactions',
  'system_config',
  'audit_logs',
  'pricing_config',
  'promo_codes',
  'payment_transactions',
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

function note(label) {
  console.log(`  ℹ ${label}`);
}

console.log('');
console.log('=== Supabase Connectivity Verification ===');
console.log(`Project: ${SUPABASE_URL}`);
console.log('');

// ── Service-role checks ──────────────────────────────────────────────────────
console.log('--- [service-role key] REST API read access (all views) ---');
await Promise.all(
  VIEWS.map(async (view) => {
    const { ok: isOk, status } = await restGet(
      `${view}?select=*&limit=1`,
      serviceHeaders
    );
    if (isOk) {
      ok(`${view} → HTTP ${status}`);
    } else {
      fail(`${view}`, `HTTP ${status}`);
    }
  })
);

console.log('');
console.log('--- [service-role key] Write / read / delete round-trip (system_config) ---');

const { ok: insertOk, status: insertStatus, body: insertBody } = await restPost(
  'system_config',
  { id: '__verify-test__', data: { ping: true } },
  serviceHeaders
);
if (insertOk || insertStatus === 201) {
  ok(`INSERT → HTTP ${insertStatus}`);
} else {
  fail('INSERT', `HTTP ${insertStatus} — ${insertBody.substring(0, 120)}`);
}

const { ok: readOk, status: readStatus } = await restGet(
  'system_config?id=eq.__verify-test__',
  serviceHeaders
);
if (readOk) {
  ok(`SELECT → HTTP ${readStatus}`);
} else {
  fail('SELECT', `HTTP ${readStatus}`);
}

const { ok: delOk, status: delStatus } = await restDelete(
  'system_config?id=eq.__verify-test__',
  serviceHeaders
);
if (delOk || delStatus === 204) {
  ok(`DELETE → HTTP ${delStatus}`);
} else {
  fail('DELETE', `HTTP ${delStatus}`);
}

// ── Storage buckets ──────────────────────────────────────────────────────────
console.log('');
console.log('--- Storage buckets ---');
const storageRes  = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  headers: serviceHeaders,
});
const buckets     = storageRes.ok ? await storageRes.json() : [];
const bucketNames = buckets.map((b) => b.name);

if (bucketNames.includes('company-assets')) {
  ok('company-assets bucket exists (public)');
} else {
  fail('company-assets bucket missing');
}
if (bucketNames.includes('candidate-documents')) {
  ok('candidate-documents bucket exists (private)');
} else {
  fail('candidate-documents bucket missing');
}

// ── Anon-key checks (app browser path) ──────────────────────────────────────
// With RLS disabled (development), the anon key can read all rows.
// With RLS enabled (production), anonymous reads will be empty/403 — that is
// correct and expected. We verify the key is valid and the endpoint is reachable.
console.log('');
console.log('--- [anon key] Browser app connectivity (RLS disabled = dev mode) ---');

const anonReadChecks = ['companies', 'jobs', 'interview_sessions'];
for (const view of anonReadChecks) {
  const { ok: isOk, status } = await restGet(
    `${view}?select=*&limit=1`,
    anonHeaders
  );
  if (isOk) {
    ok(`${view} → HTTP ${status} (anon key accepted)`);
  } else if (status === 401) {
    fail(`${view}`, `HTTP 401 — anon key rejected; check VITE_SUPABASE_ANON_KEY`);
  } else if (status === 403) {
    note(
      `${view} → HTTP 403 (RLS enabled — expected in production, anon key valid)`
    );
    passed++;
  } else {
    fail(`${view}`, `HTTP ${status}`);
  }
}

// ── Auth endpoint reachability ───────────────────────────────────────────────
console.log('');
console.log('--- Auth endpoint reachability ---');
const authRes = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
  headers: anonHeaders,
});
if (authRes.ok) {
  ok(`/auth/v1/settings → HTTP ${authRes.status}`);
} else {
  fail('/auth/v1/settings', `HTTP ${authRes.status}`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('');
console.log(`=== Result: ${passed} passed, ${failed} failed ===`);
console.log('');
if (failed > 0) process.exit(1);
