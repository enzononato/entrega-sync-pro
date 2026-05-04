ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_tipo_check;

ALTER TABLE public.import_batches
  ADD CONSTRAINT import_batches_tipo_check
  CHECK (tipo IN ('mapas', '03.18.05', '03.11.34.05', 'rating', 'pdv_critico', 'colaboradores', 'matriculas', 'desempenho', 'caixas_batidas'));