
ALTER TABLE public.reposicao_031805
  ADD COLUMN IF NOT EXISTS mot_user_id uuid,
  ADD COLUMN IF NOT EXISTS aju_user_id uuid;
