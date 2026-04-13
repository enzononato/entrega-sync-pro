-- Limpar todos os dados das tabelas dependentes do histórico de mapas antigo
TRUNCATE TABLE public.mapa_historico;
TRUNCATE TABLE public.user_indicator_daily;
TRUNCATE TABLE public.user_incentives_daily;
TRUNCATE TABLE public.incentive_deductions;