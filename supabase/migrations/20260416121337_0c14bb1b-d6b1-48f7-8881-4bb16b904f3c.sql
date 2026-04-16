ALTER TABLE public.goals
  ADD COLUMN valor_desafio numeric NOT NULL DEFAULT 0,
  ADD COLUMN valor_bonificacao_desafio numeric NOT NULL DEFAULT 0;