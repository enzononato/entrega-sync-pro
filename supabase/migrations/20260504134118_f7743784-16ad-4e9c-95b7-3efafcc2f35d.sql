-- 1. Inserir indicador PDV_CRITICO
INSERT INTO public.indicators (codigo, nome, categoria, descricao, applies_to_worker_type, periodicidade, unidade_medida, ativo)
VALUES ('PDV_CRITICO', 'PDV Crítico', 'Qualidade',
        'Quantidade de feedbacks relevantes recebidos por motorista (BEES)',
        'motorista', 'mensal', 'feedbacks', true)
ON CONFLICT DO NOTHING;

-- 2. Tabela de feedbacks brutos
CREATE TABLE IF NOT EXISTS public.pdv_critico_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes text NOT NULL,
  mes_num int NOT NULL,
  ano int NOT NULL,
  semana int,
  data_referencia date NOT NULL,
  codigo_cliente text,
  cliente text,
  motorista_nome text,
  comentario text,
  estado text,
  data_notificacao date,
  tratado_por text,
  data_analise date,
  instrucao text,
  categoria text,
  status text,
  tmr numeric,
  matricula text,
  cpf text,
  user_id uuid,
  unidade_id uuid,
  import_batch_id uuid,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unicidade para deduplicação (cpf pode ser null; usamos coalesce em hash)
CREATE UNIQUE INDEX IF NOT EXISTS pdv_critico_feedbacks_uniq
  ON public.pdv_critico_feedbacks (
    COALESCE(cpf, ''),
    mes_num,
    ano,
    COALESCE(semana, 0),
    COALESCE(codigo_cliente, ''),
    md5(COALESCE(comentario, ''))
  );

CREATE INDEX IF NOT EXISTS pdv_critico_feedbacks_cpf_mes_ano
  ON public.pdv_critico_feedbacks (cpf, mes_num, ano);
CREATE INDEX IF NOT EXISTS pdv_critico_feedbacks_user_data
  ON public.pdv_critico_feedbacks (user_id, data_referencia);
CREATE INDEX IF NOT EXISTS pdv_critico_feedbacks_batch
  ON public.pdv_critico_feedbacks (import_batch_id);

ALTER TABLE public.pdv_critico_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access pdv_critico_feedbacks"
  ON public.pdv_critico_feedbacks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own pdv_critico_feedbacks"
  ON public.pdv_critico_feedbacks
  FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));
