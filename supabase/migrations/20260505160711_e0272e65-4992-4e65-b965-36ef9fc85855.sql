-- Indexes to support dashboard aggregations
CREATE INDEX IF NOT EXISTS idx_uid_data_referencia
  ON public.user_indicator_daily (data_referencia);
CREATE INDEX IF NOT EXISTS idx_uid_user_data
  ON public.user_indicator_daily (user_id, data_referencia);
CREATE INDEX IF NOT EXISTS idx_uid_indicator_data
  ON public.user_indicator_daily (indicator_id, data_referencia);
CREATE INDEX IF NOT EXISTS idx_users_unidade_worker_ativo
  ON public.users (unidade_id, worker_type) WHERE ativo = true;

-- Aggregated metrics RPC for the admin dashboard
CREATE OR REPLACE FUNCTION public.dashboard_metrics(
  p_inicio date,
  p_fim date,
  p_unidade_id uuid DEFAULT NULL,
  p_worker_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_user_id uuid;
  v_has_unit_restriction boolean;
  v_inicio_ym text := to_char(p_inicio, 'YYYY-MM');
  v_fim_ym text := to_char(p_fim, 'YYYY-MM');
  v_result jsonb;
  v_totals record;
  v_per_indicator jsonb;
BEGIN
  -- AuthZ: admin only
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  v_admin_user_id := public.get_user_id(auth.uid());
  v_has_unit_restriction := EXISTS (
    SELECT 1 FROM public.user_units uu WHERE uu.user_id = v_admin_user_id
  );

  -- If a specific unit was requested, check access
  IF p_unidade_id IS NOT NULL AND NOT public.admin_can_access_unit(p_unidade_id) THEN
    RAISE EXCEPTION 'access denied for unit';
  END IF;

  -- Build a CTE of relevant rows once and aggregate
  WITH visible_users AS (
    SELECT u.id
    FROM public.users u
    WHERE u.ativo = true
      AND u.role = 'colaborador'
      AND (p_unidade_id IS NULL OR u.unidade_id = p_unidade_id)
      AND (p_worker_type IS NULL OR u.worker_type = p_worker_type)
      AND (
        NOT v_has_unit_restriction
        OR u.unidade_id IN (
          SELECT uu.unit_id FROM public.user_units uu WHERE uu.user_id = v_admin_user_id
        )
      )
  ),
  rows_in_period AS (
    SELECT
      uid.user_id,
      uid.indicator_id,
      uid.status,
      uid.status_desafio,
      uid.desafio,
      i.codigo,
      i.nome,
      i.periodicidade
    FROM public.user_indicator_daily uid
    JOIN public.indicators i ON i.id = uid.indicator_id
    JOIN visible_users vu ON vu.id = uid.user_id
    WHERE
      CASE
        WHEN i.periodicidade = 'mensal'
          THEN to_char(uid.data_referencia, 'YYYY-MM') BETWEEN v_inicio_ym AND v_fim_ym
        ELSE uid.data_referencia BETWEEN p_inicio AND p_fim
      END
  ),
  totals AS (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('dentro_meta','acima_meta','atingiu')) AS metas_atingidas,
      COUNT(*) FILTER (WHERE status IN ('dentro_meta','acima_meta','atingiu','abaixo_meta','nao_atingiu')) AS metas_total,
      COUNT(*) FILTER (WHERE status IN ('abaixo_meta','nao_atingiu')) AS abaixo_meta,
      COUNT(*) FILTER (WHERE desafio IS NOT NULL AND desafio > 0
                          AND status IN ('dentro_meta','acima_meta','atingiu')) AS desafios_total,
      COUNT(*) FILTER (WHERE desafio IS NOT NULL AND desafio > 0
                          AND status IN ('dentro_meta','acima_meta','atingiu')
                          AND status_desafio = 'atingiu') AS desafios_atingidos
    FROM rows_in_period
  ),
  by_ind AS (
    SELECT
      indicator_id,
      MAX(codigo) AS codigo,
      MAX(nome) AS nome,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status IN ('dentro_meta','acima_meta','atingiu')) AS atingidas,
      COUNT(*) FILTER (WHERE status IN ('abaixo_meta','nao_atingiu')) AS abaixo
    FROM rows_in_period
    GROUP BY indicator_id
  )
  SELECT
    jsonb_build_object(
      'metas_atingidas', t.metas_atingidas,
      'metas_total', t.metas_total,
      'abaixo_meta', t.abaixo_meta,
      'desafios_total', t.desafios_total,
      'desafios_atingidos', t.desafios_atingidos,
      'por_indicador', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'indicator_id', b.indicator_id,
          'codigo', b.codigo,
          'nome', b.nome,
          'total', b.total,
          'atingidas', b.atingidas,
          'abaixo', b.abaixo
        ) ORDER BY b.codigo)
        FROM by_ind b
      ), '[]'::jsonb)
    )
  INTO v_result
  FROM totals t;

  RETURN COALESCE(v_result, jsonb_build_object(
    'metas_atingidas', 0, 'metas_total', 0, 'abaixo_meta', 0,
    'desafios_total', 0, 'desafios_atingidos', 0, 'por_indicador', '[]'::jsonb
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_metrics(date, date, uuid, text) TO authenticated;