
-- ============================================
-- FIX: Recreate ALL RLS policies as PERMISSIVE
-- ============================================

-- ========== UNITS ==========
DROP POLICY IF EXISTS "Authenticated users can read units" ON public.units;
DROP POLICY IF EXISTS "Admins can insert units" ON public.units;
DROP POLICY IF EXISTS "Admins can update units" ON public.units;
DROP POLICY IF EXISTS "Admins can delete units" ON public.units;

CREATE POLICY "Authenticated users can read units" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert units" ON public.units FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can update units" ON public.units FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can delete units" ON public.units FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));

-- ========== ROUTES ==========
DROP POLICY IF EXISTS "Authenticated users can read routes" ON public.routes;
DROP POLICY IF EXISTS "Admins can insert routes" ON public.routes;
DROP POLICY IF EXISTS "Admins can update routes" ON public.routes;
DROP POLICY IF EXISTS "Admins can delete routes" ON public.routes;

CREATE POLICY "Authenticated users can read routes" ON public.routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert routes" ON public.routes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can update routes" ON public.routes FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can delete routes" ON public.routes FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));

-- ========== USERS ==========
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

CREATE POLICY "Users can read own profile" ON public.users FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Admins can read all users" ON public.users FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'administrador'));
CREATE POLICY "Admins can insert users" ON public.users FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'administrador'));
CREATE POLICY "Admins can update users" ON public.users FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'administrador'));
CREATE POLICY "Admins can delete users" ON public.users FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'administrador'));

-- ========== INDICATORS ==========
DROP POLICY IF EXISTS "Authenticated users can read indicators" ON public.indicators;
DROP POLICY IF EXISTS "Admins can insert indicators" ON public.indicators;
DROP POLICY IF EXISTS "Admins can update indicators" ON public.indicators;
DROP POLICY IF EXISTS "Admins can delete indicators" ON public.indicators;

CREATE POLICY "Authenticated users can read indicators" ON public.indicators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert indicators" ON public.indicators FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can update indicators" ON public.indicators FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can delete indicators" ON public.indicators FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));

-- ========== GOALS ==========
DROP POLICY IF EXISTS "Authenticated users can read goals" ON public.goals;
DROP POLICY IF EXISTS "Admins can insert goals" ON public.goals;
DROP POLICY IF EXISTS "Admins can update goals" ON public.goals;
DROP POLICY IF EXISTS "Admins can delete goals" ON public.goals;

-- Admins read all, non-admins read only their own or unit-level goals
CREATE POLICY "Admins can read all goals" ON public.goals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Users can read own goals" ON public.goals FOR SELECT TO authenticated USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR user_id IS NULL);
CREATE POLICY "Admins can insert goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can update goals" ON public.goals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can delete goals" ON public.goals FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));

-- ========== INCENTIVE_RULES ==========
DROP POLICY IF EXISTS "Authenticated users can read incentive_rules" ON public.incentive_rules;
DROP POLICY IF EXISTS "Admins can insert incentive_rules" ON public.incentive_rules;
DROP POLICY IF EXISTS "Admins can update incentive_rules" ON public.incentive_rules;
DROP POLICY IF EXISTS "Admins can delete incentive_rules" ON public.incentive_rules;

CREATE POLICY "Authenticated users can read incentive_rules" ON public.incentive_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert incentive_rules" ON public.incentive_rules FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can update incentive_rules" ON public.incentive_rules FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can delete incentive_rules" ON public.incentive_rules FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));

-- ========== USER_INDICATOR_DAILY ==========
DROP POLICY IF EXISTS "Users can read own indicator data" ON public.user_indicator_daily;
DROP POLICY IF EXISTS "Admins can read all indicator data" ON public.user_indicator_daily;
DROP POLICY IF EXISTS "Admins can insert indicator data" ON public.user_indicator_daily;
DROP POLICY IF EXISTS "Admins can update indicator data" ON public.user_indicator_daily;
DROP POLICY IF EXISTS "Admins can delete indicator data" ON public.user_indicator_daily;

CREATE POLICY "Users can read own indicator data" ON public.user_indicator_daily FOR SELECT TO authenticated USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins can read all indicator data" ON public.user_indicator_daily FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can insert indicator data" ON public.user_indicator_daily FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can update indicator data" ON public.user_indicator_daily FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can delete indicator data" ON public.user_indicator_daily FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
