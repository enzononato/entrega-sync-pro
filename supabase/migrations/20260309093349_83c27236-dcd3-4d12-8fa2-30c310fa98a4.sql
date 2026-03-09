-- Junction table for users <-> units (N:N)
CREATE TABLE public.user_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, unit_id)
);

-- Enable RLS
ALTER TABLE public.user_units ENABLE ROW LEVEL SECURITY;

-- RLS: Admins full access
CREATE POLICY "Admins can read user_units" ON public.user_units FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert user_units" ON public.user_units FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update user_units" ON public.user_units FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete user_units" ON public.user_units FOR DELETE USING (is_admin(auth.uid()));

-- Users can read their own associations
CREATE POLICY "Users can read own user_units" ON public.user_units FOR SELECT USING (user_id = get_user_id(auth.uid()));

-- Migrate existing unidade_id data into user_units
INSERT INTO public.user_units (user_id, unit_id)
SELECT id, unidade_id FROM public.users WHERE unidade_id IS NOT NULL
ON CONFLICT DO NOTHING;