
-- Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE (default)

-- UNITS policies
DROP POLICY IF EXISTS "Authenticated users can read units" ON public.units;
DROP POLICY IF EXISTS "Admins can insert units" ON public.units;
DROP POLICY IF EXISTS "Admins can update units" ON public.units;

CREATE POLICY "Authenticated users can read units" ON public.units
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert units" ON public.units
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  );

CREATE POLICY "Admins can update units" ON public.units
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  );

CREATE POLICY "Admins can delete units" ON public.units
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  );

-- USERS policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;

CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  );

CREATE POLICY "Admins can insert users" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  );

CREATE POLICY "Admins can update users" ON public.users
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  );

CREATE POLICY "Admins can delete users" ON public.users
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  );
