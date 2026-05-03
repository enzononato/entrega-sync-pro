-- 1. Tabela de lotes de importação
CREATE TABLE public.import_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('mapas', 'rating', 'refugo_031134', 'reposicao_031805', 'colaboradores')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('preview', 'confirmed', 'undone')),
  arquivo_nome text NOT NULL DEFAULT '',
  total_linhas integer NOT NULL DEFAULT 0,
  linhas_inseridas integer NOT NULL DEFAULT 0,
  linhas_duplicadas integer NOT NULL DEFAULT 0,
  linhas_invalidas integer NOT NULL DEFAULT 0,
  payload_preview jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_by uuid,
  confirmed_at timestamp with time zone,
  undone_at timestamp with time zone,
  undone_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access import_batches"
ON public.import_batches
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_import_batches_tipo_created ON public.import_batches (tipo, created_at DESC);
CREATE INDEX idx_import_batches_status ON public.import_batches (status);

-- 2. Coluna import_batch_id nas tabelas alvo
ALTER TABLE public.mapa_historico       ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.rating_avaliacoes    ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.refugo_031134        ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.reposicao_031805     ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.users                ADD COLUMN IF NOT EXISTS import_batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_mapa_historico_import_batch    ON public.mapa_historico    (import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rating_avaliacoes_import_batch ON public.rating_avaliacoes (import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refugo_031134_import_batch     ON public.refugo_031134     (import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reposicao_031805_import_batch  ON public.reposicao_031805  (import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_import_batch             ON public.users             (import_batch_id) WHERE import_batch_id IS NOT NULL;