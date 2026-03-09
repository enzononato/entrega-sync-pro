-- Insert goals (ignore duplicates)
INSERT INTO goals (indicator_id, valor_meta, periodo_tipo, worker_type, unidade_id, vigencia_inicio, ativo) VALUES
  ('49487ebb-1787-423b-8ee7-e0be330cf81b', 28, 'diario', 'motorista', '96be5bc0-b666-43a3-89fd-0549ef5721ea', '2026-01-01', true),
  ('9bda15cf-8d80-4781-9da4-71e0a87f12f3', 5, 'diario', 'motorista', '96be5bc0-b666-43a3-89fd-0549ef5721ea', '2026-01-01', true),
  ('ea0463a2-3f0e-42c6-9f4f-9eeb2da2d4cf', 3, 'diario', 'motorista', '96be5bc0-b666-43a3-89fd-0549ef5721ea', '2026-01-01', true),
  ('5bdb58ac-05ab-4109-817b-61f09a9a89eb', 4.5, 'diario', 'motorista', '96be5bc0-b666-43a3-89fd-0549ef5721ea', '2026-01-01', true),
  ('2beabd02-3424-439f-a89e-2b53eaee2e5e', 2, 'diario', 'ajudante', '96be5bc0-b666-43a3-89fd-0549ef5721ea', '2026-01-01', true),
  ('49487ebb-1787-423b-8ee7-e0be330cf81b', 25, 'diario', 'ajudante', '96be5bc0-b666-43a3-89fd-0549ef5721ea', '2026-01-01', true)
ON CONFLICT DO NOTHING;

-- Upsert daily performance for Carlos - today and recent days
INSERT INTO user_indicator_daily (user_id, indicator_id, data_referencia, valor, meta, percentual_atingimento, status, origem_dado) VALUES
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '49487ebb-1787-423b-8ee7-e0be330cf81b', CURRENT_DATE, 25, 28, 89.3, 'abaixo_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '9bda15cf-8d80-4781-9da4-71e0a87f12f3', CURRENT_DATE, 3, 5, 60.0, 'abaixo_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', 'ea0463a2-3f0e-42c6-9f4f-9eeb2da2d4cf', CURRENT_DATE, 2, 3, 100.0, 'dentro_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '5bdb58ac-05ab-4109-817b-61f09a9a89eb', CURRENT_DATE, 4.7, 4.5, 104.4, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '6a52cf6c-67b2-42c2-b8c3-e724d954a585', CURRENT_DATE, 12, 15, 80.0, 'abaixo_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '49487ebb-1787-423b-8ee7-e0be330cf81b', CURRENT_DATE - 1, 30, 28, 107.1, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '9bda15cf-8d80-4781-9da4-71e0a87f12f3', CURRENT_DATE - 1, 4, 5, 80.0, 'abaixo_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', 'ea0463a2-3f0e-42c6-9f4f-9eeb2da2d4cf', CURRENT_DATE - 1, 1, 3, 100.0, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '5bdb58ac-05ab-4109-817b-61f09a9a89eb', CURRENT_DATE - 1, 4.8, 4.5, 106.7, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '6a52cf6c-67b2-42c2-b8c3-e724d954a585', CURRENT_DATE - 1, 14, 15, 93.3, 'dentro_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '49487ebb-1787-423b-8ee7-e0be330cf81b', CURRENT_DATE - 2, 27, 28, 96.4, 'dentro_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '9bda15cf-8d80-4781-9da4-71e0a87f12f3', CURRENT_DATE - 2, 5, 5, 100.0, 'dentro_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', 'ea0463a2-3f0e-42c6-9f4f-9eeb2da2d4cf', CURRENT_DATE - 2, 2, 3, 100.0, 'dentro_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '5bdb58ac-05ab-4109-817b-61f09a9a89eb', CURRENT_DATE - 2, 4.2, 4.5, 93.3, 'dentro_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '49487ebb-1787-423b-8ee7-e0be330cf81b', CURRENT_DATE - 3, 32, 28, 114.3, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '9bda15cf-8d80-4781-9da4-71e0a87f12f3', CURRENT_DATE - 3, 6, 5, 120.0, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', 'ea0463a2-3f0e-42c6-9f4f-9eeb2da2d4cf', CURRENT_DATE - 3, 1, 3, 100.0, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '5bdb58ac-05ab-4109-817b-61f09a9a89eb', CURRENT_DATE - 3, 4.9, 4.5, 108.9, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '49487ebb-1787-423b-8ee7-e0be330cf81b', CURRENT_DATE - 4, 22, 28, 78.6, 'abaixo_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '9bda15cf-8d80-4781-9da4-71e0a87f12f3', CURRENT_DATE - 4, 7, 5, 140.0, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', 'ea0463a2-3f0e-42c6-9f4f-9eeb2da2d4cf', CURRENT_DATE - 4, 4, 3, 75.0, 'abaixo_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '49487ebb-1787-423b-8ee7-e0be330cf81b', CURRENT_DATE - 5, 29, 28, 103.6, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '9bda15cf-8d80-4781-9da4-71e0a87f12f3', CURRENT_DATE - 5, 4, 5, 80.0, 'abaixo_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '5bdb58ac-05ab-4109-817b-61f09a9a89eb', CURRENT_DATE - 5, 4.6, 4.5, 102.2, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '49487ebb-1787-423b-8ee7-e0be330cf81b', CURRENT_DATE - 6, 31, 28, 110.7, 'acima_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '9bda15cf-8d80-4781-9da4-71e0a87f12f3', CURRENT_DATE - 6, 3, 5, 60.0, 'abaixo_meta', 'manual'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '5bdb58ac-05ab-4109-817b-61f09a9a89eb', CURRENT_DATE - 6, 4.3, 4.5, 95.6, 'dentro_meta', 'manual')
ON CONFLICT (user_id, indicator_id, data_referencia) DO UPDATE SET
  valor = EXCLUDED.valor, meta = EXCLUDED.meta, percentual_atingimento = EXCLUDED.percentual_atingimento, status = EXCLUDED.status;

-- Incentives daily
INSERT INTO user_incentives_daily (user_id, data_referencia, valor_estimado, valor_fechado, status) VALUES
  ('2093f6ca-746b-45f9-b505-e2170b785a58', CURRENT_DATE, 211.00, NULL, 'estimado'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', CURRENT_DATE - 1, 245.50, 245.50, 'fechado'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', CURRENT_DATE - 2, 198.00, 198.00, 'fechado'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', CURRENT_DATE - 3, 280.00, 280.00, 'fechado'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', CURRENT_DATE - 4, 155.00, 155.00, 'fechado'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', CURRENT_DATE - 5, 220.00, 220.00, 'fechado'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', CURRENT_DATE - 6, 235.00, 235.00, 'fechado')
ON CONFLICT (user_id, data_referencia) DO UPDATE SET
  valor_estimado = EXCLUDED.valor_estimado, valor_fechado = EXCLUDED.valor_fechado, status = EXCLUDED.status;

-- Incentive rules
INSERT INTO incentive_rules (indicator_id, worker_type, meta, peso, valor_minimo, valor_maximo, vigencia_inicio, ativo) VALUES
  ('49487ebb-1787-423b-8ee7-e0be330cf81b', 'motorista', 28, 0.4, 50, 120, '2026-01-01', true),
  ('9bda15cf-8d80-4781-9da4-71e0a87f12f3', 'motorista', 5, 0.3, 30, 80, '2026-01-01', true),
  ('5bdb58ac-05ab-4109-817b-61f09a9a89eb', 'motorista', 4.5, 0.3, 30, 80, '2026-01-01', true)
ON CONFLICT DO NOTHING;

-- Root cause records
INSERT INTO root_cause_records (user_id, indicator_id, data_referencia, descricao_problema, categoria_causa, causa_raiz, impacto) VALUES
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '49487ebb-1787-423b-8ee7-e0be330cf81b', CURRENT_DATE, 'Atraso nas entregas e insatisfação dos clientes por demora no atendimento', 'Logística', 'Tempo de loading acima da meta devido a fila no CD. Falta de organização na separação causou retrabalho.', 'Perda de 3 entregas no período da tarde'),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '6a52cf6c-67b2-42c2-b8c3-e724d954a585', CURRENT_DATE - 2, 'Rota com muitos desvios aumentando o tempo de entrega significativamente', 'Processo', 'GPS indicou caminho mais longo. A roteirização não considerou obras na via principal que causaram desvios.', 'Aumento de 40min no tempo total da rota')
ON CONFLICT DO NOTHING;

-- Action plans
INSERT INTO action_plans (root_cause_id, responsavel_user_id, descricao_acao, prazo, status)
SELECT rc.id, '2093f6ca-746b-45f9-b505-e2170b785a58', 'Chegar 30min mais cedo para evitar fila no CD', CURRENT_DATE + 7, 'em_andamento'
FROM root_cause_records rc WHERE rc.user_id = '2093f6ca-746b-45f9-b505-e2170b785a58'
ORDER BY rc.created_at DESC LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO action_plans (root_cause_id, responsavel_user_id, descricao_acao, prazo, status)
SELECT rc.id, '2093f6ca-746b-45f9-b505-e2170b785a58', 'Reportar obras no trajeto para atualização da roteirização', CURRENT_DATE + 3, 'aberto'
FROM root_cause_records rc WHERE rc.user_id = '2093f6ca-746b-45f9-b505-e2170b785a58'
ORDER BY rc.created_at ASC LIMIT 1
ON CONFLICT DO NOTHING;

-- Feedbacks
INSERT INTO feedbacks (user_id, unidade_id, rota_id, tipo, titulo, descricao, urgencia, status, data_referencia) VALUES
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '96be5bc0-b666-43a3-89fd-0549ef5721ea', '8ae395cf-6cf0-4671-acc3-20084ee242ca', 'operacao', 'Caminhão com problema no freio', 'O caminhão da rota norte está com o freio fazendo barulho estranho, precisa de manutenção urgente', 'critica', 'aberto', CURRENT_DATE),
  ('2093f6ca-746b-45f9-b505-e2170b785a58', '96be5bc0-b666-43a3-89fd-0549ef5721ea', '8ae395cf-6cf0-4671-acc3-20084ee242ca', 'sugestao', 'Melhorar horário de saída', 'Sugiro que a saída seja antecipada em 30 minutos nos dias de maior volume para evitar atrasos', 'media', 'respondido', CURRENT_DATE - 3)
ON CONFLICT DO NOTHING;

UPDATE feedbacks SET resposta_lideranca = 'Boa sugestão Carlos! Vamos avaliar a possibilidade de antecipar a saída a partir da próxima semana.', responded_at = NOW() - INTERVAL '1 day'
WHERE titulo = 'Melhorar horário de saída' AND user_id = '2093f6ca-746b-45f9-b505-e2170b785a58' AND resposta_lideranca IS NULL;

-- Pedro (ajudante) data
INSERT INTO user_indicator_daily (user_id, indicator_id, data_referencia, valor, meta, percentual_atingimento, status, origem_dado) VALUES
  ('59f074a6-b5b6-4994-aee9-89f83a4b9dd6', '49487ebb-1787-423b-8ee7-e0be330cf81b', CURRENT_DATE, 23, 25, 92.0, 'dentro_meta', 'manual'),
  ('59f074a6-b5b6-4994-aee9-89f83a4b9dd6', '2beabd02-3424-439f-a89e-2b53eaee2e5e', CURRENT_DATE, 1, 2, 100.0, 'acima_meta', 'manual')
ON CONFLICT (user_id, indicator_id, data_referencia) DO UPDATE SET
  valor = EXCLUDED.valor, meta = EXCLUDED.meta, percentual_atingimento = EXCLUDED.percentual_atingimento, status = EXCLUDED.status;
