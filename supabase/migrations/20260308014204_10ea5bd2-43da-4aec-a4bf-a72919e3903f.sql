
-- user_incentives_daily
CREATE TABLE public.user_incentives_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_estimado NUMERIC NOT NULL DEFAULT 0,
  valor_fechado NUMERIC,
  status TEXT NOT NULL DEFAULT 'estimado' CHECK (status IN ('estimado', 'fechado', 'revisao')),
  detalhes_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, data_referencia)
);

ALTER TABLE public.user_incentives_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own incentives" ON public.user_incentives_daily FOR SELECT TO authenticated USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins read all incentives" ON public.user_incentives_daily FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins insert incentives" ON public.user_incentives_daily FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins update incentives" ON public.user_incentives_daily FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins delete incentives" ON public.user_incentives_daily FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));

-- root_cause_records
CREATE TABLE public.root_cause_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id),
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao_problema TEXT NOT NULL DEFAULT '',
  categoria_causa TEXT NOT NULL DEFAULT '',
  causa_raiz TEXT NOT NULL DEFAULT '',
  impacto TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.root_cause_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own causes" ON public.root_cause_records FOR SELECT TO authenticated USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins read all causes" ON public.root_cause_records FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Users insert own causes" ON public.root_cause_records FOR INSERT TO authenticated WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins insert causes" ON public.root_cause_records FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins update causes" ON public.root_cause_records FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins delete causes" ON public.root_cause_records FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));

-- action_plans
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  root_cause_id UUID NOT NULL REFERENCES public.root_cause_records(id) ON DELETE CASCADE,
  responsavel_user_id UUID NOT NULL REFERENCES public.users(id),
  descricao_acao TEXT NOT NULL DEFAULT '',
  prazo DATE,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'concluido', 'atrasado', 'cancelado')),
  observacoes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plans" ON public.action_plans FOR SELECT TO authenticated USING (responsavel_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins read all plans" ON public.action_plans FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Users insert own plans" ON public.action_plans FOR INSERT TO authenticated WITH CHECK (responsavel_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins insert plans" ON public.action_plans FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins update plans" ON public.action_plans FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Users update own plans" ON public.action_plans FOR UPDATE TO authenticated USING (responsavel_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())) WITH CHECK (responsavel_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins delete plans" ON public.action_plans FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
