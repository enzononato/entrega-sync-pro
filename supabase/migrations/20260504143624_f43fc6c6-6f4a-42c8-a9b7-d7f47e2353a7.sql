
-- 1) Atualiza meta/bônus do PDV_CRITICO (maior é melhor)
UPDATE public.goals
SET valor_meta = 5,
    valor_desafio = 15,
    valor_bonificacao = 52.50,
    valor_bonificacao_desafio = 10.00,
    periodo_tipo = 'mensal',
    ativo = true
WHERE indicator_id = '7eb7d062-98b4-48ee-bb39-ab350ee69d5b';

-- 2) Recalcula linhas já gravadas em user_indicator_daily com a nova lógica
UPDATE public.user_indicator_daily
SET status         = CASE WHEN valor >= 5  THEN 'dentro_meta' ELSE 'abaixo_meta' END,
    status_desafio = CASE WHEN valor >= 15 THEN 'atingiu'    ELSE 'nao_atingiu' END,
    percentual_atingimento = LEAST(100, (valor / 5.0) * 100),
    meta = 5,
    desafio = 15,
    updated_at = now()
WHERE indicator_id = '7eb7d062-98b4-48ee-bb39-ab350ee69d5b';
