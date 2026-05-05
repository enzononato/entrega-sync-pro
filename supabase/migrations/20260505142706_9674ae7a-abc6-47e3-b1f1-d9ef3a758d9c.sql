
-- Helper: admin can access a given unit
CREATE OR REPLACE FUNCTION public.admin_can_access_unit(_unit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin') AND (
      NOT EXISTS (
        SELECT 1 FROM public.user_units uu
        WHERE uu.user_id = public.get_user_id(auth.uid())
      )
      OR _unit_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_units uu
        WHERE uu.user_id = public.get_user_id(auth.uid())
          AND uu.unit_id = _unit_id
      )
    )
$$;

-- Helper: admin can access data belonging to a target user
CREATE OR REPLACE FUNCTION public.admin_can_access_user(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.admin_can_access_unit(
    (SELECT unidade_id FROM public.users WHERE id = _target_user_id)
  )
$$;

-- ============== USERS ==============
DROP POLICY IF EXISTS "Admins full access users" ON public.users;
CREATE POLICY "Admins full access users" ON public.users
  FOR ALL TO authenticated
  USING (public.admin_can_access_unit(unidade_id))
  WITH CHECK (public.admin_can_access_unit(unidade_id));

-- ============== USER_UNITS ==============
DROP POLICY IF EXISTS "Admins full access user_units" ON public.user_units;
CREATE POLICY "Admins full access user_units" ON public.user_units
  FOR ALL TO authenticated
  USING (public.admin_can_access_unit(unit_id))
  WITH CHECK (public.admin_can_access_unit(unit_id));

-- ============== USER_ROLES ==============
DROP POLICY IF EXISTS "Admins full access user_roles" ON public.user_roles;
CREATE POLICY "Admins full access user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.admin_can_access_unit(
      (SELECT u.unidade_id FROM public.users u WHERE u.auth_user_id = user_roles.user_id)
    )
  )
  WITH CHECK (
    public.admin_can_access_unit(
      (SELECT u.unidade_id FROM public.users u WHERE u.auth_user_id = user_roles.user_id)
    )
  );

-- ============== ROUTES ==============
DROP POLICY IF EXISTS "Admins full access routes" ON public.routes;
CREATE POLICY "Admins full access routes" ON public.routes
  FOR ALL TO authenticated
  USING (public.admin_can_access_unit(unidade_id))
  WITH CHECK (public.admin_can_access_unit(unidade_id));

-- ============== UNITS ==============
DROP POLICY IF EXISTS "Admins full access units" ON public.units;
CREATE POLICY "Admins full access units" ON public.units
  FOR ALL TO authenticated
  USING (public.admin_can_access_unit(id))
  WITH CHECK (public.admin_can_access_unit(id));

-- ============== GOALS ==============
DROP POLICY IF EXISTS "Admins full access goals" ON public.goals;
CREATE POLICY "Admins full access goals" ON public.goals
  FOR ALL TO authenticated
  USING (public.admin_can_access_unit(unidade_id))
  WITH CHECK (public.admin_can_access_unit(unidade_id));

-- ============== FEEDBACKS ==============
DROP POLICY IF EXISTS "Admins full access feedbacks" ON public.feedbacks;
CREATE POLICY "Admins full access feedbacks" ON public.feedbacks
  FOR ALL TO authenticated
  USING (public.admin_can_access_unit(unidade_id))
  WITH CHECK (public.admin_can_access_unit(unidade_id));

-- ============== RELATOS_SEGURANCA ==============
DROP POLICY IF EXISTS "Admins full access relatos_seguranca" ON public.relatos_seguranca;
CREATE POLICY "Admins full access relatos_seguranca" ON public.relatos_seguranca
  FOR ALL TO authenticated
  USING (public.admin_can_access_unit(unidade_id))
  WITH CHECK (public.admin_can_access_unit(unidade_id));

-- ============== PDV_CRITICO_FEEDBACKS ==============
DROP POLICY IF EXISTS "Admins full access pdv_critico_feedbacks" ON public.pdv_critico_feedbacks;
CREATE POLICY "Admins full access pdv_critico_feedbacks" ON public.pdv_critico_feedbacks
  FOR ALL TO authenticated
  USING (public.admin_can_access_unit(unidade_id))
  WITH CHECK (public.admin_can_access_unit(unidade_id));

-- ============== RATING_AVALIACOES ==============
DROP POLICY IF EXISTS "Admins full access rating_avaliacoes" ON public.rating_avaliacoes;
CREATE POLICY "Admins full access rating_avaliacoes" ON public.rating_avaliacoes
  FOR ALL TO authenticated
  USING (
    user_id IS NULL OR public.admin_can_access_user(user_id)
  )
  WITH CHECK (
    user_id IS NULL OR public.admin_can_access_user(user_id)
  );

-- ============== MAPA_HISTORICO ==============
DROP POLICY IF EXISTS "Admins full access mapa_historico" ON public.mapa_historico;
CREATE POLICY "Admins full access mapa_historico" ON public.mapa_historico
  FOR ALL TO authenticated
  USING (
    public.admin_can_access_user(mot_user_id)
    OR public.admin_can_access_user(aju1_user_id)
    OR public.admin_can_access_user(aju2_user_id)
    OR (mot_user_id IS NULL AND aju1_user_id IS NULL AND aju2_user_id IS NULL AND public.has_role(auth.uid(),'admin'))
  )
  WITH CHECK (
    public.admin_can_access_user(mot_user_id)
    OR public.admin_can_access_user(aju1_user_id)
    OR public.admin_can_access_user(aju2_user_id)
    OR (mot_user_id IS NULL AND aju1_user_id IS NULL AND aju2_user_id IS NULL AND public.has_role(auth.uid(),'admin'))
  );

-- ============== REFUGO_031134 ==============
DROP POLICY IF EXISTS "Admins full access refugo_031134" ON public.refugo_031134;
CREATE POLICY "Admins full access refugo_031134" ON public.refugo_031134
  FOR ALL TO authenticated
  USING (
    public.admin_can_access_user(mot_user_id)
    OR public.admin_can_access_user(aju1_user_id)
    OR public.admin_can_access_user(aju2_user_id)
    OR (mot_user_id IS NULL AND aju1_user_id IS NULL AND aju2_user_id IS NULL AND public.has_role(auth.uid(),'admin'))
  )
  WITH CHECK (
    public.admin_can_access_user(mot_user_id)
    OR public.admin_can_access_user(aju1_user_id)
    OR public.admin_can_access_user(aju2_user_id)
    OR (mot_user_id IS NULL AND aju1_user_id IS NULL AND aju2_user_id IS NULL AND public.has_role(auth.uid(),'admin'))
  );

-- ============== REPOSICAO_031805 ==============
DROP POLICY IF EXISTS "Admins full access reposicao_031805" ON public.reposicao_031805;
CREATE POLICY "Admins full access reposicao_031805" ON public.reposicao_031805
  FOR ALL TO authenticated
  USING (
    public.admin_can_access_user(mot_user_id)
    OR public.admin_can_access_user(aju_user_id)
    OR (mot_user_id IS NULL AND aju_user_id IS NULL AND public.has_role(auth.uid(),'admin'))
  )
  WITH CHECK (
    public.admin_can_access_user(mot_user_id)
    OR public.admin_can_access_user(aju_user_id)
    OR (mot_user_id IS NULL AND aju_user_id IS NULL AND public.has_role(auth.uid(),'admin'))
  );

-- ============== USER_INDICATOR_DAILY ==============
DROP POLICY IF EXISTS "Admins full access indicator_daily" ON public.user_indicator_daily;
CREATE POLICY "Admins full access indicator_daily" ON public.user_indicator_daily
  FOR ALL TO authenticated
  USING (public.admin_can_access_user(user_id))
  WITH CHECK (public.admin_can_access_user(user_id));

-- ============== USER_INCENTIVES_DAILY ==============
DROP POLICY IF EXISTS "Admins full access incentives_daily" ON public.user_incentives_daily;
CREATE POLICY "Admins full access incentives_daily" ON public.user_incentives_daily
  FOR ALL TO authenticated
  USING (public.admin_can_access_user(user_id))
  WITH CHECK (public.admin_can_access_user(user_id));

-- ============== INCENTIVE_DEDUCTIONS ==============
DROP POLICY IF EXISTS "Admins full access incentive_deductions" ON public.incentive_deductions;
CREATE POLICY "Admins full access incentive_deductions" ON public.incentive_deductions
  FOR ALL TO authenticated
  USING (public.admin_can_access_user(user_id))
  WITH CHECK (public.admin_can_access_user(user_id));

-- ============== ROOT_CAUSE_RECORDS ==============
DROP POLICY IF EXISTS "Admins full access root_causes" ON public.root_cause_records;
CREATE POLICY "Admins full access root_causes" ON public.root_cause_records
  FOR ALL TO authenticated
  USING (public.admin_can_access_user(user_id))
  WITH CHECK (public.admin_can_access_user(user_id));

-- ============== ACTION_PLANS ==============
DROP POLICY IF EXISTS "Admins full access action_plans" ON public.action_plans;
CREATE POLICY "Admins full access action_plans" ON public.action_plans
  FOR ALL TO authenticated
  USING (public.admin_can_access_user(responsavel_user_id))
  WITH CHECK (public.admin_can_access_user(responsavel_user_id));
