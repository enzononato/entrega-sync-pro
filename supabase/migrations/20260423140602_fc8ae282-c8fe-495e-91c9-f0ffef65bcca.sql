
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  identifier text NOT NULL DEFAULT '',
  identifier_type text NOT NULL DEFAULT 'matricula',
  success boolean NOT NULL DEFAULT false,
  failure_reason text,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  user_nome text,
  user_email text,
  ip_address text,
  user_agent text
);

CREATE INDEX idx_login_attempts_created_at ON public.login_attempts (created_at DESC);
CREATE INDEX idx_login_attempts_success ON public.login_attempts (success);
CREATE INDEX idx_login_attempts_identifier ON public.login_attempts (identifier);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read login_attempts"
  ON public.login_attempts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
