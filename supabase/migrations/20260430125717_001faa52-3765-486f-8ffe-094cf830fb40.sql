
-- Corrige vínculos de mapa_historico que estão apontando para o worker_type errado.
-- Caso 1: mot_user_id deve ser sempre um motorista (re-resolve via cd_mot)
UPDATE public.mapa_historico m
SET mot_user_id = u.id
FROM public.users u
WHERE m.cd_mot IS NOT NULL
  AND m.cd_mot <> ''
  AND m.cd_mot <> '0'
  AND u.matricula = m.cd_mot
  AND u.worker_type = 'motorista'
  AND (m.mot_user_id IS NULL OR m.mot_user_id <> u.id);

-- Limpa mot_user_id quando aponta para um ajudante e não há motorista correspondente
UPDATE public.mapa_historico m
SET mot_user_id = NULL
WHERE m.mot_user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = m.mot_user_id AND u.worker_type <> 'motorista')
  AND NOT EXISTS (SELECT 1 FROM public.users u2 WHERE u2.matricula = m.cd_mot AND u2.worker_type = 'motorista');

-- Caso 2: aju1_user_id deve ser sempre um ajudante
UPDATE public.mapa_historico m
SET aju1_user_id = u.id
FROM public.users u
WHERE m.cd_aju1 IS NOT NULL
  AND m.cd_aju1 <> ''
  AND m.cd_aju1 <> '0'
  AND u.matricula = m.cd_aju1
  AND u.worker_type = 'ajudante'
  AND (m.aju1_user_id IS NULL OR m.aju1_user_id <> u.id);

UPDATE public.mapa_historico m
SET aju1_user_id = NULL
WHERE m.aju1_user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = m.aju1_user_id AND u.worker_type <> 'ajudante')
  AND NOT EXISTS (SELECT 1 FROM public.users u2 WHERE u2.matricula = m.cd_aju1 AND u2.worker_type = 'ajudante');

-- Caso 3: aju2_user_id deve ser sempre um ajudante
UPDATE public.mapa_historico m
SET aju2_user_id = u.id
FROM public.users u
WHERE m.cd_aju2 IS NOT NULL
  AND m.cd_aju2 <> ''
  AND m.cd_aju2 <> '0'
  AND u.matricula = m.cd_aju2
  AND u.worker_type = 'ajudante'
  AND (m.aju2_user_id IS NULL OR m.aju2_user_id <> u.id);

UPDATE public.mapa_historico m
SET aju2_user_id = NULL
WHERE m.aju2_user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = m.aju2_user_id AND u.worker_type <> 'ajudante')
  AND NOT EXISTS (SELECT 1 FROM public.users u2 WHERE u2.matricula = m.cd_aju2 AND u2.worker_type = 'ajudante');
