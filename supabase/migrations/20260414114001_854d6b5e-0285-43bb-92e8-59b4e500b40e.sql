ALTER TABLE public.user_indicator_daily 
  DROP CONSTRAINT IF EXISTS user_indicator_daily_unique_entry,
  DROP CONSTRAINT IF EXISTS user_indicator_daily_user_id_indicator_id_data_referencia_key;

ALTER TABLE public.user_indicator_daily
  ADD CONSTRAINT user_indicator_daily_unique_entry 
  UNIQUE (user_id, indicator_id, data_referencia, mapa_numero);