/*
  # Fix Users Table RLS Infinite Recursion

  ## Problem
  Policies on the `users` table that query the `users` table itself create infinite recursion.
  This happens when checking if a user is a "System Admin" or "Company Admin" - the policy
  tries to read from users table, which triggers the same policy again.

  ## Solution
  1. Drop all existing policies on users table
  2. Create simpler policies that don't cause recursion:
     - Users can always view their own profile (no subquery needed)
     - Users can insert their own profile during signup (auth.uid() only)
     - Users can update their own profile (no subquery needed)
     - For viewing other users, use a security definer function to break recursion

  ## Security
  - Users can only access their own data by default
  - Sign up flow works without recursion
  - Admin access handled via separate function
*/

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "System Admins can view all users" ON users;
DROP POLICY IF EXISTS "Company Admins can view users in their company" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "System Admins can insert users" ON users;
DROP POLICY IF EXISTS "System Admins can update any user" ON users;
DROP POLICY IF EXISTS "Users can insert own profile during signup" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can view company members" ON users;
DROP POLICY IF EXISTS "System Admins can delete users" ON users;

-- Create a security definer function to check user role
-- This breaks the recursion by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM users WHERE id = user_id LIMIT 1;
$$;

-- Create a security definer function to check user company
CREATE OR REPLACE FUNCTION get_user_company(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM users WHERE id = user_id LIMIT 1;
$$;

-- Policy 1: Users can view their own profile (no recursion)
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Users can view profiles in same company (using function)
CREATE POLICY "Users can view company members"
  ON users FOR SELECT
  TO authenticated
  USING (company_id = get_user_company(auth.uid()));

-- Policy 3: System Admins can view all users (using function)
CREATE POLICY "System Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'System Admin');

-- Policy 4: Users can insert their own profile during signup
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Policy 5: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 6: System Admins can update any user (using function)
CREATE POLICY "System Admins can update any user"
  ON users FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'System Admin')
  WITH CHECK (get_user_role(auth.uid()) = 'System Admin');

-- Policy 7: System Admins can delete users (using function)
CREATE POLICY "System Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'System Admin');
