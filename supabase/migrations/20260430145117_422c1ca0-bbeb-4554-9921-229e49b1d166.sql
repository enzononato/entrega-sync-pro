ALTER TABLE public.indicators
  ADD COLUMN IF NOT EXISTS periodicidade text NOT NULL DEFAULT 'diario';

ALTER TABLE public.indicators
  DROP CONSTRAINT IF EXISTS indicators_periodicidade_check;

ALTER TABLE public.indicators
  ADD CONSTRAINT indicators_periodicidade_check
  CHECK (periodicidade IN ('diario', 'mensal'));

UPDATE public.indicators
  SET periodicidade = 'mensal'
  WHERE codigo = 'RATING';