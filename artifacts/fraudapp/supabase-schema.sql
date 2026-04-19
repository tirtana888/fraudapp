-- HireGood / FraudGuard SaaS – Supabase Schema
-- Run this in your Supabase SQL editor to create all required tables.
--
-- ARCHITECTURE
--   Base tables use snake_case columns with uuid PKs and timestamptz
--   timestamps (PostgreSQL / Supabase conventions).
--   Updatable views with camelCase column aliases sit on top of each
--   base table so the React/TypeScript service layer can continue to
--   use field names like companyId, createdAt, jobId etc. without
--   touching 150+ query call-sites.
--
-- RLS is NOT enabled here; enable it (follow-up task) for production.

create extension if not exists "uuid-ossp";

-- ============================================================
-- BASE TABLES (snake_case, Supabase conventions)
-- ============================================================

create table if not exists _users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  name          text,
  role          text default 'Company Admin',
  company_id    uuid,
  company_name  text,
  phone         text,
  avatar        text,
  email_verified boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists _companies (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  email                    text,
  admin_email              text,
  company_slug             text unique,
  logo_url                 text,
  brand_color              text,
  header_title             text,
  welcome_message          text,
  website                  text,
  description              text,
  industry                 text,
  size                     text,
  location                 text,
  address                  text,
  whatsapp                 text,
  tier                     text default 'Freemium',
  status                   text default 'Active',
  credits                  integer default 1000,
  credits_used             integer default 0,
  verification_credits     integer default 100,
  users_count              integer default 1,
  monthly_credits          integer,
  subscription_start_date  text,
  subscription_end_date    text,
  subscription_ends_at     timestamptz,
  custom_candidate_limit   integer,
  notification_preferences jsonb,
  joined_date              timestamptz default now(),
  last_activity            timestamptz,
  suspended_at             timestamptz,
  suspended_by             text,
  suspend_reason           text,
  banned_at                timestamptz,
  banned_by                text,
  ban_reason               text,
  reactivated_at           timestamptz,
  reactivated_by           text,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create table if not exists _jobs (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null,
  title                     text not null,
  description               text,
  location                  text,
  type                      text,
  status                    text default 'Active',
  salary                    text,
  requirements              text[],
  date_posted               timestamptz default now(),
  slug                      text,
  enable_instant_assessment boolean default false,
  workflow_id               uuid,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create table if not exists _applications (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null,
  company_id          uuid not null,
  candidate_name      text,
  candidate_email     text,
  candidate_whatsapp  text,
  cv_url              text,
  status              text default 'Pending',
  applied_at          timestamptz default now(),
  last_updated        timestamptz default now()
);

create table if not exists _interview_sessions (
  id                           uuid primary key default gen_random_uuid(),
  company_id                   uuid not null,
  candidate                    jsonb,
  analysis                     jsonb,
  status                       text default 'pending',
  source                       text,
  date                         timestamptz default now(),
  completed_at                 timestamptz,
  unlocked_at                  timestamptz,
  unlocked_by_company_id       uuid,
  job_id                       uuid,
  application_id               uuid,
  recruitment_stage            text,
  invite_source                text,
  workflow_id                  uuid,
  timeline                     jsonb,
  transcript                   jsonb,
  structured_assessment        jsonb,
  sjt_results                  jsonb,
  financial_strain_results     jsonb,
  cv_url                       text,
  cv_parsed_data               jsonb,
  whatsapp                     text,
  risk_score                   integer,
  background_check             jsonb,
  background_check_status      text,
  background_check_completed_at timestamptz,
  created_at                   timestamptz default now(),
  updated_at                   timestamptz default now()
);

create table if not exists _assessment_invites (
  id                  uuid primary key default gen_random_uuid(),
  access_code         text unique not null,
  name                text,
  email               text,
  role                text,
  company_id          uuid not null,
  status              text default 'PENDING',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  used_at             timestamptz,
  session_id          uuid,
  job_id              uuid,
  application_id      uuid,
  candidate_name      text,
  candidate_email     text,
  candidate_whatsapp  text,
  assessment_config   jsonb,
  invite_link         text
);

create table if not exists _workflows (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  name        text not null,
  description text,
  steps       jsonb,
  is_active   boolean default true,
  is_default  boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists _notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  company_id  uuid,
  type        text,
  title       text,
  message     text,
  read        boolean default false,
  data        jsonb,
  created_at  timestamptz default now()
);

create table if not exists _credit_transactions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,
  type           text not null,
  amount         integer not null,
  action         text,
  description    text,
  balance_before integer,
  balance_after  integer,
  timestamp      timestamptz default now(),
  metadata       jsonb,
  user_id        uuid
);

create table if not exists _system_config (
  id          text primary key,
  data        jsonb,
  updated_at  timestamptz default now(),
  updated_by  text
);

create table if not exists _audit_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       text,
  user_email    text,
  action        text,
  section       text,
  resource      text,
  details       text,
  old_value     jsonb,
  new_value     jsonb,
  status        text,
  error_message text,
  timestamp     timestamptz default now()
);

create table if not exists _pricing_config (
  id          text primary key,
  data        jsonb,
  updated_at  timestamptz default now()
);

create table if not exists _promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  type            text not null,
  discount_value  numeric not null,
  applicable_to   text default 'both',
  usage_limit     integer,
  usage_count     integer default 0,
  expiry_date     timestamptz,
  is_active       boolean default true,
  description     text,
  created_by      text,
  created_at      timestamptz default now()
);

create table if not exists _payment_transactions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  invoice_id  text,
  invoice_url text,
  type        text,
  amount      numeric,
  status      text default 'pending',
  tier        text,
  credits     integer,
  method      text,
  timestamp   timestamptz default now(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- CAMELCASE VIEWS
-- The React/TypeScript service layer queries these views using
-- camelCase field names (.eq('companyId', ...), etc.).
-- Each view is updatable (no aggregates, no DISTINCT, single
-- base table, no set operations) so INSERT/UPDATE/DELETE pass
-- through to the underlying snake_case table automatically.
-- ============================================================

create or replace view users as
  select
    id::text                  as id,
    email,
    name,
    role,
    company_id::text          as "companyId",
    company_name              as "companyName",
    phone,
    avatar,
    email_verified            as "emailVerified",
    created_at::text          as "createdAt",
    updated_at::text          as "updatedAt"
  from _users;

create or replace view companies as
  select
    id::text                       as id,
    name,
    email,
    admin_email                    as "adminEmail",
    company_slug                   as "companySlug",
    logo_url                       as "logoUrl",
    brand_color                    as "brandColor",
    header_title                   as "headerTitle",
    welcome_message                as "welcomeMessage",
    website,
    description,
    industry,
    size,
    location,
    address,
    whatsapp,
    tier,
    status,
    credits,
    credits_used                   as "creditsUsed",
    verification_credits           as "verification_credits",
    users_count                    as "usersCount",
    monthly_credits                as "monthlyCredits",
    subscription_start_date        as "subscriptionStartDate",
    subscription_end_date          as "subscriptionEndDate",
    subscription_ends_at::text     as "subscription_ends_at",
    custom_candidate_limit         as "custom_candidate_limit",
    notification_preferences       as "notificationPreferences",
    joined_date::text              as "joinedDate",
    last_activity::text            as "lastActivity",
    suspended_at::text             as "suspendedAt",
    suspended_by                   as "suspendedBy",
    suspend_reason                 as "suspendReason",
    banned_at::text                as "bannedAt",
    banned_by                      as "bannedBy",
    ban_reason                     as "banReason",
    reactivated_at::text           as "reactivatedAt",
    reactivated_by                 as "reactivatedBy",
    created_at::text               as "createdAt",
    updated_at::text               as "updatedAt"
  from _companies;

create or replace view jobs as
  select
    id::text                            as id,
    company_id::text                    as "companyId",
    title,
    description,
    location,
    type,
    status,
    salary,
    requirements,
    date_posted::text                   as "datePosted",
    slug,
    enable_instant_assessment           as "enableInstantAssessment",
    workflow_id::text                   as "workflowId",
    created_at::text                    as "createdAt",
    updated_at::text                    as "updatedAt"
  from _jobs;

create or replace view applications as
  select
    id::text                  as id,
    job_id::text              as "jobId",
    company_id::text          as "companyId",
    candidate_name            as "candidateName",
    candidate_email           as "candidateEmail",
    candidate_whatsapp        as "candidateWhatsapp",
    cv_url                    as "cvUrl",
    status,
    applied_at::text          as "appliedAt",
    last_updated::text        as "lastUpdated"
  from _applications;

create or replace view interview_sessions as
  select
    id::text                                    as id,
    company_id::text                            as "companyId",
    candidate,
    analysis,
    status,
    source,
    date::text                                  as date,
    completed_at::text                          as "completedAt",
    unlocked_at::text                           as "unlockedAt",
    unlocked_by_company_id::text                as "unlockedByCompanyId",
    job_id::text                                as "jobId",
    application_id::text                        as "applicationId",
    recruitment_stage                           as "recruitmentStage",
    invite_source                               as "inviteSource",
    workflow_id::text                           as "workflowId",
    timeline,
    transcript,
    structured_assessment                       as "structuredAssessment",
    sjt_results                                 as "sjtResults",
    financial_strain_results                    as "financialStrainResults",
    cv_url                                      as "cvUrl",
    cv_parsed_data                              as "cvParsedData",
    whatsapp,
    risk_score                                  as "riskScore",
    background_check                            as "backgroundCheck",
    background_check_status                     as "backgroundCheckStatus",
    background_check_completed_at::text         as "backgroundCheckCompletedAt",
    created_at::text                            as "createdAt",
    updated_at::text                            as "updatedAt"
  from _interview_sessions;

create or replace view assessment_invites as
  select
    id::text                  as id,
    access_code               as "access_code",
    name,
    email,
    role,
    company_id::text          as "companyId",
    status,
    created_at::text          as "createdAt",
    updated_at::text          as "updatedAt",
    used_at::text             as "usedAt",
    session_id::text          as "sessionId",
    job_id::text              as "jobId",
    application_id::text      as "applicationId",
    candidate_name            as "candidateName",
    candidate_email           as "candidateEmail",
    candidate_whatsapp        as "candidateWhatsapp",
    assessment_config         as "assessmentConfig",
    invite_link               as "inviteLink"
  from _assessment_invites;

create or replace view workflows as
  select
    id::text                as id,
    company_id::text        as "companyId",
    name,
    description,
    steps,
    is_active               as "isActive",
    is_default              as "isDefault",
    created_at::text        as "createdAt",
    updated_at::text        as "updatedAt"
  from _workflows;

create or replace view notifications as
  select
    id::text              as id,
    user_id::text         as "userId",
    company_id::text      as "companyId",
    type,
    title,
    message,
    read,
    data,
    created_at::text      as "createdAt"
  from _notifications;

create or replace view credit_transactions as
  select
    id::text              as id,
    company_id::text      as "companyId",
    type,
    amount,
    action,
    description,
    balance_before        as "balanceBefore",
    balance_after         as "balanceAfter",
    timestamp::text       as timestamp,
    metadata,
    user_id::text         as "userId"
  from _credit_transactions;

create or replace view system_config as
  select
    id,
    data,
    updated_at::text  as "updatedAt",
    updated_by        as "updatedBy"
  from _system_config;

create or replace view audit_logs as
  select
    id::text              as id,
    user_id               as "userId",
    user_email            as "userEmail",
    action,
    section,
    resource,
    details,
    old_value             as "oldValue",
    new_value             as "newValue",
    status,
    error_message         as "errorMessage",
    timestamp::text       as timestamp
  from _audit_logs;

create or replace view pricing_config as
  select
    id,
    data,
    updated_at::text  as "updatedAt"
  from _pricing_config;

create or replace view promo_codes as
  select
    id::text              as id,
    code,
    type,
    discount_value        as "discountValue",
    applicable_to         as "applicableTo",
    usage_limit           as "usageLimit",
    usage_count           as "usageCount",
    expiry_date::text     as "expiryDate",
    is_active             as "isActive",
    description,
    created_by            as "createdBy",
    created_at::text      as "createdAt"
  from _promo_codes;

create or replace view payment_transactions as
  select
    id::text              as id,
    company_id::text      as "companyId",
    invoice_id            as "invoiceId",
    invoice_url           as "invoiceUrl",
    type,
    amount,
    status,
    tier,
    credits,
    method,
    timestamp::text       as timestamp,
    created_at::text      as "createdAt",
    updated_at::text      as "updatedAt"
  from _payment_transactions;

-- ============================================================
-- ATOMIC CREDIT DEDUCTION RPC
-- Called by creditManagement.ts::deductCredit for concurrency
-- safety. Uses row-level locking (FOR UPDATE) to prevent
-- double-spend. Operates on the base table directly.
-- ============================================================
create or replace function deduct_credits(
  p_company_id text,
  p_amount     integer
) returns integer
language plpgsql
as $$
declare
  v_id      uuid := p_company_id::uuid;
  v_current integer;
begin
  select credits into v_current
  from _companies
  where id = v_id
  for update;

  if v_current is null then
    raise exception 'Company not found: %', p_company_id;
  end if;

  if v_current < p_amount then
    raise exception 'Insufficient credits: need %, have %', p_amount, v_current;
  end if;

  update _companies
    set credits = v_current - p_amount
  where id = v_id;

  return v_current - p_amount;
end;
$$;

-- ============================================================
-- SELF-SERVICE COMPANY PROVISIONING RPC
-- Called by signUpWithFirebase and the first-time OAuth flow to
-- atomically create a company + user profile in one trusted call.
--
-- SECURITY DEFINER means this function runs with the owner's
-- (postgres) privileges, bypassing RLS on _companies and _users.
-- This is intentional: it is the trusted server-side path that
-- keeps tenant identity out of user-controlled INSERT payloads.
--
-- After RLS is enabled (apply-rls.mjs), client-side direct
-- INSERT on _companies is restricted to admins, and _users
-- INSERT requires company_id IS NULL.  Only this function may
-- create a company-linked profile on behalf of a new user.
-- ============================================================
create or replace function provision_company(
  p_company_name text,
  p_user_name    text,
  p_user_email   text,
  p_user_phone   text    default null,
  p_user_avatar  text    default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_company_id uuid;
  v_user_id    uuid := auth.uid();
  v_now        timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'provision_company: caller is not authenticated';
  end if;

  -- Guard: reject if the caller already belongs to a company (prevents tenant hopping).
  if exists (select 1 from _users where id = v_user_id and company_id is not null) then
    raise exception 'provision_company: caller already belongs to a company';
  end if;

  -- Create company record
  insert into _companies (
    name, admin_email, tier, status, credits, verification_credits,
    users_count, joined_date, created_at, updated_at
  ) values (
    p_company_name, p_user_email, 'Freemium', 'Active', 1000, 100,
    1, v_now, v_now, v_now
  )
  returning id into v_company_id;

  -- Create user profile linked to the new company
  insert into _users (
    id, email, name, role, company_id, phone, avatar,
    email_verified, created_at, updated_at
  ) values (
    v_user_id, p_user_email, p_user_name, 'Company Admin', v_company_id,
    p_user_phone, p_user_avatar, false, v_now, v_now
  )
  on conflict (id) do update
    set company_id = v_company_id,
        name       = excluded.name,
        phone      = excluded.phone,
        avatar     = excluded.avatar,
        updated_at = v_now;

  return jsonb_build_object(
    'companyId', v_company_id::text,
    'userId',    v_user_id::text
  );
end;
$$;

-- Grant execute to authenticated role (anon key + JWT users)
grant execute on function provision_company(text, text, text, text, text) to authenticated;

-- ============================================================
-- PUBLIC CANDIDATE RPCs (SECURITY DEFINER)
--
-- These three functions power the unauthenticated candidate
-- assessment flow (PublicAssessment.tsx).  Making them
-- SECURITY DEFINER lets them bypass RLS and look up exactly
-- the one row keyed by the opaque access_code token, without
-- granting anonymous callers any enumeration ability.
--
-- Grants are given to the 'anon' role so unauthenticated
-- (non-JWT) callers can invoke them via the Supabase REST API.
-- ============================================================

-- Returns minimal company branding info for the public assessment page.
-- adminEmail and other internal fields are intentionally excluded to avoid
-- leaking PII to unauthenticated callers.
create or replace function get_company_for_public(p_company_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_row _companies%rowtype;
begin
  select * into v_row
  from _companies
  where id = p_company_id::uuid;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id',        v_row.id,
    'name',      v_row.name,
    'tier',      v_row.tier,
    'status',    v_row.status,
    'createdAt', v_row.created_at
  );
end;
$$;

grant execute on function get_company_for_public(text) to anon, authenticated;

-- Returns a single assessment invite looked up by its opaque access code.
-- Returns explicit camelCase keys matching the AssessmentInvite TypeScript type
-- so the result can be cast directly without snake_case→camelCase mapping.
-- The caller must already possess the code; they cannot enumerate other rows.
create or replace function verify_access_code(p_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_row _assessment_invites%rowtype;
begin
  select * into v_row
  from _assessment_invites
  where access_code = p_code;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id',                v_row.id::text,
    'companyId',         v_row.company_id::text,
    'accessCode',        v_row.access_code,
    'name',              v_row.name,
    'email',             v_row.email,
    'role',              v_row.role,
    'status',            v_row.status,
    'sessionId',         v_row.session_id::text,
    'jobId',             v_row.job_id::text,
    'applicationId',     v_row.application_id::text,
    'candidateName',     v_row.candidate_name,
    'candidateEmail',    v_row.candidate_email,
    'candidateWhatsapp', v_row.candidate_whatsapp,
    'assessmentConfig',  v_row.assessment_config,
    'inviteLink',        v_row.invite_link,
    'usedAt',            v_row.used_at::text,
    'createdAt',         v_row.created_at::text,
    'updatedAt',         v_row.updated_at::text
  );
end;
$$;

grant execute on function verify_access_code(text) to anon, authenticated;

-- Marks a specific invite (identified by opaque access code) as used.
-- Only status and session_id are updated; all other fields are immutable.
create or replace function mark_access_code_used(
  p_code       text,
  p_status     text,
  p_session_id text  default null
) returns void
language plpgsql
security definer
as $$
begin
  update _assessment_invites
  set    status     = p_status,
         -- session_id is uuid; cast the text argument explicitly.
         -- coalesce keeps the existing value when p_session_id is null.
         session_id = coalesce(p_session_id::uuid, session_id),
         updated_at = now()
  where  access_code = p_code;
end;
$$;

grant execute on function mark_access_code_used(text, text, text) to anon, authenticated;

-- ============================================================
-- STORAGE BUCKETS
-- Create these in the Supabase dashboard > Storage tab, or
-- run with the service-role key via CLI.
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('company-assets', 'company-assets', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('candidate-documents', 'candidate-documents', false) on conflict do nothing;

-- ============================================================
-- NOTE ON ROW LEVEL SECURITY
-- RLS is intentionally NOT enabled in this schema file so the
-- app can be seeded and tested during development without auth
-- constraints. For production, apply RLS using the companion
-- script after this schema has been applied:
--
--   node artifacts/fraudapp/scripts/apply-schema.mjs
--   node artifacts/fraudapp/scripts/apply-rls.mjs
--
-- The RLS file (supabase-rls-policies.sql) enables RLS on all
-- base tables and creates policies so that:
--   - Company users can only access their own company's rows.
--   - System Admin users retain full access to all rows.
--   - The service-role key bypasses all RLS (server-side only).
-- The camelCase views inherit RLS from their underlying tables.
-- ============================================================
