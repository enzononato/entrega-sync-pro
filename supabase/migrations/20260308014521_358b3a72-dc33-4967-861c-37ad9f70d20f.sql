
-- feedbacks table
CREATE TABLE public.feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.units(id),
  rota_id UUID REFERENCES public.routes(id),
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL CHECK (tipo IN ('operacao','sistema','processo','seguranca','sugestao','incidente')),
  titulo TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  urgencia TEXT NOT NULL DEFAULT 'baixa' CHECK (urgencia IN ('baixa','media','alta','critica')),
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_analise','respondido','encerrado')),
  resposta_lideranca TEXT,
  respondido_por UUID REFERENCES public.users(id),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own feedbacks" ON public.feedbacks FOR SELECT TO authenticated USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins read all feedbacks" ON public.feedbacks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Users insert own feedbacks" ON public.feedbacks FOR INSERT TO authenticated WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admins insert feedbacks" ON public.feedbacks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins update feedbacks" ON public.feedbacks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')) WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "Admins delete feedbacks" ON public.feedbacks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador'));
