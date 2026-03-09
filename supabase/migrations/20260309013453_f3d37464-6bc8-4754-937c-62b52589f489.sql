
-- Inserir as 7 unidades Revalle
INSERT INTO public.units (nome, codigo, cidade, estado, ativo) VALUES
  ('Revalle Juazeiro',          'JUA01', 'Juazeiro',          'BA', true),
  ('Revalle Bonfim',            'BON01', 'Bonfim',            'BA', true),
  ('Revalle Petrolina',         'PET01', 'Petrolina',         'PE', true),
  ('Revalle Ribeira do Pombal', 'RPO01', 'Ribeira do Pombal', 'BA', true),
  ('Revalle Paulo Afonso',      'PAF01', 'Paulo Afonso',      'BA', true),
  ('Revalle Alagoinhas',        'ALA01', 'Alagoinhas',        'BA', true),
  ('Revalle Serrinha',          'SER01', 'Serrinha',          'BA', true);

-- Vincular todos os colaboradores à Revalle Juazeiro
UPDATE public.users
  SET unidade_id = (SELECT id FROM public.units WHERE codigo = 'JUA01')
  WHERE unidade_id = '833bfdc2-da38-4db5-b9a5-664f8253ba1a';

-- Atualizar as rotas existentes para Revalle Juazeiro
UPDATE public.routes
  SET unidade_id = (SELECT id FROM public.units WHERE codigo = 'JUA01')
  WHERE unidade_id = '833bfdc2-da38-4db5-b9a5-664f8253ba1a';

-- Desativar a unidade demo "São Paulo Centro"
UPDATE public.units SET ativo = false WHERE codigo = 'SP01';
