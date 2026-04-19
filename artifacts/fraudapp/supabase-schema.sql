-- HireGood / FraudGuard SaaS – Supabase Schema
-- Run this in your Supabase SQL editor to create all required tables and buckets.

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text,
  role text default 'user',
  companyId text,
  companyName text,
  createdAt timestamptz default now(),
  updatedAt timestamptz default now()
);

create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  slug text unique,
  logoUrl text,
  website text,
  description text,
  industry text,
  size text,
  location text,
  subscriptionTier text default 'Freemium',
  credits integer default 0,
  adminId text,
  createdAt timestamptz default now(),
  updatedAt timestamptz default now()
);

create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  companyId text not null,
  title text not null,
  description text,
  location text,
  type text,
  status text default 'Active',
  salary text,
  requirements text[],
  datePosted timestamptz default now(),
  slug text,
  enableInstantAssessment boolean default false,
  assessmentWorkflowId text,
  createdAt timestamptz default now(),
  updatedAt timestamptz default now()
);

create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  jobId text not null,
  companyId text not null,
  candidateName text,
  candidateEmail text,
  candidateWhatsapp text,
  cvUrl text,
  status text default 'Pending',
  appliedAt timestamptz default now(),
  lastUpdated timestamptz default now()
);

create table if not exists interview_sessions (
  id uuid primary key default uuid_generate_v4(),
  companyId text not null,
  candidate jsonb,
  analysis jsonb,
  status text default 'pending',
  source text,
  date timestamptz default now(),
  completedAt timestamptz,
  unlockedAt timestamptz,
  unlockedByCompanyId text,
  jobId text,
  applicationId text,
  recruitmentStage text,
  timeline jsonb,
  inviteSource text,
  workflowId text,
  createdAt timestamptz default now(),
  updatedAt timestamptz default now()
);

create table if not exists assessment_invites (
  id uuid primary key default uuid_generate_v4(),
  access_code text unique not null,
  name text,
  email text,
  role text,
  companyId text not null,
  status text default 'PENDING',
  createdAt timestamptz default now(),
  usedAt timestamptz,
  sessionId text,
  jobId text,
  applicationId text
);

create table if not exists workflows (
  id uuid primary key default uuid_generate_v4(),
  companyId text not null,
  name text not null,
  stages jsonb,
  isActive boolean default true,
  createdAt timestamptz default now(),
  updatedAt timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  userId text not null,
  companyId text,
  type text,
  title text,
  message text,
  isRead boolean default false,
  data jsonb,
  createdAt timestamptz default now()
);

create table if not exists credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  companyId text not null,
  amount integer not null,
  type text not null,
  description text,
  balanceBefore integer,
  balanceAfter integer,
  createdAt timestamptz default now(),
  userId text
);

create table if not exists system_config (
  id text primary key,
  value jsonb,
  updatedAt timestamptz default now(),
  updatedBy text
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  userId text,
  userEmail text,
  action text,
  resource text,
  details text,
  companyId text,
  createdAt timestamptz default now()
);

create table if not exists pricing_config (
  id text primary key,
  tiers jsonb,
  creditPacks jsonb,
  updatedAt timestamptz default now()
);

create table if not exists promo_codes (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  discountType text not null,
  discountValue numeric not null,
  applicableTo text default 'both',
  maxUses integer,
  usedCount integer default 0,
  expiresAt timestamptz,
  isActive boolean default true,
  createdAt timestamptz default now()
);

create table if not exists payment_transactions (
  id uuid primary key default uuid_generate_v4(),
  companyId text not null,
  invoiceId text,
  invoiceUrl text,
  type text,
  amount numeric,
  status text default 'pending',
  tier text,
  credits integer,
  createdAt timestamptz default now(),
  updatedAt timestamptz default now()
);

-- ============================================================
-- STORAGE BUCKETS
-- (Run in Supabase dashboard or via supabase CLI)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('company-assets', 'company-assets', true);
-- insert into storage.buckets (id, name, public) values ('candidate-documents', 'candidate-documents', false);

-- ============================================================
-- ROW LEVEL SECURITY (basic – adjust policies as needed)
-- ============================================================
alter table users enable row level security;
alter table companies enable row level security;
alter table jobs enable row level security;
alter table applications enable row level security;
alter table interview_sessions enable row level security;
alter table assessment_invites enable row level security;
alter table workflows enable row level security;
alter table notifications enable row level security;
alter table credit_transactions enable row level security;
alter table system_config enable row level security;
alter table audit_logs enable row level security;
alter table pricing_config enable row level security;
alter table promo_codes enable row level security;
alter table payment_transactions enable row level security;

-- Allow authenticated users to read their own company data
create policy "Authenticated users can read" on companies for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read jobs" on jobs for select using (auth.role() = 'authenticated');

-- Service-role bypass (server-side operations use service key which bypasses RLS)
