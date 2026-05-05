import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardMetricsByIndicator {
  indicator_id: string;
  codigo: string;
  nome: string;
  total: number;
  atingidas: number;
  abaixo: number;
}

export interface DashboardMetrics {
  metas_atingidas: number;
  metas_total: number;
  abaixo_meta: number;
  desafios_total: number;
  desafios_atingidos: number;
  por_indicador: DashboardMetricsByIndicator[];
}

const EMPTY: DashboardMetrics = {
  metas_atingidas: 0,
  metas_total: 0,
  abaixo_meta: 0,
  desafios_total: 0,
  desafios_atingidos: 0,
  por_indicador: [],
};

export function useDashboardMetrics(
  inicio: string,
  fim: string,
  filters: { unidade_id?: string; worker_type?: string } = {},
) {
  return useQuery({
    queryKey: ['dashboard-metrics', inicio, fim, filters.unidade_id ?? '', filters.worker_type ?? ''],
    queryFn: async (): Promise<DashboardMetrics> => {
      const { data, error } = await supabase.rpc('dashboard_metrics', {
        p_inicio: inicio,
        p_fim: fim,
        p_unidade_id: filters.unidade_id ?? null,
        p_worker_type: filters.worker_type ?? null,
      });
      if (error) throw error;
      return ((data as unknown) as DashboardMetrics) ?? EMPTY;
    },
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
    enabled: Boolean(inicio && fim),
  });
}