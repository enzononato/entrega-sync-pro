ALTER TABLE public.mapa_historico
  ADD CONSTRAINT mapa_historico_mapa_data_unique UNIQUE (mapa, data_operacao);