-- Remover qualquer policy de SELECT em storage.objects para o bucket avatars
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%avatars%' OR policyname ILIKE '%avatar%')
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
  END LOOP;
END$$;

-- Revogar EXECUTE também de authenticated nas funções SECURITY DEFINER
-- (continuam funcionando dentro das policies RLS por serem SECURITY DEFINER + owner postgres)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_id(uuid) FROM authenticated, anon, PUBLIC;