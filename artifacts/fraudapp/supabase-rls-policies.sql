-- HireGood / FraudGuard SaaS – Row Level Security Policies
-- Apply this AFTER supabase-schema.sql when deploying to production.
--
-- IMPORTANT: These policies assume Supabase Auth is in use.
-- The app must store the Supabase Auth user ID in _users.id and
-- the user's company in _users.company_id.
--
-- HOW TO APPLY:
--   node artifacts/fraudapp/scripts/apply-schema.mjs   (applies base schema)
--   node artifacts/fraudapp/scripts/apply-rls.mjs      (applies these policies)
--
-- ARCHITECTURE NOTES:
--   - RLS is enabled on BASE TABLES (_companies, _jobs, etc.) only.
--   - The camelCase views (companies, jobs, etc.) inherit the base table RLS.
--   - System Admins (role = 'System Admin') have full access to all rows via
--     the is_system_admin() helper which bypasses company-scoped restrictions.
--   - The service-role key bypasses ALL RLS and is for server-side use only.
--   - The anon key + Supabase Auth JWT is used for all client-side queries.

-- ============================================================
-- ENABLE RLS ON ALL BASE TABLES
-- ============================================================
alter table _users               enable row level security;
alter table _companies           enable row level security;
alter table _jobs                enable row level security;
alter table _applications        enable row level security;
alter table _interview_sessions  enable row level security;
alter table _assessment_invites  enable row level security;
alter table _workflows           enable row level security;
alter table _notifications       enable row level security;
alter table _credit_transactions enable row level security;
alter table _system_config       enable row level security;
alter table _audit_logs          enable row level security;
alter table _pricing_config      enable row level security;
alter table _promo_codes         enable row level security;
alter table _payment_transactions enable row level security;

-- ============================================================
-- HELPER: get current user's company_id from _users
-- SECURITY DEFINER so it can read _users even when the caller
-- only has limited access (e.g. via the anon key + JWT).
-- ============================================================
create or replace function auth_company_id()
returns uuid language sql security definer stable as $$
  select company_id from _users where id = auth.uid()
$$;

-- ============================================================
-- HELPER: get current user's role from _users
-- SECURITY DEFINER to bypass RLS when reading _users.
-- Used in the _users update policy to prevent self-escalation.
-- ============================================================
create or replace function auth_user_role()
returns text language sql security definer stable as $$
  select role from _users where id = auth.uid()
$$;

-- ============================================================
-- HELPER: true when the authenticated user is a System Admin
-- Used in every table's admin-override policy so that admin
-- users logging in via the browser can see all rows.
-- ============================================================
create or replace function is_system_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from _users where id = auth.uid() and role = 'System Admin'
  )
$$;

-- ============================================================
-- HELPER: returns IDs of all users in the current user's company
-- SECURITY DEFINER to bypass the per-row _users RLS so that
-- company-wide audit log reads work correctly.
-- ============================================================
create or replace function company_member_ids()
returns setof uuid language sql security definer stable as $$
  select id from _users where company_id = auth_company_id()
$$;

-- ============================================================
-- _users
-- • Each user can read and update their own row.
-- • Each user can insert their own profile (on signup).
-- • System admins can read / update / insert any user.
--
-- Security constraints enforced by RLS:
-- INSERT  — Direct client INSERT requires company_id IS NULL and role != 'System Admin'.
--           Self-service signup MUST call the provision_company() SECURITY DEFINER
--           RPC which atomically creates the company + user in one trusted call,
--           preventing tenant-boundary bypass via arbitrary company_id injection.
--           Admin profile creation must use the service-role key (backend path).
-- UPDATE  — role is immutable for non-admins (prevents privilege escalation).
--           company_id is also immutable for non-admins once set (prevents
--           tenant-switching after initial signup).
-- ============================================================
create policy "users: own row read"
  on _users for select
  using (id = auth.uid() or is_system_admin());

-- Self-service signup MUST use the provision_company() SECURITY DEFINER RPC
-- which atomically creates the company and user profile. Direct client INSERT
-- is restricted to profile rows with company_id IS NULL (no tenant supplied),
-- preventing cross-tenant bypass via arbitrary company_id at insert time.
create policy "users: own row insert"
  on _users for insert
  with check (
    is_system_admin()
    or (
      id = auth.uid()
      and role != 'System Admin'
      and company_id is null
    )
  );

create policy "users: own row update"
  on _users for update
  using (id = auth.uid() or is_system_admin())
  with check (
    is_system_admin()
    or (
      id = auth.uid()
      -- Role is immutable for non-admin users (prevents escalation).
      and role is not distinct from auth_user_role()
      -- company_id is immutable once set (prevents tenant-switching).
      -- This covers both "no change" and "already NULL stays NULL".
      and company_id is not distinct from auth_company_id()
    )
  );

create policy "users: admin delete"
  on _users for delete
  using (is_system_admin());

-- ============================================================
-- _companies
-- • Company users can read / update only their own company.
-- • System admins have full CRUD across all companies.
-- • Unauthenticated (public) users may read company data so that
--   the public assessment page can show company branding/info
--   (e.g., getCompanyById called from PublicAssessment.tsx).
-- • Direct INSERT is admin-only; self-service signup uses the
--   provision_company() SECURITY DEFINER RPC instead.
-- ============================================================
-- Public candidate access to company data is handled by the
-- get_company_for_public() SECURITY DEFINER RPC (called from
-- PublicAssessment.tsx via getCompanyById), which returns only
-- a safe subset of columns for a specific company_id.
-- Authenticated users see only their own company; admins see all.
create policy "companies: own company read"
  on _companies for select
  using (id = auth_company_id() or is_system_admin());

-- Direct INSERT on _companies is admin-only.
-- Self-service company creation MUST go through the provision_company()
-- SECURITY DEFINER RPC, which creates both company and user profile
-- atomically with trusted server-side logic.
create policy "companies: admin insert"
  on _companies for insert
  with check (is_system_admin());

create policy "companies: own company update"
  on _companies for update
  using (id = auth_company_id() or is_system_admin())
  with check (id = auth_company_id() or is_system_admin());

create policy "companies: admin delete"
  on _companies for delete
  using (is_system_admin());

-- ============================================================
-- _jobs: scoped to company
-- ============================================================
create policy "jobs: company read"
  on _jobs for select
  using (company_id = auth_company_id() or is_system_admin());

create policy "jobs: company insert"
  on _jobs for insert
  with check (company_id = auth_company_id() or is_system_admin());

create policy "jobs: company update"
  on _jobs for update
  using (company_id = auth_company_id() or is_system_admin())
  with check (company_id = auth_company_id() or is_system_admin());

create policy "jobs: company delete"
  on _jobs for delete
  using (company_id = auth_company_id() or is_system_admin());

-- ============================================================
-- _applications: scoped to company
-- ============================================================
create policy "applications: company read"
  on _applications for select
  using (company_id = auth_company_id() or is_system_admin());

create policy "applications: company insert"
  on _applications for insert
  with check (company_id = auth_company_id() or is_system_admin());

create policy "applications: company update"
  on _applications for update
  using (company_id = auth_company_id() or is_system_admin())
  with check (company_id = auth_company_id() or is_system_admin());

create policy "applications: company delete"
  on _applications for delete
  using (company_id = auth_company_id() or is_system_admin());

-- ============================================================
-- _interview_sessions: scoped to company
-- ============================================================
create policy "sessions: company read"
  on _interview_sessions for select
  using (company_id = auth_company_id() or is_system_admin());

create policy "sessions: company insert"
  on _interview_sessions for insert
  with check (company_id = auth_company_id() or is_system_admin());

create policy "sessions: company update"
  on _interview_sessions for update
  using (company_id = auth_company_id() or is_system_admin())
  with check (company_id = auth_company_id() or is_system_admin());

create policy "sessions: company delete"
  on _interview_sessions for delete
  using (company_id = auth_company_id() or is_system_admin());

-- ============================================================
-- _assessment_invites: scoped to company
-- Unauthenticated candidate flows (PublicAssessment.tsx) are
-- handled through SECURITY DEFINER RPCs:
--   • verify_access_code(code)       — reads one invite by code
--   • mark_access_code_used(code, …) — updates one invite by code
-- These RPCs bypass RLS server-side and are constrained to a
-- single row by the opaque access_code; no anonymous policy is
-- needed or desirable.
-- ============================================================
create policy "invites: company read"
  on _assessment_invites for select
  using (company_id = auth_company_id() or is_system_admin());

create policy "invites: company insert"
  on _assessment_invites for insert
  with check (company_id = auth_company_id() or is_system_admin());

create policy "invites: company update"
  on _assessment_invites for update
  using (company_id = auth_company_id() or is_system_admin())
  with check (company_id = auth_company_id() or is_system_admin());

create policy "invites: company delete"
  on _assessment_invites for delete
  using (company_id = auth_company_id() or is_system_admin());

-- ============================================================
-- _workflows: scoped to company
-- ============================================================
create policy "workflows: company read"
  on _workflows for select
  using (company_id = auth_company_id() or is_system_admin());

create policy "workflows: company insert"
  on _workflows for insert
  with check (company_id = auth_company_id() or is_system_admin());

create policy "workflows: company update"
  on _workflows for update
  using (company_id = auth_company_id() or is_system_admin())
  with check (company_id = auth_company_id() or is_system_admin());

create policy "workflows: company delete"
  on _workflows for delete
  using (company_id = auth_company_id() or is_system_admin());

-- ============================================================
-- _notifications: scoped to user
-- Insert allowed for the company (server-side or same-company user)
-- so that notification-creation calls from company admins work.
-- ============================================================
create policy "notifications: own read"
  on _notifications for select
  using (user_id = auth.uid() or is_system_admin());

create policy "notifications: company insert"
  on _notifications for insert
  with check (company_id = auth_company_id() or is_system_admin());

create policy "notifications: own update"
  on _notifications for update
  using (user_id = auth.uid() or is_system_admin())
  with check (user_id = auth.uid() or is_system_admin());

create policy "notifications: admin delete"
  on _notifications for delete
  using (user_id = auth.uid() or is_system_admin());

-- ============================================================
-- _credit_transactions: scoped to company
-- Clients may insert (credit deductions happen in the app).
-- Admins retain full CRUD for correction and reconciliation.
-- ============================================================
create policy "credits: company read"
  on _credit_transactions for select
  using (company_id = auth_company_id() or is_system_admin());

create policy "credits: company insert"
  on _credit_transactions for insert
  with check (company_id = auth_company_id() or is_system_admin());

create policy "credits: admin update"
  on _credit_transactions for update
  using (is_system_admin())
  with check (is_system_admin());

create policy "credits: admin delete"
  on _credit_transactions for delete
  using (is_system_admin());

-- ============================================================
-- _payment_transactions: scoped to company
-- Inserts happen via payment gateway callbacks (service-role).
-- Admins retain full CRUD for reconciliation and correction.
-- ============================================================
create policy "payments: company read"
  on _payment_transactions for select
  using (company_id = auth_company_id() or is_system_admin());

create policy "payments: company insert"
  on _payment_transactions for insert
  with check (company_id = auth_company_id() or is_system_admin());

create policy "payments: admin update"
  on _payment_transactions for update
  using (is_system_admin())
  with check (is_system_admin());

create policy "payments: admin delete"
  on _payment_transactions for delete
  using (is_system_admin());

-- ============================================================
-- _system_config, _pricing_config: read-only for authenticated
-- users; write access only for system admins
-- ============================================================
create policy "system_config: authenticated read"
  on _system_config for select
  using (auth.uid() is not null);

create policy "system_config: admin write"
  on _system_config for all
  using (is_system_admin())
  with check (is_system_admin());

create policy "pricing_config: authenticated read"
  on _pricing_config for select
  using (auth.uid() is not null);

create policy "pricing_config: admin write"
  on _pricing_config for all
  using (is_system_admin())
  with check (is_system_admin());

-- ============================================================
-- _promo_codes: readable by all authenticated users;
-- write access only for system admins
-- ============================================================
create policy "promo_codes: authenticated read"
  on _promo_codes for select
  using (auth.uid() is not null);

create policy "promo_codes: admin write"
  on _promo_codes for all
  using (is_system_admin())
  with check (is_system_admin());

-- ============================================================
-- _audit_logs: company-scoped reads; any authenticated user
-- may insert (audit log entries are append-only from the app)
--
-- The read policy uses company_member_ids() (SECURITY DEFINER)
-- to retrieve all user IDs in the current company. Reading
-- _users directly here would be limited by the per-row _users
-- RLS policy (users can only see their own row), which would
-- incorrectly collapse company-wide audit visibility to just
-- the current user's own audit entries.
-- ============================================================
create policy "audit: company read"
  on _audit_logs for select
  using (
    is_system_admin() or
    -- user_id is stored as text; cast the UUID set to text for comparison.
    user_id in (select id::text from company_member_ids())
  );

create policy "audit: authenticated insert"
  on _audit_logs for insert
  with check (auth.uid() is not null);

create policy "audit: admin update"
  on _audit_logs for update
  using (is_system_admin())
  with check (is_system_admin());

create policy "audit: admin delete"
  on _audit_logs for delete
  using (is_system_admin());

-- ============================================================
-- VIEW SECURITY: set security_invoker = on for all camelCase views
--
-- In PostgreSQL, views run as the view OWNER by default (security
-- definer semantics).  This means RLS on the underlying base tables
-- could be bypassed if the view owner is a superuser/postgres role.
-- Setting security_invoker = on forces each view to execute with
-- the CALLER'S permissions so the base-table RLS is fully enforced.
--
-- This is the Supabase-recommended approach for views that sit on
-- top of RLS-enabled base tables.
-- ============================================================
alter view users                set (security_invoker = on);
alter view companies            set (security_invoker = on);
alter view jobs                 set (security_invoker = on);
alter view applications         set (security_invoker = on);
alter view interview_sessions   set (security_invoker = on);
alter view assessment_invites   set (security_invoker = on);
alter view workflows            set (security_invoker = on);
alter view notifications        set (security_invoker = on);
alter view credit_transactions  set (security_invoker = on);
alter view system_config        set (security_invoker = on);
alter view audit_logs           set (security_invoker = on);
alter view pricing_config       set (security_invoker = on);
alter view promo_codes          set (security_invoker = on);
alter view payment_transactions set (security_invoker = on);

-- ============================================================
-- NOTE: Service-role key access
-- The service-role key bypasses ALL RLS policies. Use it only
-- on the server side (API server, Edge Functions). Never expose
-- the service-role key to the browser.
-- ============================================================
