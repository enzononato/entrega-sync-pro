
UPDATE public.mapa_historico m
SET mot_user_id = u.id
FROM public.users u
WHERE m.cd_mot = u.matricula
  AND m.cd_mot IS NOT NULL
  AND m.cd_mot <> '0'
  AND m.cd_mot <> ''
  AND m.mot_user_id IS NULL;

UPDATE public.mapa_historico m
SET aju1_user_id = u.id
FROM public.users u
WHERE m.cd_aju1 = u.matricula
  AND m.cd_aju1 IS NOT NULL
  AND m.cd_aju1 <> '0'
  AND m.cd_aju1 <> ''
  AND m.aju1_user_id IS NULL;

UPDATE public.mapa_historico m
SET aju2_user_id = u.id
FROM public.users u
WHERE m.cd_aju2 = u.matricula
  AND m.cd_aju2 IS NOT NULL
  AND m.cd_aju2 <> '0'
  AND m.cd_aju2 <> ''
  AND m.aju2_user_id IS NULL;
