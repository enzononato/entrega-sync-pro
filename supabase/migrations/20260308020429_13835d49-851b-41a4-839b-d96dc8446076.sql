-- Fix infinite recursion in users table RLS policies
-- Create a security definer function to check admin status without triggering RLS
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_user_id = check_user_id AND role = 'administrador'
  );
$$;

-- Create a function to get the user's public id from auth id
CREATE OR REPLACE FUNCTION public.get_user_id(check_auth_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users WHERE auth_user_id = check_auth_id LIMIT 1;
$$;

-- Drop existing policies on users table
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Recreate policies using security definer functions
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete users" ON users
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Fix all other tables that reference users table in their policies
-- action_plans
DROP POLICY IF EXISTS "Admins read all plans" ON action_plans;
DROP POLICY IF EXISTS "Admins insert plans" ON action_plans;
DROP POLICY IF EXISTS "Admins update plans" ON action_plans;
DROP POLICY IF EXISTS "Admins delete plans" ON action_plans;
DROP POLICY IF EXISTS "Users read own plans" ON action_plans;
DROP POLICY IF EXISTS "Users insert own plans" ON action_plans;
DROP POLICY IF EXISTS "Users update own plans" ON action_plans;

CREATE POLICY "Admins read all plans" ON action_plans FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert plans" ON action_plans FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update plans" ON action_plans FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete plans" ON action_plans FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users read own plans" ON action_plans FOR SELECT TO authenticated USING (responsavel_user_id = public.get_user_id(auth.uid()));
CREATE POLICY "Users insert own plans" ON action_plans FOR INSERT TO authenticated WITH CHECK (responsavel_user_id = public.get_user_id(auth.uid()));
CREATE POLICY "Users update own plans" ON action_plans FOR UPDATE TO authenticated USING (responsavel_user_id = public.get_user_id(auth.uid())) WITH CHECK (responsavel_user_id = public.get_user_id(auth.uid()));

-- feedbacks
DROP POLICY IF EXISTS "Admins read all feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Admins insert feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Admins update feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Admins delete feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Users read own feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Users insert own feedbacks" ON feedbacks;

CREATE POLICY "Admins read all feedbacks" ON feedbacks FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert feedbacks" ON feedbacks FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update feedbacks" ON feedbacks FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete feedbacks" ON feedbacks FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users read own feedbacks" ON feedbacks FOR SELECT TO authenticated USING (user_id = public.get_user_id(auth.uid()));
CREATE POLICY "Users insert own feedbacks" ON feedbacks FOR INSERT TO authenticated WITH CHECK (user_id = public.get_user_id(auth.uid()));

-- goals
DROP POLICY IF EXISTS "Admins can read all goals" ON goals;
DROP POLICY IF EXISTS "Admins can insert goals" ON goals;
DROP POLICY IF EXISTS "Admins can update goals" ON goals;
DROP POLICY IF EXISTS "Admins can delete goals" ON goals;
DROP POLICY IF EXISTS "Users can read own goals" ON goals;
DROP POLICY IF EXISTS "Users can read applicable shared goals" ON goals;

CREATE POLICY "Admins can read all goals" ON goals FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert goals" ON goals FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update goals" ON goals FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete goals" ON goals FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read own goals" ON goals FOR SELECT TO authenticated USING (user_id = public.get_user_id(auth.uid()));
CREATE POLICY "Users can read applicable shared goals" ON goals FOR SELECT TO authenticated USING (
  user_id IS NULL AND (
    worker_type IN (SELECT worker_type FROM users WHERE auth_user_id = auth.uid())
    OR unidade_id IN (SELECT unidade_id FROM users WHERE auth_user_id = auth.uid())
    OR (worker_type IS NULL AND unidade_id IS NULL)
  )
);

-- incentive_rules
DROP POLICY IF EXISTS "Admins can insert incentive_rules" ON incentive_rules;
DROP POLICY IF EXISTS "Admins can update incentive_rules" ON incentive_rules;
DROP POLICY IF EXISTS "Admins can delete incentive_rules" ON incentive_rules;

CREATE POLICY "Admins can insert incentive_rules" ON incentive_rules FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update incentive_rules" ON incentive_rules FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete incentive_rules" ON incentive_rules FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- indicators
DROP POLICY IF EXISTS "Admins can insert indicators" ON indicators;
DROP POLICY IF EXISTS "Admins can update indicators" ON indicators;
DROP POLICY IF EXISTS "Admins can delete indicators" ON indicators;

CREATE POLICY "Admins can insert indicators" ON indicators FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update indicators" ON indicators FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete indicators" ON indicators FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- root_cause_records
DROP POLICY IF EXISTS "Admins read all causes" ON root_cause_records;
DROP POLICY IF EXISTS "Admins insert causes" ON root_cause_records;
DROP POLICY IF EXISTS "Admins update causes" ON root_cause_records;
DROP POLICY IF EXISTS "Admins delete causes" ON root_cause_records;
DROP POLICY IF EXISTS "Users read own causes" ON root_cause_records;
DROP POLICY IF EXISTS "Users insert own causes" ON root_cause_records;

CREATE POLICY "Admins read all causes" ON root_cause_records FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert causes" ON root_cause_records FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update causes" ON root_cause_records FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete causes" ON root_cause_records FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users read own causes" ON root_cause_records FOR SELECT TO authenticated USING (user_id = public.get_user_id(auth.uid()));
CREATE POLICY "Users insert own causes" ON root_cause_records FOR INSERT TO authenticated WITH CHECK (user_id = public.get_user_id(auth.uid()));

-- routes
DROP POLICY IF EXISTS "Admins can insert routes" ON routes;
DROP POLICY IF EXISTS "Admins can update routes" ON routes;
DROP POLICY IF EXISTS "Admins can delete routes" ON routes;

CREATE POLICY "Admins can insert routes" ON routes FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update routes" ON routes FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete routes" ON routes FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- units
DROP POLICY IF EXISTS "Admins can insert units" ON units;
DROP POLICY IF EXISTS "Admins can update units" ON units;
DROP POLICY IF EXISTS "Admins can delete units" ON units;

CREATE POLICY "Admins can insert units" ON units FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update units" ON units FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete units" ON units FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- user_incentives_daily
DROP POLICY IF EXISTS "Admins read all incentives" ON user_incentives_daily;
DROP POLICY IF EXISTS "Admins insert incentives" ON user_incentives_daily;
DROP POLICY IF EXISTS "Admins update incentives" ON user_incentives_daily;
DROP POLICY IF EXISTS "Admins delete incentives" ON user_incentives_daily;
DROP POLICY IF EXISTS "Users read own incentives" ON user_incentives_daily;

CREATE POLICY "Admins read all incentives" ON user_incentives_daily FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert incentives" ON user_incentives_daily FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update incentives" ON user_incentives_daily FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete incentives" ON user_incentives_daily FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users read own incentives" ON user_incentives_daily FOR SELECT TO authenticated USING (user_id = public.get_user_id(auth.uid()));

-- user_indicator_daily
DROP POLICY IF EXISTS "Admins can read all indicator data" ON user_indicator_daily;
DROP POLICY IF EXISTS "Admins can insert indicator data" ON user_indicator_daily;
DROP POLICY IF EXISTS "Admins can update indicator data" ON user_indicator_daily;
DROP POLICY IF EXISTS "Admins can delete indicator data" ON user_indicator_daily;
DROP POLICY IF EXISTS "Users can read own indicator data" ON user_indicator_daily;

CREATE POLICY "Admins can read all indicator data" ON user_indicator_daily FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert indicator data" ON user_indicator_daily FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update indicator data" ON user_indicator_daily FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete indicator data" ON user_indicator_daily FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read own indicator data" ON user_indicator_daily FOR SELECT TO authenticated USING (user_id = public.get_user_id(auth.uid()));