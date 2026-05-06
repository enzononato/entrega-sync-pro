
-- 1) Índice único parcial: impede duas linhas de Caixas Batidas para o mesmo usuário/mês
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_incentives_caixas_batidas
  ON public.user_incentives_daily (user_id, data_referencia)
  WHERE (detalhes_json->>'tipo') = 'caixas_batidas';

-- 2) Função atômica para substituir os registros de Caixas Batidas de um mês.
--    Usa pg_advisory_xact_lock(hash do mês) para serializar execuções concorrentes
--    do mesmo mês e evitar duplicidade/corrupção nos totais.
CREATE OR REPLACE FUNCTION public.replace_caixas_batidas_month(
  p_mes_first_day date,
  p_rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_lock_key bigint;
BEGIN
  -- Trava por mês (escopo: transação) — execuções paralelas do mesmo mês ficam em fila.
  v_lock_key := hashtextextended('caixas_batidas:' || to_char(p_mes_first_day, 'YYYY-MM'), 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Limpa apenas os registros de caixas_batidas do mês informado
  DELETE FROM public.user_incentives_daily
   WHERE data_referencia = p_mes_first_day
     AND (detalhes_json->>'tipo') = 'caixas_batidas';

  -- Re-insere a partir do payload jsonb (lista de objetos)
  INSERT INTO public.user_incentives_daily (
    user_id, data_referencia, valor_estimado, status, detalhes_json
  )
  SELECT
    (r->>'user_id')::uuid,
    (r->>'data_referencia')::date,
    COALESCE((r->>'valor_estimado')::numeric, 0),
    COALESCE(r->>'status', 'estimado'),
    COALESCE(r->'detalhes_json', '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS r;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_caixas_batidas_month(date, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_caixas_batidas_month(date, jsonb) TO service_role;
