INSERT INTO public.goals (indicator_id, worker_type, valor_meta, valor_desafio, valor_bonificacao, valor_bonificacao_desafio, periodo_tipo, vigencia_inicio, ativo)
SELECT id, 'motorista', 5, 15, 0, 0, 'mensal', date_trunc('year', CURRENT_DATE)::date, true
FROM public.indicators WHERE codigo = 'PDV_CRITICO'
AND NOT EXISTS (
  SELECT 1 FROM public.goals g
  WHERE g.indicator_id = indicators.id
    AND g.worker_type = 'motorista'
    AND g.user_id IS NULL
    AND g.unidade_id IS NULL
    AND g.ativo = true
);