
-- Create indicators table
CREATE TABLE public.indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT '',
  unidade_medida TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  applies_to_worker_type TEXT NOT NULL DEFAULT 'ambos' CHECK (applies_to_worker_type IN ('motorista', 'ajudante', 'ambos')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read indicators" ON public.indicators
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert indicators" ON public.indicators
  FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can update indicators" ON public.indicators
  FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can delete indicators" ON public.indicators
  FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));

-- Create goals table
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_id UUID REFERENCES public.indicators(id) NOT NULL,
  unidade_id UUID REFERENCES public.units(id),
  worker_type TEXT CHECK (worker_type IN ('motorista', 'ajudante')),
  user_id UUID REFERENCES public.users(id),
  valor_meta NUMERIC NOT NULL DEFAULT 0,
  periodo_tipo TEXT NOT NULL DEFAULT 'diario' CHECK (periodo_tipo IN ('diario', 'semanal', 'mensal')),
  vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read goals" ON public.goals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert goals" ON public.goals
  FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can update goals" ON public.goals
  FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can delete goals" ON public.goals
  FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));

-- Create incentive_rules table
CREATE TABLE public.incentive_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_id UUID REFERENCES public.indicators(id) NOT NULL,
  worker_type TEXT NOT NULL CHECK (worker_type IN ('motorista', 'ajudante')),
  unidade_id UUID REFERENCES public.units(id),
  peso NUMERIC NOT NULL DEFAULT 1,
  meta NUMERIC NOT NULL DEFAULT 0,
  valor_minimo NUMERIC NOT NULL DEFAULT 0,
  valor_maximo NUMERIC NOT NULL DEFAULT 0,
  regra_json JSONB NOT NULL DEFAULT '{}',
  vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.incentive_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read incentive_rules" ON public.incentive_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert incentive_rules" ON public.incentive_rules
  FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can update incentive_rules" ON public.incentive_rules
  FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can delete incentive_rules" ON public.incentive_rules
  FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));

-- Create user_indicator_daily table
CREATE TABLE public.user_indicator_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  indicator_id UUID REFERENCES public.indicators(id) NOT NULL,
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  valor NUMERIC NOT NULL DEFAULT 0,
  meta NUMERIC,
  percentual_atingimento NUMERIC,
  status TEXT CHECK (status IN ('abaixo_meta', 'dentro_meta', 'acima_meta')),
  origem_dado TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, indicator_id, data_referencia)
);

ALTER TABLE public.user_indicator_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own indicator data" ON public.user_indicator_daily
  FOR SELECT TO authenticated USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins can read all indicator data" ON public.user_indicator_daily
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can insert indicator data" ON public.user_indicator_daily
  FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can update indicator data" ON public.user_indicator_daily
  FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins can delete indicator data" ON public.user_indicator_daily
  FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
