-- HireGood / FraudGuard SaaS – Supabase Schema
-- Run this in your Supabase SQL editor to create all required tables.
-- After running, you can enable RLS and add policies as needed for production.

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Users (mirrors Firebase Auth + Firestore 'users' collection)
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

-- Companies (mirrors Firestore 'companies' collection)
create table if not exists companies (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text,
  adminEmail text,
  companySlug text unique,
  logoUrl text,
  website text,
  description text,
  industry text,
  size text,
  location text,
  tier text default 'Freemium',
  status text default 'Active',
  credits integer default 1000,
  verification_credits integer default 100,
  usersCount integer default 1,
  joinedDate text,
  createdAt text,
  updatedAt text
);

-- Jobs (mirrors Firestore 'jobs' collection)
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
  assessmentWorkflowId text,
  createdAt text,
  updatedAt text
);

-- Applications (mirrors Firestore 'applications' collection)
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

-- Interview Sessions (mirrors Firestore 'sessions' collection)
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
  timeline jsonb,
  inviteSource text,
  workflowId text,
  cvUrl text,
  cvParsedData jsonb,
  riskScore integer,
  createdAt text,
  updatedAt text
);

-- Assessment Invites (mirrors Firestore 'assessment_invites' / 'invites' collection)
create table if not exists assessment_invites (
  id text primary key default gen_random_uuid()::text,
  access_code text unique not null,
  name text,
  email text,
  role text,
  companyId text not null,
  status text default 'PENDING',
  createdAt text,
  usedAt text,
  sessionId text,
  jobId text,
  applicationId text,
  candidateName text,
  candidateEmail text,
  candidateWhatsapp text,
  assessmentConfig jsonb,
  inviteLink text,
  updatedAt text
);

-- Workflows (mirrors Firestore 'workflows' collection)
create table if not exists workflows (
  id text primary key default gen_random_uuid()::text,
  companyId text not null,
  name text not null,
  stages jsonb,
  isActive boolean default true,
  createdAt text,
  updatedAt text
);

-- Notifications (mirrors Firestore 'notifications' collection)
create table if not exists notifications (
  id text primary key default gen_random_uuid()::text,
  userId text not null,
  companyId text,
  type text,
  title text,
  message text,
  isRead boolean default false,
  data jsonb,
  createdAt text
);

-- Credit Transactions (mirrors Firestore 'credit_transactions' collection)
create table if not exists credit_transactions (
  id text primary key default gen_random_uuid()::text,
  companyId text not null,
  amount integer not null,
  type text not null,
  description text,
  balanceBefore integer,
  balanceAfter integer,
  createdAt text,
  userId text
);

-- ============================================================
-- SUPPLEMENTARY TABLES
-- ============================================================

create table if not exists system_config (
  id text primary key,
  value jsonb,
  updatedAt text,
  updatedBy text
);

create table if not exists audit_logs (
  id text primary key default gen_random_uuid()::text,
  userId text,
  userEmail text,
  action text,
  resource text,
  details text,
  companyId text,
  createdAt text
);

create table if not exists pricing_config (
  id text primary key,
  tiers jsonb,
  creditPacks jsonb,
  updatedAt text
);

create table if not exists promo_codes (
  id text primary key default gen_random_uuid()::text,
  code text unique not null,
  discountType text not null,
  discountValue numeric not null,
  applicableTo text default 'both',
  maxUses integer,
  usedCount integer default 0,
  expiresAt text,
  isActive boolean default true,
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
-- STORAGE BUCKETS
-- Run these separately in the Supabase dashboard Storage tab,
-- or uncomment if running via the CLI with service-role key.
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('company-assets', 'company-assets', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('candidate-documents', 'candidate-documents', false) on conflict do nothing;

-- ============================================================
-- NOTE ON ROW LEVEL SECURITY
-- RLS is intentionally NOT enabled here so the app works with
-- the anon key during development.  For production, enable RLS
-- on each table and add appropriate policies that match your
-- companyId-based access rules.
-- ============================================================
