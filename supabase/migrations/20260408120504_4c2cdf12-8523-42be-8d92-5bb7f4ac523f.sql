
-- Insert the 4 time indicators
INSERT INTO indicators (codigo, nome, descricao, categoria, unidade_medida, applies_to_worker_type, ativo)
VALUES
  ('TML', 'TML', 'Tempo entre saída do CDD e 07:50. Perdido se saída após 08:20.', 'tempo', 'HH:MM', 'motorista,ajudante', true),
  ('TR', 'Tempo em Rota', 'Diferença entre Entrada CDD e Saída CDD/Fab.', 'tempo', 'HH:MM', 'motorista,ajudante', true),
  ('TI', 'Tempo Interno', 'Diferença entre PC Física e Entrada CDD + PC Financeira e PC Física.', 'tempo', 'HH:MM', 'motorista,ajudante', true),
  ('JL', 'Jornada Líquida', 'Soma de TML + TR + TI.', 'tempo', 'HH:MM', 'motorista,ajudante', true);

-- Create goals for each indicator (motorista)
INSERT INTO goals (indicator_id, worker_type, valor_meta, periodo_tipo, vigencia_inicio, ativo)
SELECT id, 'motorista', 30, 'diario', CURRENT_DATE, true FROM indicators WHERE codigo = 'TML'
UNION ALL
SELECT id, 'motorista', 560, 'diario', CURRENT_DATE, true FROM indicators WHERE codigo = 'TR'
UNION ALL
SELECT id, 'motorista', 30, 'diario', CURRENT_DATE, true FROM indicators WHERE codigo = 'TI'
UNION ALL
SELECT id, 'motorista', 620, 'diario', CURRENT_DATE, true FROM indicators WHERE codigo = 'JL';

-- Create goals for each indicator (ajudante)
INSERT INTO goals (indicator_id, worker_type, valor_meta, periodo_tipo, vigencia_inicio, ativo)
SELECT id, 'ajudante', 30, 'diario', CURRENT_DATE, true FROM indicators WHERE codigo = 'TML'
UNION ALL
SELECT id, 'ajudante', 560, 'diario', CURRENT_DATE, true FROM indicators WHERE codigo = 'TR'
UNION ALL
SELECT id, 'ajudante', 30, 'diario', CURRENT_DATE, true FROM indicators WHERE codigo = 'TI'
UNION ALL
SELECT id, 'ajudante', 620, 'diario', CURRENT_DATE, true FROM indicators WHERE codigo = 'JL';
