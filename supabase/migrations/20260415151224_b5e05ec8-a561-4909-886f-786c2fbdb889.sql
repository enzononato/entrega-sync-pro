-- Update TX_REPOSICAO indicator metadata
UPDATE public.indicators
SET nome = 'Reposição',
    applies_to_worker_type = 'motorista',
    categoria = 'Financeiro',
    unidade_medida = 'R$'
WHERE codigo = 'TX_REPOSICAO';

-- Insert monthly goal for motorista: R$49.80
INSERT INTO public.goals (indicator_id, valor_meta, periodo_tipo, worker_type, unidade_id, vigencia_inicio, ativo)
VALUES (
  'c4c40e3e-f23b-46ce-a576-885c610f2df7',
  49.80,
  'mensal',
  'motorista',
  NULL,
  CURRENT_DATE,
  true
);