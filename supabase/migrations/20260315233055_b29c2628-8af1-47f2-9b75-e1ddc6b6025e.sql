
-- Tabela de descontos vinculados a metas
CREATE TABLE public.incentive_deductions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_meta NUMERIC NOT NULL DEFAULT 0,
  valor_realizado NUMERIC NOT NULL DEFAULT 0,
  percentual_atingimento NUMERIC NOT NULL DEFAULT 0,
  valor_desconto NUMERIC NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  UNIQUE (user_id, indicator_id, data_referencia)
);

-- RLS
ALTER TABLE public.incentive_deductions ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins full access incentive_deductions"
  ON public.incentive_deductions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users read own
CREATE POLICY "Users read own deductions"
  ON public.incentive_deductions
  FOR SELECT
  TO authenticated
  USING (user_id = get_user_id(auth.uid()));
