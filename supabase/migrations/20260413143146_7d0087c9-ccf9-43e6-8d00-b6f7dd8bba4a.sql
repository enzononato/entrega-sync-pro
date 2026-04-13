
-- Remover dados relacionados aos colaboradores
DELETE FROM public.action_plans WHERE responsavel_user_id IN (SELECT id FROM public.users WHERE role = 'colaborador');
DELETE FROM public.root_cause_records WHERE user_id IN (SELECT id FROM public.users WHERE role = 'colaborador');
DELETE FROM public.feedbacks WHERE user_id IN (SELECT id FROM public.users WHERE role = 'colaborador');
DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM public.users WHERE role = 'colaborador');
DELETE FROM public.user_units WHERE user_id IN (SELECT id FROM public.users WHERE role = 'colaborador');

-- Remover roles dos colaboradores (auth_user_id)
DELETE FROM public.user_roles WHERE user_id IN (SELECT auth_user_id FROM public.users WHERE role = 'colaborador');

-- Remover os colaboradores da tabela users
DELETE FROM public.users WHERE role = 'colaborador';
