
-- Create routes table
CREATE TABLE public.routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade_id UUID REFERENCES public.units(id) NOT NULL,
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key from users.rota_id to routes
ALTER TABLE public.users ADD CONSTRAINT users_rota_id_fkey FOREIGN KEY (rota_id) REFERENCES public.routes(id);

-- Enable RLS
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read routes" ON public.routes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert routes" ON public.routes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  );

CREATE POLICY "Admins can update routes" ON public.routes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  );

CREATE POLICY "Admins can delete routes" ON public.routes
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'administrador')
  );
