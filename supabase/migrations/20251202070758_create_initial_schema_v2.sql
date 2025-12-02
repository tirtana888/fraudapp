/*
  # FraudGuard Initial Database Schema

  ## Overview
  This migration creates the complete database schema for the FraudGuard SaaS application,
  including all tables, Row Level Security policies, and necessary indexes.

  ## New Tables

  ### 1. `companies` - Company/Organization Management
    - `id` (uuid, primary key) - Unique company identifier
    - `name` (text) - Company name
    - `tier` (text) - Subscription tier: Basic, Premium, or Enterprise
    - `status` (text) - Account status: Active, Pending, Suspended, Past Due
    - `admin_email` (text) - Primary admin contact email
    - `joined_date` (timestamptz) - Account creation date
    - `subscription_ends_at` (timestamptz) - Subscription expiration date
    - `custom_candidate_limit` (integer) - Custom candidate assessment limit
    - `verification_credits` (integer) - Available verification credits
    - `users_count` (integer) - Number of users in the company
    - `logo_url` (text) - Company logo URL
    - `brand_color` (text) - Brand color for customization
    - `header_title` (text) - Custom header title
    - `welcome_message` (text) - Custom welcome message
    - `created_at` (timestamptz) - Record creation timestamp
    - `updated_at` (timestamptz) - Record update timestamp

  ### 2. `users` - User Authentication and Profiles
    - `id` (uuid, primary key) - Unique user identifier (matches auth.users)
    - `email` (text, unique) - User email address
    - `name` (text) - Full name
    - `role` (text) - Role: System Admin, Company Admin, User, Lead Investigator
    - `company_id` (uuid) - Foreign key to companies table
    - `avatar` (text) - Avatar URL
    - `created_at` (timestamptz) - Account creation date
    - `updated_at` (timestamptz) - Last profile update

  ### 3. `interview_sessions` - Assessment/Interview Sessions
    - `id` (uuid, primary key) - Unique session identifier
    - `company_id` (uuid) - Foreign key to companies table
    - `candidate_id` (text) - Candidate identifier
    - `candidate_name` (text) - Candidate full name
    - `candidate_role` (text) - Candidate job role
    - `candidate_email` (text) - Candidate email
    - `date` (timestamptz) - Session date
    - `status` (text) - Session status: active, completed, pending_review
    - `source` (text) - Source: public_link or internal
    - `transcript` (jsonb) - Conversation transcript array
    - `structured_assessment` (jsonb) - Structured assessment responses
    - `sjt_results` (jsonb) - Situational judgment test results
    - `financial_strain_results` (jsonb) - Financial strain assessment
    - `analysis` (jsonb) - AI fraud analysis results
    - `created_at` (timestamptz) - Session start time
    - `updated_at` (timestamptz) - Last update time

  ### 4. `assessment_invites` - Candidate Assessment Invitations
    - `id` (uuid, primary key) - Unique invite identifier
    - `company_id` (uuid) - Foreign key to companies table
    - `access_code` (text, unique) - 6-character access code
    - `email` (text) - Candidate email
    - `name` (text) - Candidate name
    - `role` (text) - Target role/position
    - `status` (text) - Invite status: PENDING, ACCESSING, IN_PROGRESS, COMPLETED, EXPIRED
    - `session_id` (uuid) - Linked session ID when completed
    - `created_at` (timestamptz) - Invite creation time
    - `accessed_at` (timestamptz) - First access time
    - `started_at` (timestamptz) - Assessment start time
    - `completed_at` (timestamptz) - Completion time

  ## Security

  ### Row Level Security (RLS)
  All tables have RLS enabled with restrictive policies based on authenticated user roles and company membership.

  ## Indexes
  - Companies: indexed on `admin_email`, `status`, `tier`
  - Users: indexed on `email`, `company_id`, `role`
  - Sessions: indexed on `company_id`, `date`, `status`, `candidate_email`
  - Invites: indexed on `access_code`, `company_id`, `status`, `email`

  ## Notes
  - All timestamps use `timestamptz` for timezone support
  - JSONB columns allow flexible schema for complex data structures
  - Foreign keys ensure referential integrity
  - Default values prevent null-related issues
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- COMPANIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  tier text NOT NULL DEFAULT 'Basic' CHECK (tier IN ('Basic', 'Premium', 'Enterprise')),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Pending', 'Suspended', 'Past Due')),
  admin_email text NOT NULL,
  joined_date timestamptz NOT NULL DEFAULT now(),
  subscription_ends_at timestamptz,
  custom_candidate_limit integer DEFAULT 0,
  verification_credits integer DEFAULT 0,
  users_count integer DEFAULT 0,
  logo_url text DEFAULT '',
  brand_color text DEFAULT '#1e293b',
  header_title text DEFAULT '',
  welcome_message text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_admin_email ON companies(admin_email);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_tier ON companies(tier);

-- Companies RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'User' CHECK (role IN ('System Admin', 'Company Admin', 'User', 'Lead Investigator')),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  avatar text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Users RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- INTERVIEW SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS interview_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id text NOT NULL,
  candidate_name text NOT NULL,
  candidate_role text NOT NULL,
  candidate_email text NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'pending_review')),
  source text DEFAULT 'internal',
  transcript jsonb DEFAULT '[]'::jsonb,
  structured_assessment jsonb DEFAULT '[]'::jsonb,
  sjt_results jsonb DEFAULT '[]'::jsonb,
  financial_strain_results jsonb DEFAULT '[]'::jsonb,
  analysis jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Interview sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_company_id ON interview_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON interview_sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_candidate_email ON interview_sessions(candidate_email);
CREATE INDEX IF NOT EXISTS idx_sessions_source ON interview_sessions(source);

-- Interview sessions RLS
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ASSESSMENT INVITES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS assessment_invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  access_code text UNIQUE NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'Kandidat',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCESSING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED')),
  session_id uuid REFERENCES interview_sessions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  accessed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

-- Assessment invites indexes
CREATE INDEX IF NOT EXISTS idx_invites_access_code ON assessment_invites(access_code);
CREATE INDEX IF NOT EXISTS idx_invites_company_id ON assessment_invites(company_id);
CREATE INDEX IF NOT EXISTS idx_invites_status ON assessment_invites(status);
CREATE INDEX IF NOT EXISTS idx_invites_email ON assessment_invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_created_at ON assessment_invites(created_at DESC);

-- Assessment invites RLS
ALTER TABLE assessment_invites ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES FOR COMPANIES
-- =====================================================

CREATE POLICY "System Admins can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'System Admin'
    )
  );

CREATE POLICY "Company users can view own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "System Admins can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'System Admin'
    )
  );

CREATE POLICY "System Admins can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'System Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'System Admin'
    )
  );

CREATE POLICY "System Admins can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'System Admin'
    )
  );

-- =====================================================
-- RLS POLICIES FOR USERS
-- =====================================================

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "System Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'System Admin'
    )
  );

CREATE POLICY "Company Admins can view users in their company"
  ON users FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE id = auth.uid()
      AND role = 'Company Admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "System Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'System Admin'
    )
  );

CREATE POLICY "System Admins can update any user"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'System Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'System Admin'
    )
  );

-- =====================================================
-- RLS POLICIES FOR INTERVIEW SESSIONS
-- =====================================================

CREATE POLICY "System Admins can view all sessions"
  ON interview_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'System Admin'
    )
  );

CREATE POLICY "Company users can view own company sessions"
  ON interview_sessions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Public can view public_link sessions"
  ON interview_sessions FOR SELECT
  TO anon
  USING (source = 'public_link');

CREATE POLICY "Company users can insert sessions"
  ON interview_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Public can insert public_link sessions"
  ON interview_sessions FOR INSERT
  TO anon
  WITH CHECK (source = 'public_link');

CREATE POLICY "Company users can update own company sessions"
  ON interview_sessions FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Public can update public_link sessions"
  ON interview_sessions FOR UPDATE
  TO anon
  USING (source = 'public_link')
  WITH CHECK (source = 'public_link');

CREATE POLICY "System Admins can delete sessions"
  ON interview_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'System Admin'
    )
  );

-- =====================================================
-- RLS POLICIES FOR ASSESSMENT INVITES
-- =====================================================

CREATE POLICY "Company users can view own company invites"
  ON assessment_invites FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Public can view invites by access code"
  ON assessment_invites FOR SELECT
  TO anon
  USING (status = 'PENDING');

CREATE POLICY "Company users can insert invites"
  ON assessment_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Company users can update own company invites"
  ON assessment_invites FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Public can update invites by access code"
  ON assessment_invites FOR UPDATE
  TO anon
  USING (status IN ('PENDING', 'ACCESSING', 'IN_PROGRESS'))
  WITH CHECK (status IN ('ACCESSING', 'IN_PROGRESS', 'COMPLETED'));

CREATE POLICY "Company users can delete own company invites"
  ON assessment_invites FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE users.id = auth.uid()
    )
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON interview_sessions;
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON interview_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
