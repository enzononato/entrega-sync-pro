-- Remove duplicate bonus_mensal/caixas_batidas rows, keeping the most recent per (user_id, data_referencia, tipo)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, data_referencia, (detalhes_json->>'tipo')
           ORDER BY created_at DESC
         ) AS rn
  FROM public.user_incentives_daily
)
DELETE FROM public.user_incentives_daily
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Unique index covering monthly aggregation rows (uses tipo from JSON to avoid conflict with daily incentives)
CREATE UNIQUE INDEX IF NOT EXISTS user_incentives_daily_user_date_tipo_uniq
  ON public.user_incentives_daily (user_id, data_referencia, ((detalhes_json->>'tipo')));