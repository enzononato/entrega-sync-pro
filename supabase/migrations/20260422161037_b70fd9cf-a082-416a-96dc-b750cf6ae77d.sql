-- 1. Tabela para dados brutos importados
CREATE TABLE public.refugo_031134 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_operacao DATE NOT NULL,
  mapa TEXT NOT NULL,
  veiculo TEXT,
  placa TEXT,
  transportadora TEXT,
  pct_incidencia_veiculo NUMERIC DEFAULT 0,
  pct_nao_aferido NUMERIC DEFAULT 0,
  cod_motorista TEXT,
  nome_motorista TEXT,
  cod_ajudante TEXT,
  nome_ajudante TEXT,
  cod_conferente TEXT,
  nome_conferente TEXT,
  item TEXT,
  descricao_item TEXT,
  total_aferido NUMERIC DEFAULT 0,
  quebrada NUMERIC DEFAULT 0,
  segunda NUMERIC DEFAULT 0,
  bicada_interna NUMERIC DEFAULT 0,
  bicada_externa NUMERIC DEFAULT 0,
  cor_fora_padrao NUMERIC DEFAULT 0,
  faltante NUMERIC DEFAULT 0,
  logomarca_estranha NUMERIC DEFAULT 0,
  rotulo_plastico NUMERIC DEFAULT 0,
  sujidade_interna NUMERIC DEFAULT 0,
  sujidade_externa NUMERIC DEFAULT 0,
  tampada NUMERIC DEFAULT 0,
  trincada NUMERIC DEFAULT 0,
  bicada_concorrente NUMERIC DEFAULT 0,
  outros NUMERIC DEFAULT 0,
  pct_refugo NUMERIC NOT NULL DEFAULT 0,
  qt_boa NUMERIC DEFAULT 0,
  tipo_sorteio TEXT,
  mot_user_id UUID,
  aju1_user_id UUID,
  aju2_user_id UUID,
  imported_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refugo_031134_mapa ON public.refugo_031134(mapa);
CREATE INDEX idx_refugo_031134_data ON public.refugo_031134(data_operacao);

ALTER TABLE public.refugo_031134 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access refugo_031134"
ON public.refugo_031134 FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Indicador Refugo (apenas ajudantes)
INSERT INTO public.indicators (codigo, nome, categoria, unidade_medida, descricao, applies_to_worker_type, ativo)
VALUES ('REFUGO', 'Refugo', 'qualidade', '%', 'Percentual de refugo aferido na conferência (origem: tabela 03.11.34.05)', 'ajudante', true)
ON CONFLICT DO NOTHING;

-- 3. Meta padrão 0,50% para ajudantes, sem desafio
INSERT INTO public.goals (indicator_id, worker_type, valor_meta, valor_bonificacao, valor_desafio, valor_bonificacao_desafio, periodo_tipo, vigencia_inicio, ativo)
SELECT id, 'ajudante', 0.50, 0, 0, 0, 'mensal', CURRENT_DATE, true
FROM public.indicators WHERE codigo = 'REFUGO'
ON CONFLICT DO NOTHING;