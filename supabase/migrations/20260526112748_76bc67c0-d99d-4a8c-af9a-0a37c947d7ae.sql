
-- 1) Dedup defensivo: mantém o registro mais recente (id maior)
DELETE FROM public.rating_avaliacoes a
USING public.rating_avaliacoes b
WHERE a.id < b.id
  AND a.data_referencia_inicio = b.data_referencia_inicio
  AND a.worker_type = b.worker_type
  AND COALESCE(a.unidade, '') = COALESCE(b.unidade, '')
  AND a.matricula = b.matricula;

-- 2) Índice único garante unicidade real no banco
CREATE UNIQUE INDEX IF NOT EXISTS rating_avaliacoes_mes_tipo_unidade_matricula_uidx
  ON public.rating_avaliacoes (data_referencia_inicio, worker_type, unidade, matricula);

-- 3) RPC: delete + insert atômico, com snapshot dos antigos
CREATE OR REPLACE FUNCTION public.replace_rating_month(
  p_inicio date,
  p_fim date,
  p_worker_type text,
  p_unidade text,
  p_rows jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_lock_key bigint;
  v_snapshot jsonb := '[]'::jsonb;
  v_matriculas text[];
BEGIN
  -- AuthZ: apenas admins
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  -- Lock por mês + tipo + unidade (escopo: transação)
  v_lock_key := hashtextextended(
    'rating:' || to_char(p_inicio, 'YYYY-MM') || ':' || COALESCE(p_worker_type,'') || ':' || COALESCE(p_unidade,''),
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Lista de matrículas vindas no payload
  SELECT COALESCE(array_agg(DISTINCT r->>'matricula'), ARRAY[]::text[])
    INTO v_matriculas
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) r
  WHERE r->>'matricula' IS NOT NULL AND r->>'matricula' <> '';

  -- Snapshot dos antigos que serão sobrescritos
  SELECT COALESCE(jsonb_agg(to_jsonb(ra) - 'id'), '[]'::jsonb)
    INTO v_snapshot
  FROM public.rating_avaliacoes ra
  WHERE ra.data_referencia_inicio = p_inicio
    AND ra.worker_type = p_worker_type
    AND ra.unidade = p_unidade
    AND ra.matricula = ANY(v_matriculas);

  -- Apaga só as matrículas que vão ser reinseridas
  DELETE FROM public.rating_avaliacoes ra
   WHERE ra.data_referencia_inicio = p_inicio
     AND ra.worker_type = p_worker_type
     AND ra.unidade = p_unidade
     AND ra.matricula = ANY(v_matriculas);

  -- Insere os novos
  INSERT INTO public.rating_avaliacoes (
    data_referencia_inicio, data_referencia_fim, worker_type, unidade,
    matricula, nome, avaliacoes, pdv, promotor, neutro, detrator,
    pct_promotor, pct_neutro, pct_detrator, rating, meta, gap,
    user_id, imported_by, import_batch_id
  )
  SELECT
    p_inicio, p_fim, p_worker_type, p_unidade,
    r->>'matricula',
    NULLIF(r->>'nome',''),
    COALESCE((r->>'avaliacoes')::int, 0),
    COALESCE((r->>'pdv')::int, 0),
    COALESCE((r->>'promotor')::int, 0),
    COALESCE((r->>'neutro')::int, 0),
    COALESCE((r->>'detrator')::int, 0),
    COALESCE((r->>'pct_promotor')::numeric, 0),
    COALESCE((r->>'pct_neutro')::numeric, 0),
    COALESCE((r->>'pct_detrator')::numeric, 0),
    COALESCE((r->>'rating')::numeric, 0),
    COALESCE((r->>'meta')::numeric, 0),
    COALESCE((r->>'gap')::numeric, 0),
    NULLIF(r->>'user_id','')::uuid,
    NULLIF(r->>'imported_by','')::uuid,
    NULLIF(r->>'import_batch_id','')::uuid
  FROM jsonb_array_elements(p_rows) r
  WHERE r->>'matricula' IS NOT NULL AND r->>'matricula' <> '';

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'snapshot', v_snapshot
  );
END;
$$;

-- 4) RPC para restaurar snapshot durante o desfazer (atômico)
CREATE OR REPLACE FUNCTION public.restore_rating_snapshot(p_snapshot jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restored integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'array' OR jsonb_array_length(p_snapshot) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.rating_avaliacoes (
    data_referencia_inicio, data_referencia_fim, worker_type, unidade,
    matricula, nome, avaliacoes, pdv, promotor, neutro, detrator,
    pct_promotor, pct_neutro, pct_detrator, rating, meta, gap,
    user_id, imported_by, import_batch_id, created_at
  )
  SELECT
    (r->>'data_referencia_inicio')::date,
    (r->>'data_referencia_fim')::date,
    r->>'worker_type',
    r->>'unidade',
    r->>'matricula',
    NULLIF(r->>'nome',''),
    COALESCE((r->>'avaliacoes')::int, 0),
    COALESCE((r->>'pdv')::int, 0),
    COALESCE((r->>'promotor')::int, 0),
    COALESCE((r->>'neutro')::int, 0),
    COALESCE((r->>'detrator')::int, 0),
    COALESCE((r->>'pct_promotor')::numeric, 0),
    COALESCE((r->>'pct_neutro')::numeric, 0),
    COALESCE((r->>'pct_detrator')::numeric, 0),
    COALESCE((r->>'rating')::numeric, 0),
    COALESCE((r->>'meta')::numeric, 0),
    COALESCE((r->>'gap')::numeric, 0),
    NULLIF(r->>'user_id','')::uuid,
    NULLIF(r->>'imported_by','')::uuid,
    NULLIF(r->>'import_batch_id','')::uuid,
    COALESCE((r->>'created_at')::timestamptz, now())
  FROM jsonb_array_elements(p_snapshot) r
  WHERE r->>'matricula' IS NOT NULL AND r->>'matricula' <> ''
  ON CONFLICT (data_referencia_inicio, worker_type, unidade, matricula) DO NOTHING;

  GET DIAGNOSTICS v_restored = ROW_COUNT;
  RETURN v_restored;
END;
$$;
