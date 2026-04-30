
INSERT INTO public.user_indicator_daily (
  user_id, indicator_id, data_referencia, valor, meta, desafio,
  percentual_atingimento, status, status_desafio, origem_dado, mapa_numero
)
SELECT
  ra.user_id,
  '853beb35-febb-48b9-b3ae-be7173bfc6fc'::uuid,
  ra.data_referencia_inicio,
  ra.rating,
  4.95,
  5.00,
  (ra.rating / 4.95) * 100,
  CASE WHEN ra.rating >= 4.95 THEN 'dentro_meta' ELSE 'abaixo_meta' END,
  CASE WHEN ra.rating >= 5.00 THEN 'atingiu' ELSE 'nao_atingiu' END,
  'import_rating',
  'MENSAL'
FROM public.rating_avaliacoes ra
WHERE ra.user_id IS NOT NULL
ON CONFLICT (user_id, indicator_id, data_referencia, mapa_numero) DO UPDATE SET
  valor = EXCLUDED.valor,
  meta = EXCLUDED.meta,
  desafio = EXCLUDED.desafio,
  percentual_atingimento = EXCLUDED.percentual_atingimento,
  status = EXCLUDED.status,
  status_desafio = EXCLUDED.status_desafio,
  updated_at = now();
