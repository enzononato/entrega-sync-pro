
-- Helper for tables that store auth.users uid (not public.users.id)
CREATE OR REPLACE FUNCTION public.admin_can_access_auth_user(_auth_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.admin_can_access_unit(
    (SELECT u.unidade_id FROM public.users u WHERE u.auth_user_id = _auth_id)
  )
$$;

-- Helper: is the current admin a super-admin (no unit links)?
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_units uu
      WHERE uu.user_id = public.get_user_id(auth.uid())
    )
$$;

-- ============== AUDIT_LOGS ==============
DROP POLICY IF EXISTS "Admins read audit_logs" ON public.audit_logs;
CREATE POLICY "Admins read audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      changed_by IS NULL
      OR public.admin_can_access_auth_user(changed_by)
    )
  );

-- ============== LOGIN_ATTEMPTS ==============
DROP POLICY IF EXISTS "Admins read login_attempts" ON public.login_attempts;
CREATE POLICY "Admins read login_attempts" ON public.login_attempts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      user_id IS NULL
      OR public.admin_can_access_user(user_id)
    )
  );

-- ============== IMPORT_BATCHES ==============
DROP POLICY IF EXISTS "Admins full access import_batches" ON public.import_batches;
CREATE POLICY "Admins full access import_batches" ON public.import_batches
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      imported_by IS NULL
      OR imported_by = auth.uid()
      OR public.admin_can_access_auth_user(imported_by)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (
      imported_by IS NULL
      OR imported_by = auth.uid()
      OR public.admin_can_access_auth_user(imported_by)
    )
  );

-- ============== INCENTIVE_RULES ==============
DROP POLICY IF EXISTS "Admins full access incentive_rules" ON public.incentive_rules;
CREATE POLICY "Admins full access incentive_rules" ON public.incentive_rules
  FOR ALL TO authenticated
  USING (public.admin_can_access_unit(unidade_id))
  WITH CHECK (public.admin_can_access_unit(unidade_id));

-- Read remains open for authenticated (already exists "Authenticated read incentive_rules")

-- ============== INDICATORS ==============
-- Read stays open. Replace admin write policy to allow only super-admins.
DROP POLICY IF EXISTS "Admins full access indicators" ON public.indicators;
CREATE POLICY "Super-admins full access indicators" ON public.indicators
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
