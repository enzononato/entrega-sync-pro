
DROP TABLE IF EXISTS public.mapa_historico;

CREATE TABLE public.mapa_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  data_operacao date NOT NULL DEFAULT CURRENT_DATE,
  transp integer,
  entrega text DEFAULT '',
  carga_atual text DEFAULT '',
  frota text DEFAULT '',
  custo_spot numeric DEFAULT 0,
  regiao text DEFAULT '',
  veiculo text DEFAULT '',
  placa text DEFAULT '',
  mapa text NOT NULL,
  capacidade numeric DEFAULT 0,
  entregas integer DEFAULT 0,
  cx_carreg numeric DEFAULT 0,
  cx_entreg numeric DEFAULT 0,
  ocupacao numeric DEFAULT 0,
  cx_rota numeric DEFAULT 0,
  cx_as numeric DEFAULT 0,
  veic_bm numeric DEFAULT 0,
  rshow numeric DEFAULT 0,
  entr_vol text DEFAULT '',
  hr_sai text DEFAULT '',
  hr_entr text DEFAULT '',
  km_sai numeric DEFAULT 0,
  km_entr numeric DEFAULT 0,
  km_prev numeric DEFAULT 0,
  tempo_prev text DEFAULT '',
  vl_pto_mot numeric DEFAULT 0,
  vl_pto_ajd numeric DEFAULT 0,
  vl_eq_mot numeric DEFAULT 0,
  vl_eq_ajd numeric DEFAULT 0,
  cd_mot text DEFAULT '',
  cd_aju1 text DEFAULT '',
  cd_aju2 text DEFAULT '',
  km_desloc numeric DEFAULT 0,
  km_laco numeric DEFAULT 0,
  tmpo_desloc text DEFAULT '',
  tmpo_laco text DEFAULT '',
  tmpo_interno text DEFAULT '',
  mot_nao_carr numeric DEFAULT 0,
  cx_carr_com numeric DEFAULT 0,
  capacidade_veiculo_kg numeric DEFAULT 0,
  peso_carga_kg numeric DEFAULT 0,
  classificacao_roadshow text DEFAULT '',
  classificacao_roads text DEFAULT ''
);

ALTER TABLE public.mapa_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access mapa_historico"
  ON public.mapa_historico FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
