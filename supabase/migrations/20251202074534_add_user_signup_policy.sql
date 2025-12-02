/*
  # Add User Signup Policy
  
  ## Changes
  - Add policy to allow authenticated users to insert their own user profile during signup
  - This enables the signUp function to work properly
  
  ## Security
  - Users can only insert their own profile (id must match auth.uid())
  - Prevents users from creating profiles for others
*/

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile during signup"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());