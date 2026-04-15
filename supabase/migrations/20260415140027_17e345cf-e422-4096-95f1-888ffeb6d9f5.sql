
CREATE TABLE public.reposicao_031805 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid,
  unb text,
  descricao_unb text,
  codigo_cliente text,
  nome_cliente text,
  solicitacao_reposicao text,
  tipo_solicitacao text,
  data_solicitacao date,
  hora text,
  status_solicitacao text,
  justificativa text,
  mapa_origem text,
  nf_origem text,
  produto text,
  descricao_produto text,
  quantidade numeric DEFAULT 0,
  unidade_medida text,
  valor_unitario numeric DEFAULT 0,
  valor numeric DEFAULT 0,
  motorista_codigo text,
  motorista_nome text,
  ajudante_codigo text,
  ajudante_nome text,
  sistema_origem text,
  observacao text
);

ALTER TABLE public.reposicao_031805 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access reposicao_031805"
ON public.reposicao_031805
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
