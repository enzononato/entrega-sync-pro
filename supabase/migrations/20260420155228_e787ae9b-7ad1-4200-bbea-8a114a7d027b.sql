INSERT INTO public.indicators (codigo, nome, categoria, applies_to_worker_type, unidade_medida, descricao, ativo)
SELECT 'CX_BATIDAS', 'Caixas Batidas', 'incentivo', 'ambos', 'R$', 'Incentivo mensal acumulado por caixas entregues, com fator baseado no número de ajudantes do mapa', true
WHERE NOT EXISTS (SELECT 1 FROM public.indicators WHERE codigo = 'CX_BATIDAS');

INSERT INTO public.incentive_rules (indicator_id, worker_type, regra_json, meta, valor_minimo, valor_maximo, peso, ativo)
SELECT 
  i.id,
  'motorista',
  jsonb_build_object(
    'tipo', 'caixas_batidas',
    'fator_0', 0.19,
    'fator_1', 0.18,
    'fator_2', 0.06,
    'teto_motorista', 624,
    'teto_ajudante', 416
  ),
  0, 0, 0, 1, true
FROM public.indicators i
WHERE i.codigo = 'CX_BATIDAS'
  AND NOT EXISTS (
    SELECT 1 FROM public.incentive_rules ir 
    WHERE ir.indicator_id = i.id AND ir.regra_json->>'tipo' = 'caixas_batidas'
  );

CREATE UNIQUE INDEX IF NOT EXISTS user_incentives_daily_user_data_unique 
ON public.user_incentives_daily (user_id, data_referencia);