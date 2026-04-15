-- Insert DISP_TEMPO goal for Motorista (15%)
INSERT INTO public.goals (indicator_id, valor_meta, valor_bonificacao, worker_type, periodo_tipo, vigencia_inicio, ativo)
VALUES (
  '488d1de9-9d88-42f2-bf3b-625752c0db02',
  15,
  0,
  'motorista',
  'diario',
  '2025-01-01',
  true
);

-- Insert DISP_TEMPO goal for Ajudante (15%)
INSERT INTO public.goals (indicator_id, valor_meta, valor_bonificacao, worker_type, periodo_tipo, vigencia_inicio, ativo)
VALUES (
  '488d1de9-9d88-42f2-bf3b-625752c0db02',
  15,
  0,
  'ajudante',
  'diario',
  '2025-01-01',
  true
);