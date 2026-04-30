-- Limpar vínculos incorretos onde mot_user_id aponta para um usuário cujo worker_type não é motorista
-- ou cuja matrícula não bate com cd_mot
UPDATE public.mapa_historico m
SET mot_user_id = NULL
FROM public.users u
WHERE m.mot_user_id = u.id
  AND (u.worker_type <> 'motorista' OR TRIM(u.matricula) <> TRIM(m.cd_mot));

-- Mesma limpeza para ajudante 1
UPDATE public.mapa_historico m
SET aju1_user_id = NULL
FROM public.users u
WHERE m.aju1_user_id = u.id
  AND (u.worker_type <> 'ajudante' OR TRIM(u.matricula) <> TRIM(m.cd_aju1));

-- Mesma limpeza para ajudante 2
UPDATE public.mapa_historico m
SET aju2_user_id = NULL
FROM public.users u
WHERE m.aju2_user_id = u.id
  AND (u.worker_type <> 'ajudante' OR TRIM(u.matricula) <> TRIM(m.cd_aju2));