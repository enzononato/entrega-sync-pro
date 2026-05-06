CREATE OR REPLACE FUNCTION public.distinct_mapa_historico_months(p_dates date[])
RETURNS TABLE(mes text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT to_char(data_operacao, 'YYYY-MM') AS mes
  FROM public.mapa_historico
  WHERE data_operacao = ANY(p_dates);
$$;

REVOKE ALL ON FUNCTION public.distinct_mapa_historico_months(date[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.distinct_mapa_historico_months(date[]) TO service_role;