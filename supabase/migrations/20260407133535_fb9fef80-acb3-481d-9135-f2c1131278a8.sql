
CREATE TABLE public.mapa_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapa text NOT NULL,
  fase text NOT NULL DEFAULT '',
  veiculo text NOT NULL DEFAULT '',
  placa text NOT NULL DEFAULT '',
  frota_cadastro text NOT NULL DEFAULT '',
  tipo_mapa text NOT NULL DEFAULT '',
  data_operacao date NOT NULL DEFAULT CURRENT_DATE,
  hora_operacao text NOT NULL DEFAULT '',
  usuario text NOT NULL DEFAULT '',
  motorista_matricula text NOT NULL DEFAULT '',
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mapa_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access mapa_historico"
  ON public.mapa_historico FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own mapa_historico"
  ON public.mapa_historico FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));
