UPDATE public.users
SET ativo = false
WHERE role = 'colaborador'
  AND ativo = true
  AND (cpf IS NULL OR cpf = '');