-- HireGood / FraudGuard SaaS – Supabase Schema
-- Run this in your Supabase SQL editor to create all required tables.
--
-- IMPORTANT – Column naming convention:
--   Columns use camelCase (e.g. companyId, createdAt) to exactly mirror the
--   field names used by the React/TypeScript application code and by every
--   .eq() / .insert() / .select() call in services/supabase.ts.
--   Changing to snake_case would require updating every query in the service
--   layer and risk runtime breakage. This is intentional, not an oversight.
--
-- RLS is NOT enabled here; enable it (see the follow-up task) for production.

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- CORE TABLES (mirrors original Firestore collections)
-- ============================================================

-- users  (Firestore: 'users')
create table if not exists users (
  id text primary key,
  email text unique not null,
  name text,
  role text default 'Company Admin',
  companyId text,
  companyName text,
  phone text,
  avatar text,
  emailVerified boolean default false,
  createdAt text,
  updatedAt text
);

-- companies  (Firestore: 'companies')
create table if not exists companies (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text,
  adminEmail text,
  companySlug text unique,
  logoUrl text,
  brandColor text,
  headerTitle text,
  welcomeMessage text,
  website text,
  description text,
  industry text,
  size text,
  location text,
  address text,
  whatsapp text,
  tier text default 'Freemium',
  status text default 'Active',
  credits integer default 1000,
  creditsUsed integer default 0,
  verification_credits integer default 100,
  usersCount integer default 1,
  monthlyCredits integer,
  subscriptionStartDate text,
  subscriptionEndDate text,
  subscription_ends_at text,
  custom_candidate_limit integer,
  notificationPreferences jsonb,
  joinedDate text,
  lastActivity text,
  suspendedAt text,
  suspendedBy text,
  suspendReason text,
  bannedAt text,
  bannedBy text,
  banReason text,
  reactivatedAt text,
  reactivatedBy text,
  createdAt text,
  updatedAt text
);

-- jobs  (Firestore: 'jobs')
create table if not exists jobs (
  id text primary key default gen_random_uuid()::text,
  companyId text not null,
  title text not null,
  description text,
  location text,
  type text,
  status text default 'Active',
  salary text,
  requirements text[],
  datePosted text,
  slug text,
  enableInstantAssessment boolean default false,
  workflowId text,
  createdAt text,
  updatedAt text
);

-- applications  (Firestore: 'applications')
create table if not exists applications (
  id text primary key default gen_random_uuid()::text,
  jobId text not null,
  companyId text not null,
  candidateName text,
  candidateEmail text,
  candidateWhatsapp text,
  cvUrl text,
  status text default 'Pending',
  appliedAt text,
  lastUpdated text
);

-- interview_sessions  (Firestore: 'sessions')
create table if not exists interview_sessions (
  id text primary key default gen_random_uuid()::text,
  companyId text not null,
  candidate jsonb,
  analysis jsonb,
  status text default 'pending',
  source text,
  date text,
  completedAt text,
  unlockedAt text,
  unlockedByCompanyId text,
  jobId text,
  applicationId text,
  recruitmentStage text,
  inviteSource text,
  workflowId text,
  timeline jsonb,
  transcript jsonb,
  structuredAssessment jsonb,
  sjtResults jsonb,
  financialStrainResults jsonb,
  cvUrl text,
  cvParsedData jsonb,
  whatsapp text,
  riskScore integer,
  backgroundCheck jsonb,
  backgroundCheckStatus text,
  backgroundCheckCompletedAt text,
  createdAt text,
  updatedAt text
);

-- assessment_invites  (Firestore: 'assessment_invites')
create table if not exists assessment_invites (
  id text primary key default gen_random_uuid()::text,
  access_code text unique not null,
  name text,
  email text,
  role text,
  companyId text not null,
  status text default 'PENDING',
  createdAt text,
  updatedAt text,
  usedAt text,
  sessionId text,
  jobId text,
  applicationId text,
  candidateName text,
  candidateEmail text,
  candidateWhatsapp text,
  assessmentConfig jsonb,
  inviteLink text
);

-- workflows  (Firestore: 'workflows')
create table if not exists workflows (
  id text primary key default gen_random_uuid()::text,
  companyId text not null,
  name text not null,
  description text,
  steps jsonb,
  isActive boolean default true,
  isDefault boolean default false,
  createdAt text,
  updatedAt text
);

-- notifications  (Firestore: 'notifications')
create table if not exists notifications (
  id text primary key default gen_random_uuid()::text,
  userId text not null,
  companyId text,
  type text,
  title text,
  message text,
  read boolean default false,
  data jsonb,
  createdAt text
);

-- credit_transactions  (Firestore: 'credit_transactions')
create table if not exists credit_transactions (
  id text primary key default gen_random_uuid()::text,
  companyId text not null,
  type text not null,
  amount integer not null,
  action text,
  description text,
  balanceBefore integer,
  balanceAfter integer,
  timestamp text,
  metadata jsonb,
  userId text
);

-- ============================================================
-- SUPPLEMENTARY TABLES
-- ============================================================

-- system_config: stores arbitrary JSON blobs keyed by id (e.g. 'apiKeys', 'settings', 'webhooks')
-- `data` column matches systemConfigService.ts getConfigDoc / upsertConfigDoc calls
create table if not exists system_config (
  id text primary key,
  data jsonb,
  updatedAt text,
  updatedBy text
);

-- audit_logs: `timestamp` matches systemConfigService.ts createAuditLog / getAuditLogs calls
create table if not exists audit_logs (
  id text primary key default gen_random_uuid()::text,
  userId text,
  userEmail text,
  action text,
  section text,
  resource text,
  details text,
  oldValue jsonb,
  newValue jsonb,
  status text,
  errorMessage text,
  timestamp text
);

-- pricing_config: stores arbitrary JSON blobs keyed by id (e.g. 'plans', 'creditPackages')
-- `data` column matches pricingService.ts getConfig / upsertConfig calls
create table if not exists pricing_config (
  id text primary key,
  data jsonb,
  updatedAt text
);

-- promo_codes: column names match pricingService.ts (type, usageLimit, usageCount, expiryDate)
create table if not exists promo_codes (
  id text primary key default gen_random_uuid()::text,
  code text unique not null,
  type text not null,
  discountValue numeric not null,
  applicableTo text default 'both',
  usageLimit integer,
  usageCount integer default 0,
  expiryDate text,
  isActive boolean default true,
  description text,
  createdBy text,
  createdAt text
);

create table if not exists payment_transactions (
  id text primary key default gen_random_uuid()::text,
  companyId text not null,
  invoiceId text,
  invoiceUrl text,
  type text,
  amount numeric,
  status text default 'pending',
  tier text,
  credits integer,
  createdAt text,
  updatedAt text
);

-- ============================================================
-- ATOMIC CREDIT DEDUCTION RPC
-- Called by creditManagement.ts::deductCredit for concurrency safety.
-- Uses row-level locking (FOR UPDATE) to prevent double-spend.
-- ============================================================
create or replace function deduct_credits(
  p_company_id text,
  p_amount integer
) returns integer
language plpgsql
as $$
declare
  v_current integer;
begin
  select credits into v_current
  from companies
  where id = p_company_id
  for update;          -- row-level lock prevents concurrent deductions

  if v_current is null then
    raise exception 'Company not found: %', p_company_id;
  end if;

  if v_current < p_amount then
    raise exception 'Insufficient credits: need %, have %', p_amount, v_current;
  end if;

  update companies set credits = v_current - p_amount where id = p_company_id;
  return v_current - p_amount;  -- return new balance
end;
$$;

-- ============================================================
-- STORAGE BUCKETS
-- Create these in the Supabase dashboard > Storage tab, or
-- uncomment and run with the service-role key via CLI.
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('company-assets', 'company-assets', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('candidate-documents', 'candidate-documents', false) on conflict do nothing;

-- ============================================================
-- NOTE ON ROW LEVEL SECURITY
-- RLS is intentionally NOT enabled in this schema file so the
-- app functions correctly with the anon key during development.
-- For production deployment, enable RLS on each table and add
-- policies based on companyId ownership and user roles.
-- ============================================================
