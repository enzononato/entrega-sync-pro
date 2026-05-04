
CREATE TABLE public.relatos_seguranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_cadastrado date NOT NULL,
  mes_num int NOT NULL,
  ano int NOT NULL,
  data_referencia date NOT NULL,
  relato_id text,
  cargo_relatante text,
  revenda text,
  tipo text,
  local text,
  infracao text,
  relato text,
  status text,
  classificacao text,
  prioridade text,
  data_ocorrido date,
  cpf text,
  matricula text,
  user_id uuid,
  unidade_id uuid,
  import_batch_id uuid,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_relatos_user_mes ON public.relatos_seguranca (user_id, ano, mes_num);
CREATE INDEX idx_relatos_cpf ON public.relatos_seguranca (cpf);
CREATE INDEX idx_relatos_matricula ON public.relatos_seguranca (matricula);
CREATE INDEX idx_relatos_batch ON public.relatos_seguranca (import_batch_id);
CREATE INDEX idx_relatos_relato_id ON public.relatos_seguranca (relato_id);

ALTER TABLE public.relatos_seguranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access relatos_seguranca"
ON public.relatos_seguranca FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Users read own relatos_seguranca"
ON public.relatos_seguranca FOR SELECT TO authenticated
USING (user_id = get_user_id(auth.uid()));

INSERT INTO public.indicators (codigo, nome, categoria, descricao, applies_to_worker_type, periodicidade, unidade_medida, ativo)
VALUES ('RELATOS', 'Relatos de Segurança', 'Segurança',
  'Quantidade de relatos de segurança cadastrados no mês (maior é melhor).',
  'ajudante', 'mensal', 'relatos', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.goals (indicator_id, worker_type, valor_meta, valor_desafio,
                          valor_bonificacao, valor_bonificacao_desafio, periodo_tipo, ativo)
SELECT i.id, 'ajudante', 5, 15, 52.50, 10.00, 'mensal', true
FROM public.indicators i
WHERE i.codigo = 'RELATOS'
  AND NOT EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.indicator_id = i.id AND g.worker_type = 'ajudante' AND g.ativo
  );
