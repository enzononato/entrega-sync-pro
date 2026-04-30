
-- Fix rating_avaliacoes unique constraint to match upsert key (unidade in, fim out)
ALTER TABLE public.rating_avaliacoes DROP CONSTRAINT IF EXISTS rating_avaliacoes_unique;
ALTER TABLE public.rating_avaliacoes
  ADD CONSTRAINT rating_avaliacoes_unique
  UNIQUE (data_referencia_inicio, worker_type, unidade, matricula);

-- Add partial unique index for monthly indicator rows (mapa_numero IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS user_indicator_daily_unique_monthly
  ON public.user_indicator_daily (user_id, indicator_id, data_referencia)
  WHERE mapa_numero IS NULL;
