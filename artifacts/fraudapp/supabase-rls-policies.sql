-- HireGood / FraudGuard SaaS – Row Level Security Policies
-- Apply this AFTER supabase-schema.sql when deploying to production.
--
-- IMPORTANT: These policies assume Supabase Auth is in use.
-- The app must store the Supabase Auth user ID in _users.id and
-- the user's company in _users.company_id.
--
-- HOW TO APPLY:
--   node artifacts/fraudapp/scripts/apply-schema.mjs   (applies base schema)
--   Then run this file through the Supabase SQL Editor or via the Management API.
--
-- ARCHITECTURE NOTES:
--   - RLS is enabled on BASE TABLES (_companies, _jobs, etc.) only.
--   - The camelCase views (companies, jobs, etc.) inherit the base table RLS.
--   - System Admins have full access to all rows via the service-role key.
--   - Company users can only access rows where company_id = their company.
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
-- ============================================================
create or replace function auth_company_id()
returns uuid language sql security definer stable as $$
  select company_id from _users where id = auth.uid()
$$;

-- ============================================================
-- _users: users can read/update their own row
-- ============================================================
create policy "users: own row read"
  on _users for select
  using (id = auth.uid());

create policy "users: own row update"
  on _users for update
  using (id = auth.uid());

-- ============================================================
-- _companies: users can read/update their own company
-- ============================================================
create policy "companies: own company read"
  on _companies for select
  using (id = auth_company_id());

create policy "companies: own company update"
  on _companies for update
  using (id = auth_company_id());

-- ============================================================
-- _jobs: scoped to company
-- ============================================================
create policy "jobs: company read"
  on _jobs for select
  using (company_id = auth_company_id());

create policy "jobs: company insert"
  on _jobs for insert
  with check (company_id = auth_company_id());

create policy "jobs: company update"
  on _jobs for update
  using (company_id = auth_company_id());

create policy "jobs: company delete"
  on _jobs for delete
  using (company_id = auth_company_id());

-- ============================================================
-- _applications: scoped to company
-- ============================================================
create policy "applications: company read"
  on _applications for select
  using (company_id = auth_company_id());

create policy "applications: company insert"
  on _applications for insert
  with check (company_id = auth_company_id());

create policy "applications: company update"
  on _applications for update
  using (company_id = auth_company_id());

create policy "applications: company delete"
  on _applications for delete
  using (company_id = auth_company_id());

-- ============================================================
-- _interview_sessions: scoped to company
-- ============================================================
create policy "sessions: company read"
  on _interview_sessions for select
  using (company_id = auth_company_id());

create policy "sessions: company insert"
  on _interview_sessions for insert
  with check (company_id = auth_company_id());

create policy "sessions: company update"
  on _interview_sessions for update
  using (company_id = auth_company_id());

create policy "sessions: company delete"
  on _interview_sessions for delete
  using (company_id = auth_company_id());

-- ============================================================
-- _assessment_invites: scoped to company
-- ============================================================
create policy "invites: company read"
  on _assessment_invites for select
  using (company_id = auth_company_id());

create policy "invites: company insert"
  on _assessment_invites for insert
  with check (company_id = auth_company_id());

create policy "invites: company update"
  on _assessment_invites for update
  using (company_id = auth_company_id());

create policy "invites: company delete"
  on _assessment_invites for delete
  using (company_id = auth_company_id());

-- ============================================================
-- _workflows: scoped to company
-- ============================================================
create policy "workflows: company read"
  on _workflows for select
  using (company_id = auth_company_id());

create policy "workflows: company insert"
  on _workflows for insert
  with check (company_id = auth_company_id());

create policy "workflows: company update"
  on _workflows for update
  using (company_id = auth_company_id());

create policy "workflows: company delete"
  on _workflows for delete
  using (company_id = auth_company_id());

-- ============================================================
-- _notifications: scoped to user
-- ============================================================
create policy "notifications: own read"
  on _notifications for select
  using (user_id = auth.uid());

create policy "notifications: own update"
  on _notifications for update
  using (user_id = auth.uid());

-- ============================================================
-- _credit_transactions: scoped to company (read-only for clients)
-- ============================================================
create policy "credits: company read"
  on _credit_transactions for select
  using (company_id = auth_company_id());

-- ============================================================
-- _payment_transactions: scoped to company (read-only for clients)
-- ============================================================
create policy "payments: company read"
  on _payment_transactions for select
  using (company_id = auth_company_id());

-- ============================================================
-- _system_config, _pricing_config: read-only for authenticated users
-- ============================================================
create policy "system_config: authenticated read"
  on _system_config for select
  using (auth.uid() is not null);

create policy "pricing_config: authenticated read"
  on _pricing_config for select
  using (auth.uid() is not null);

-- ============================================================
-- _promo_codes: read-only for authenticated users
-- ============================================================
create policy "promo_codes: authenticated read"
  on _promo_codes for select
  using (auth.uid() is not null);

-- ============================================================
-- _audit_logs: company-scoped, insert-only for clients
-- ============================================================
create policy "audit: company read"
  on _audit_logs for select
  using (user_id::text in (
    select id::text from _users where company_id = auth_company_id()
  ));

-- ============================================================
-- NOTE: System Admin access
-- The service-role key bypasses ALL RLS policies. Use it only
-- on the server side (API server, Edge Functions). Never expose
-- the service-role key to the browser.
-- ============================================================
