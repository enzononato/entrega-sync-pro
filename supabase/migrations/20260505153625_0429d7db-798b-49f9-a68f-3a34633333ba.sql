CREATE INDEX IF NOT EXISTS idx_uid_data_referencia
  ON public.user_indicator_daily (data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_uid_user_data
  ON public.user_indicator_daily (user_id, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_uid_indicator_data
  ON public.user_indicator_daily (indicator_id, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_uid_status_data
  ON public.user_indicator_daily (status, data_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_users_unidade_worker_active
  ON public.users (unidade_id, worker_type) WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_user_incentives_data
  ON public.user_incentives_daily (data_referencia, user_id);

CREATE INDEX IF NOT EXISTS idx_mapa_historico_data
  ON public.mapa_historico (data_operacao DESC);