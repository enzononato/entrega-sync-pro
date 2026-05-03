-- 1) STORAGE: remover policy de listagem pública no bucket avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

-- Permitir apenas leitura por path conhecido (sem listagem)
-- Observação: leitura via URL pública continua funcionando porque o bucket é public.
-- Para bloquear listagem via API, removemos qualquer policy ampla de SELECT em storage.objects para o bucket.

-- 2) SECURITY DEFINER FUNCTIONS: revogar EXECUTE de funções de trigger e notificações
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_log_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_below_target() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_feedback_responded() FROM PUBLIC, anon, authenticated;

-- Garantir que apenas authenticated possa executar funções auxiliares usadas em RLS
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_id(uuid) TO authenticated;

-- 3) USER_ROLES: policies restritivas explícitas (defesa em profundidade)
CREATE POLICY "Block user_roles insert by non-admins"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block user_roles update by non-admins"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block user_roles delete by non-admins"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));