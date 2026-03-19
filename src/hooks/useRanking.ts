import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RankingEntry {
  user_id: string;
  nome: string;
  worker_type: string | null;
  unidade_nome: string | null;
  avatar_url: string | null;
  total_indicators: number;
  avg_atingimento: number;
  on_target_count: number;
}

export function useRanking(filters: { dataInicio: string; dataFim: string; unidade_id?: string; worker_type?: string }) {
  return useQuery({
    queryKey: ['ranking', filters],
    queryFn: async () => {
      // Get performance data in the period
      let q = supabase
        .from('user_indicator_daily')
        .select('user_id, percentual_atingimento, status, users(nome, worker_type, avatar_url, unidade_id, units(nome), routes(nome))')
        .gte('data_referencia', filters.dataInicio)
        .lte('data_referencia', filters.dataFim);

      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Group by user
      const map = new Map<string, {
        nome: string; worker_type: string | null; unidade_id: string | null;
        unidade_nome: string | null; rota_nome: string | null; avatar_url: string | null;
        pcts: number[]; onTarget: number;
      }>();

      for (const row of data as any[]) {
        const uid = row.user_id;
        const u = row.users;
        if (!u) continue;

        if (filters.unidade_id && u.unidade_id !== filters.unidade_id) continue;
        if (filters.worker_type && u.worker_type !== filters.worker_type) continue;

        if (!map.has(uid)) {
          map.set(uid, {
            nome: u.nome,
            worker_type: u.worker_type,
            unidade_id: u.unidade_id,
            unidade_nome: u.units?.nome ?? null,
            rota_nome: u.routes?.nome ?? null,
            avatar_url: u.avatar_url,
            pcts: [],
            onTarget: 0,
          });
        }
        const entry = map.get(uid)!;
        const pct = row.percentual_atingimento ?? 0;
        entry.pcts.push(pct);
        if (row.status === 'acima_meta' || row.status === 'dentro_meta') {
          entry.onTarget++;
        }
      }

      // Convert to array and sort by avg atingimento
      const result: RankingEntry[] = [];
      for (const [user_id, e] of map) {
        const avg = e.pcts.length > 0 ? e.pcts.reduce((a, b) => a + b, 0) / e.pcts.length : 0;
        result.push({
          user_id,
          nome: e.nome,
          worker_type: e.worker_type,
          unidade_nome: e.unidade_nome,
          rota_nome: e.rota_nome,
          avatar_url: e.avatar_url,
          total_indicators: e.pcts.length,
          avg_atingimento: Math.round(avg * 10) / 10,
          on_target_count: e.onTarget,
        });
      }

      result.sort((a, b) => b.avg_atingimento - a.avg_atingimento);
      return result;
    },
  });
}
