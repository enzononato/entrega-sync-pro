ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_tipo_check;
ALTER TABLE public.import_batches ADD CONSTRAINT import_batches_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'mapas'::text,
    'rating'::text,
    'refugo_031134'::text,
    'reposicao_031805'::text,
    'colaboradores'::text,
    'pdv_critico'::text,
    'relatos'::text
  ]));