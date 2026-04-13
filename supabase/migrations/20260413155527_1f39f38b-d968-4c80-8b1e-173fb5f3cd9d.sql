
ALTER TABLE public.mapa_historico
  ADD COLUMN mot_user_id uuid,
  ADD COLUMN aju1_user_id uuid,
  ADD COLUMN aju2_user_id uuid;

CREATE POLICY "Users read own mapa_historico"
  ON public.mapa_historico FOR SELECT
  TO authenticated
  USING (
    mot_user_id = get_user_id(auth.uid())
    OR aju1_user_id = get_user_id(auth.uid())
    OR aju2_user_id = get_user_id(auth.uid())
  );
