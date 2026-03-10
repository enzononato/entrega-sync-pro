
-- =============================================
-- Padronizar RLS: has_role() em todas as tabelas
-- =============================================

-- 1. USERS
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own avatar" ON users;

CREATE POLICY "Admins full access users" ON users FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own profile" ON users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY "Users update own profile" ON users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- 2. USER_ROLES
DROP POLICY IF EXISTS "Admins can manage user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON user_roles;

CREATE POLICY "Admins full access user_roles" ON user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own roles" ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. USER_UNITS
DROP POLICY IF EXISTS "Admins can delete user_units" ON user_units;
DROP POLICY IF EXISTS "Admins can insert user_units" ON user_units;
DROP POLICY IF EXISTS "Admins can read user_units" ON user_units;
DROP POLICY IF EXISTS "Admins can update user_units" ON user_units;
DROP POLICY IF EXISTS "Users can read own user_units" ON user_units;

CREATE POLICY "Admins full access user_units" ON user_units FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own user_units" ON user_units FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));

-- 4. NOTIFICATIONS
DROP POLICY IF EXISTS "Admins insert notifications" ON notifications;
DROP POLICY IF EXISTS "Admins read all notifications" ON notifications;
DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON notifications;

CREATE POLICY "Admins read all notifications" ON notifications FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert notifications" ON notifications FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE TO authenticated
  USING (user_id = get_user_id(auth.uid()))
  WITH CHECK (user_id = get_user_id(auth.uid()));

-- 5. INDICATORS
DROP POLICY IF EXISTS "Admins can delete indicators" ON indicators;
DROP POLICY IF EXISTS "Admins can insert indicators" ON indicators;
DROP POLICY IF EXISTS "Admins can update indicators" ON indicators;
DROP POLICY IF EXISTS "Authenticated users can read indicators" ON indicators;

CREATE POLICY "Admins full access indicators" ON indicators FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated read indicators" ON indicators FOR SELECT TO authenticated
  USING (true);

-- 6. UNITS
DROP POLICY IF EXISTS "Admins can delete units" ON units;
DROP POLICY IF EXISTS "Admins can insert units" ON units;
DROP POLICY IF EXISTS "Admins can update units" ON units;
DROP POLICY IF EXISTS "Authenticated users can read units" ON units;

CREATE POLICY "Admins full access units" ON units FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated read units" ON units FOR SELECT TO authenticated
  USING (true);

-- 7. ROUTES
DROP POLICY IF EXISTS "Admins can delete routes" ON routes;
DROP POLICY IF EXISTS "Admins can insert routes" ON routes;
DROP POLICY IF EXISTS "Admins can update routes" ON routes;
DROP POLICY IF EXISTS "Authenticated users can read routes" ON routes;

CREATE POLICY "Admins full access routes" ON routes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated read routes" ON routes FOR SELECT TO authenticated
  USING (true);

-- 8. GOALS
DROP POLICY IF EXISTS "Admins can delete goals" ON goals;
DROP POLICY IF EXISTS "Admins can insert goals" ON goals;
DROP POLICY IF EXISTS "Admins can read all goals" ON goals;
DROP POLICY IF EXISTS "Admins can update goals" ON goals;
DROP POLICY IF EXISTS "Users can read applicable shared goals" ON goals;
DROP POLICY IF EXISTS "Users can read own goals" ON goals;

CREATE POLICY "Admins full access goals" ON goals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own goals" ON goals FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));
CREATE POLICY "Users read shared goals" ON goals FOR SELECT TO authenticated
  USING (
    user_id IS NULL AND (
      worker_type IN (SELECT u.worker_type FROM users u WHERE u.auth_user_id = auth.uid())
      OR unidade_id IN (SELECT u.unidade_id FROM users u WHERE u.auth_user_id = auth.uid())
      OR (worker_type IS NULL AND unidade_id IS NULL)
    )
  );

-- 9. INCENTIVE_RULES
DROP POLICY IF EXISTS "Admins can delete incentive_rules" ON incentive_rules;
DROP POLICY IF EXISTS "Admins can insert incentive_rules" ON incentive_rules;
DROP POLICY IF EXISTS "Admins can update incentive_rules" ON incentive_rules;
DROP POLICY IF EXISTS "Authenticated users can read incentive_rules" ON incentive_rules;

CREATE POLICY "Admins full access incentive_rules" ON incentive_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated read incentive_rules" ON incentive_rules FOR SELECT TO authenticated
  USING (true);

-- 10. USER_INDICATOR_DAILY
DROP POLICY IF EXISTS "Admins can delete indicator data" ON user_indicator_daily;
DROP POLICY IF EXISTS "Admins can insert indicator data" ON user_indicator_daily;
DROP POLICY IF EXISTS "Admins can read all indicator data" ON user_indicator_daily;
DROP POLICY IF EXISTS "Admins can update indicator data" ON user_indicator_daily;
DROP POLICY IF EXISTS "Users can read own indicator data" ON user_indicator_daily;

CREATE POLICY "Admins full access indicator_daily" ON user_indicator_daily FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own indicator_daily" ON user_indicator_daily FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));

-- 11. USER_INCENTIVES_DAILY
DROP POLICY IF EXISTS "Admins delete incentives" ON user_incentives_daily;
DROP POLICY IF EXISTS "Admins insert incentives" ON user_incentives_daily;
DROP POLICY IF EXISTS "Admins read all incentives" ON user_incentives_daily;
DROP POLICY IF EXISTS "Admins update incentives" ON user_incentives_daily;
DROP POLICY IF EXISTS "Users read own incentives" ON user_incentives_daily;

CREATE POLICY "Admins full access incentives_daily" ON user_incentives_daily FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own incentives_daily" ON user_incentives_daily FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));

-- 12. ACTION_PLANS
DROP POLICY IF EXISTS "Admins delete plans" ON action_plans;
DROP POLICY IF EXISTS "Admins insert plans" ON action_plans;
DROP POLICY IF EXISTS "Admins read all plans" ON action_plans;
DROP POLICY IF EXISTS "Admins update plans" ON action_plans;
DROP POLICY IF EXISTS "Users insert own plans" ON action_plans;
DROP POLICY IF EXISTS "Users read own plans" ON action_plans;
DROP POLICY IF EXISTS "Users update own plans" ON action_plans;

CREATE POLICY "Admins full access action_plans" ON action_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own plans" ON action_plans FOR SELECT TO authenticated
  USING (responsavel_user_id = get_user_id(auth.uid()));
CREATE POLICY "Users insert own plans" ON action_plans FOR INSERT TO authenticated
  WITH CHECK (responsavel_user_id = get_user_id(auth.uid()));
CREATE POLICY "Users update own plans" ON action_plans FOR UPDATE TO authenticated
  USING (responsavel_user_id = get_user_id(auth.uid()))
  WITH CHECK (responsavel_user_id = get_user_id(auth.uid()));

-- 13. ROOT_CAUSE_RECORDS
DROP POLICY IF EXISTS "Admins delete causes" ON root_cause_records;
DROP POLICY IF EXISTS "Admins insert causes" ON root_cause_records;
DROP POLICY IF EXISTS "Admins read all causes" ON root_cause_records;
DROP POLICY IF EXISTS "Admins update causes" ON root_cause_records;
DROP POLICY IF EXISTS "Users insert own causes" ON root_cause_records;
DROP POLICY IF EXISTS "Users read own causes" ON root_cause_records;

CREATE POLICY "Admins full access root_causes" ON root_cause_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own causes" ON root_cause_records FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));
CREATE POLICY "Users insert own causes" ON root_cause_records FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id(auth.uid()));

-- 14. FEEDBACKS
DROP POLICY IF EXISTS "Admins delete feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Admins insert feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Admins read all feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Admins update feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Users insert own feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Users read own feedbacks" ON feedbacks;

CREATE POLICY "Admins full access feedbacks" ON feedbacks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own feedbacks" ON feedbacks FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));
CREATE POLICY "Users insert own feedbacks" ON feedbacks FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id(auth.uid()));
CREATE POLICY "Users update own feedbacks" ON feedbacks FOR UPDATE TO authenticated
  USING (user_id = get_user_id(auth.uid()))
  WITH CHECK (user_id = get_user_id(auth.uid()));

-- 15. AUDIT_LOGS
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;

CREATE POLICY "Admins read audit_logs" ON audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
