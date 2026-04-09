import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IndicatorBreakdown {
  indicator_id: string;
  indicator_nome: string;
  indicator_codigo: string;
  avg_pct: number;
  avg_valor: number;
  avg_meta: number;
  count: number;
  on_target: number;
}

export interface RankingEntry {
  user_id: string;
  nome: string;
  worker_type: string | null;
  unidade_nome: string | null;
  avatar_url: string | null;
  total_indicators: number;
  avg_atingimento: number;
  on_target_count: number;
  best_indicator: string | null;
  worst_indicator: string | null;
  indicators_breakdown: IndicatorBreakdown[];
  bonus_potencial: number;
  bonus_ganho: number;
}

export function useRanking(filters: { dataInicio: string; dataFim: string; unidade_id?: string; worker_type?: string }) {
  return useQuery({
    queryKey: ['ranking', filters],
    queryFn: async () => {
      // Fetch performance data
      let q = supabase
        .from('user_indicator_daily')
        .select('user_id, indicator_id, percentual_atingimento, status, valor, meta, indicators(nome, codigo), users(nome, worker_type, avatar_url, unidade_id, units(nome))')
        .gte('data_referencia', filters.dataInicio)
        .lte('data_referencia', filters.dataFim);

      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch active goals with bonificacao
      const { data: goalsData } = await supabase
        .from('goals')
        .select('indicator_id, worker_type, user_id, valor_bonificacao')
        .eq('ativo', true)
        .gt('valor_bonificacao', 0);

      const goals = goalsData ?? [];

      // Helper: find bonus for a given indicator + user
      function getBonus(indicatorId: string, userId: string, workerType: string | null): number {
        // Individual goal
        const individual = goals.find(g => g.indicator_id === indicatorId && g.user_id === userId);
        if (individual) return individual.valor_bonificacao;
        // Worker type goal
        const byType = goals.find(g => g.indicator_id === indicatorId && !g.user_id && g.worker_type === workerType);
        if (byType) return byType.valor_bonificacao;
        // General goal
        const general = goals.find(g => g.indicator_id === indicatorId && !g.user_id && !g.worker_type);
        if (general) return general.valor_bonificacao;
        return 0;
      }

      // Group by user
      const map = new Map<string, {
        nome: string; worker_type: string | null; unidade_id: string | null;
        unidade_nome: string | null; avatar_url: string | null;
        pcts: number[]; onTarget: number;
        bonusPotencial: number; bonusGanho: number;
        byIndicator: Map<string, { nome: string; codigo: string; pcts: number[]; valores: number[]; metas: number[]; onTarget: number }>;
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
            avatar_url: u.avatar_url,
            pcts: [],
            onTarget: 0,
            bonusPotencial: 0,
            bonusGanho: 0,
            byIndicator: new Map(),
          });
        }
        const entry = map.get(uid)!;
        const pct = row.percentual_atingimento ?? 0;
        entry.pcts.push(pct);
        const isOnTarget = row.status === 'acima_meta' || row.status === 'dentro_meta';
        if (isOnTarget) entry.onTarget++;

        const bonus = getBonus(row.indicator_id, uid, u.worker_type);
        entry.bonusPotencial += bonus;
        if (isOnTarget) entry.bonusGanho += bonus;

        // Track per-indicator
        const indId = row.indicator_id;
        const indNome = row.indicators?.nome ?? '—';
        const indCodigo = row.indicators?.codigo ?? '';
        if (!entry.byIndicator.has(indId)) {
          entry.byIndicator.set(indId, { nome: indNome, codigo: indCodigo, pcts: [], valores: [], metas: [], onTarget: 0 });
        }
        const indEntry = entry.byIndicator.get(indId)!;
        indEntry.pcts.push(pct);
        indEntry.valores.push(row.valor ?? 0);
        indEntry.metas.push(row.meta ?? 0);
        if (row.status === 'acima_meta' || row.status === 'dentro_meta') {
          indEntry.onTarget++;
        }
      }

      const result: RankingEntry[] = [];
      for (const [user_id, e] of map) {
        const avg = e.pcts.length > 0 ? e.pcts.reduce((a, b) => a + b, 0) / e.pcts.length : 0;

        const breakdown: IndicatorBreakdown[] = [];
        let bestPct = -1, worstPct = Infinity;
        let bestName: string | null = null, worstName: string | null = null;

        for (const [ind_id, ind] of e.byIndicator) {
          const indAvg = ind.pcts.reduce((a, b) => a + b, 0) / ind.pcts.length;
          const avgValor = ind.valores.reduce((a, b) => a + b, 0) / ind.valores.length;
          const avgMeta = ind.metas.reduce((a, b) => a + b, 0) / ind.metas.length;
          const onTarget = ind.onTarget;
          breakdown.push({ indicator_id: ind_id, indicator_nome: ind.nome, indicator_codigo: ind.codigo, avg_pct: Math.round(indAvg * 10) / 10, avg_valor: Math.round(avgValor * 10) / 10, avg_meta: Math.round(avgMeta * 10) / 10, count: ind.pcts.length, on_target: onTarget });
          if (indAvg > bestPct) { bestPct = indAvg; bestName = ind.nome; }
          if (indAvg < worstPct) { worstPct = indAvg; worstName = ind.nome; }
        }

        breakdown.sort((a, b) => b.avg_pct - a.avg_pct);

        result.push({
          user_id,
          nome: e.nome,
          worker_type: e.worker_type,
          unidade_nome: e.unidade_nome,
          avatar_url: e.avatar_url,
          total_indicators: e.pcts.length,
          avg_atingimento: Math.round(avg * 10) / 10,
          on_target_count: e.onTarget,
          best_indicator: bestName,
          worst_indicator: worstName,
          indicators_breakdown: breakdown,
          bonus_potencial: Math.round(e.bonusPotencial * 100) / 100,
          bonus_ganho: Math.round(e.bonusGanho * 100) / 100,
        });
      }

      result.sort((a, b) => {
        const ratioA = a.total_indicators > 0 ? a.on_target_count / a.total_indicators : 0;
        const ratioB = b.total_indicators > 0 ? b.on_target_count / b.total_indicators : 0;
        if (ratioB !== ratioA) return ratioB - ratioA;
        return b.on_target_count - a.on_target_count;
      });
      return result;
    },
  });
}
