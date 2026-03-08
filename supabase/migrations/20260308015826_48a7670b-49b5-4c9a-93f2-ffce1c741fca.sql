-- Fix: split the goals read policy to prevent exposing all shared goals
DROP POLICY IF EXISTS "Users can read own goals" ON goals;

-- Users can read goals assigned to them
CREATE POLICY "Users can read own goals" ON goals
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Users can read goals matching their worker_type or unit (shared goals)
CREATE POLICY "Users can read applicable shared goals" ON goals
  FOR SELECT TO authenticated
  USING (
    user_id IS NULL
    AND (
      worker_type IN (SELECT worker_type FROM users WHERE auth_user_id = auth.uid())
      OR unidade_id IN (SELECT unidade_id FROM users WHERE auth_user_id = auth.uid())
      OR (worker_type IS NULL AND unidade_id IS NULL)
    )
  );