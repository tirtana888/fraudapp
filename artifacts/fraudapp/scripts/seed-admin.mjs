/**
 * seed-admin.mjs
 * Creates the first System Admin user in Supabase Auth and the _users table.
 *
 * ─── RUNBOOK ────────────────────────────────────────────────────────────────
 *
 *  1. Ensure the following secrets are set in your Replit environment:
 *       VITE_SUPABASE_URL          Supabase project URL
 *                                  (e.g. https://behtywhlundlfxkdesux.supabase.co)
 *       SUPABASE_SERVICE_ROLE_KEY  Service role key — found in Supabase →
 *                                  Project Settings → API → service_role key
 *       SUPABASE_ACCESS_TOKEN      Personal access token — found at
 *                                  supabase.com/dashboard/account/tokens
 *
 *  2. Run the script (from the workspace root):
 *       node artifacts/fraudapp/scripts/seed-admin.mjs
 *
 *  3. The script prints the generated password once. Save it immediately.
 *
 *  4. Optional overrides via environment variables:
 *       ADMIN_EMAIL     defaults to admin@fraudguard.io
 *       ADMIN_PASSWORD  defaults to a randomly generated 20-char password
 *       ADMIN_NAME      defaults to "System Admin"
 *
 *  5. The script is idempotent — re-running it will update the existing user's
 *     _users row to role = 'System Admin' without creating duplicates.
 *     NOTE: re-running does NOT change the password of an existing auth user.
 *     To reset the password, use the Supabase Auth dashboard or pass a new
 *     ADMIN_PASSWORD env var and run with --reset-password (see below).
 *
 *  6. To change the admin password later:
 *       ADMIN_PASSWORD=<new-password> node artifacts/fraudapp/scripts/seed-admin.mjs
 *     The script will detect the existing user and skip the Auth creation step,
 *     then upsert the _users row. To also update the password, use the Supabase
 *     dashboard under Authentication → Users → Reset password.
 *
 * ─── SECURITY NOTES ─────────────────────────────────────────────────────────
 *  • The SERVICE_ROLE_KEY and ACCESS_TOKEN must NEVER be committed to source
 *    control. They are stored only as Replit secrets.
 *  • The generated password is printed to stdout once and stored in
 *    .local/admin-credentials.txt (git-ignored). Treat it as a secret.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SUPABASE_URL       = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_TOKEN       = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ACCESS_TOKEN) {
  console.error('ERROR: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ACCESS_TOKEN must be set');
  process.exit(1);
}

const PROJECT_REF = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
const MGMT_URL    = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@fraudguard.io';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || generatePassword();
const ADMIN_NAME     = process.env.ADMIN_NAME     || 'System Admin';

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  for (let i = 0; i < 20; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

/**
 * Run an arbitrary SQL query via the Supabase Management API.
 * Uses the personal access token (not the service role key).
 */
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

/**
 * Create a new Auth user via the service-role Admin API.
 * If the email is already registered, fall back to fetchExistingAuthUser().
 */
async function createAuthUser() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    const msg = body?.msg || body?.message || '';
    if (msg.includes('already been registered') || msg.includes('already exists') || res.status === 422) {
      console.log('  Auth user already exists, looking up existing user via SQL...');
      return fetchExistingAuthUser();
    }
    throw new Error(`Auth user creation failed (HTTP ${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * Deterministically fetch an existing Supabase Auth user by email using a
 * direct SQL query against auth.users.  This avoids pagination issues that
 * the REST list endpoint may have with large user sets.
 */
async function fetchExistingAuthUser() {
  const emailEsc = ADMIN_EMAIL.replace(/'/g, "''");
  const rows = await runSql(
    `SELECT id::text, email FROM auth.users WHERE email = '${emailEsc}' LIMIT 1`
  );
  if (!rows || rows.length === 0) {
    throw new Error(
      `Could not find an existing auth user with email "${ADMIN_EMAIL}". ` +
      'Verify the email is correct and that the account exists in Supabase Auth.'
    );
  }
  return rows[0];
}

console.log('');
console.log('=== FraudGuard – Seed Admin User ===');
console.log(`Project ref : ${PROJECT_REF}`);
console.log(`Email       : ${ADMIN_EMAIL}`);
console.log(`Name        : ${ADMIN_NAME}`);
console.log('');

console.log('Step 1: Creating Supabase Auth user...');
const authUser = await createAuthUser();
const userId = authUser.id;
console.log(`  Auth user created/found — id: ${userId}`);

console.log('Step 2: Upserting _users row with role = System Admin...');
const emailEsc = ADMIN_EMAIL.replace(/'/g, "''");
const nameEsc  = ADMIN_NAME.replace(/'/g, "''");
await runSql(`
  INSERT INTO public._users (id, email, name, role, email_verified, created_at, updated_at)
  VALUES (
    '${userId}',
    '${emailEsc}',
    '${nameEsc}',
    'System Admin',
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET role           = 'System Admin',
        name           = EXCLUDED.name,
        email_verified = true,
        updated_at     = now();
`);
console.log('  _users row upserted successfully');

console.log('');
console.log('=== Admin user ready ===');
console.log('');
console.log('  Login credentials:');
console.log(`    Email    : ${ADMIN_EMAIL}`);
if (!process.env.ADMIN_PASSWORD) {
  console.log(`    Password : ${ADMIN_PASSWORD}`);
  console.log('');
  console.log('  IMPORTANT: Save this password now — it will not be shown again.');
}
console.log('');
console.log('  The user can now log in at the FraudGuard login page.');
console.log('');
