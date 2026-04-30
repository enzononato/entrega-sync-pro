-- Drop antiga constraint se existir
ALTER TABLE public.rating_avaliacoes
  DROP CONSTRAINT IF EXISTS rating_avaliacoes_data_referencia_inicio_data_referencia_fim_;
ALTER TABLE public.rating_avaliacoes
  DROP CONSTRAINT IF EXISTS rating_avaliacoes_unique_period;

-- Remover índice único antigo se existir (variações comuns)
DROP INDEX IF EXISTS public.rating_avaliacoes_unique_period_idx;
DROP INDEX IF EXISTS public.rating_avaliacoes_unique_idx;

-- Tornar unidade NOT NULL não é seguro com dados antigos; usar índice único parcial
CREATE UNIQUE INDEX IF NOT EXISTS rating_avaliacoes_unique_month_unit_idx
  ON public.rating_avaliacoes (data_referencia_inicio, worker_type, unidade, matricula)
  WHERE unidade IS NOT NULL;