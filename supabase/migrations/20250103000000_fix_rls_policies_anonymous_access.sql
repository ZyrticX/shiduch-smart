-- Fix RLS policies to allow anonymous access (since we use password protection instead of Supabase Auth)
-- Drop existing policies that require authentication
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.matches;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.settings;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.students;

-- Create new policies that allow anonymous access
CREATE POLICY "Allow all operations for all users" ON public.users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for all users" ON public.matches
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for all users" ON public.settings
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for all users" ON public.students
  FOR ALL USING (true) WITH CHECK (true);

