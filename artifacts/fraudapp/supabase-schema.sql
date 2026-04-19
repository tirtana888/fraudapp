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
-- STORAGE BUCKETS
-- Create these in the Supabase dashboard > Storage tab, or
-- run with the service-role key via CLI.
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('company-assets', 'company-assets', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('candidate-documents', 'candidate-documents', false) on conflict do nothing;

-- ============================================================
-- NOTE ON ROW LEVEL SECURITY
-- RLS is intentionally NOT enabled in this schema file so the
-- app functions correctly with the anon key during development.
-- For production, enable RLS on the BASE TABLES (_companies,
-- _jobs, etc.) and add policies based on company_id ownership
-- and user roles. The views inherit the base-table RLS.
-- ============================================================
