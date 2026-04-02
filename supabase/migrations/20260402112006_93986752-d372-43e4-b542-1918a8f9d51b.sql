ALTER TABLE public.user_indicator_daily
  ADD COLUMN IF NOT EXISTS desafio numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status_desafio text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_financeiro numeric DEFAULT NULL;