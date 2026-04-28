CREATE TABLE public.rating_avaliacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_referencia_inicio date NOT NULL,
  data_referencia_fim date NOT NULL,
  worker_type text NOT NULL,
  matricula text NOT NULL,
  nome text,
  avaliacoes integer NOT NULL DEFAULT 0,
  pdv integer NOT NULL DEFAULT 0,
  promotor integer NOT NULL DEFAULT 0,
  neutro integer NOT NULL DEFAULT 0,
  detrator integer NOT NULL DEFAULT 0,
  pct_promotor numeric NOT NULL DEFAULT 0,
  pct_neutro numeric NOT NULL DEFAULT 0,
  pct_detrator numeric NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  meta numeric NOT NULL DEFAULT 0,
  gap numeric NOT NULL DEFAULT 0,
  unidade text,
  user_id uuid,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rating_avaliacoes_unique UNIQUE (data_referencia_inicio, data_referencia_fim, worker_type, matricula)
);

CREATE INDEX idx_rating_avaliacoes_user_id ON public.rating_avaliacoes(user_id);
CREATE INDEX idx_rating_avaliacoes_periodo ON public.rating_avaliacoes(data_referencia_inicio, data_referencia_fim);

ALTER TABLE public.rating_avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access rating_avaliacoes"
ON public.rating_avaliacoes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own rating_avaliacoes"
ON public.rating_avaliacoes
FOR SELECT
TO authenticated
USING (user_id = get_user_id(auth.uid()));