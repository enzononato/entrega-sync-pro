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

const SUM_CODES = new Set(['TX_REPOSICAO']);

export function useRanking(filters: { dataInicio: string; dataFim: string; unidade_id?: string; worker_type?: string }) {
  return useQuery({
    queryKey: ['ranking', filters],
    queryFn: async () => {
      // Fetch ALL performance data with pagination
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;

      while (true) {
        const { data: page, error } = await supabase
          .from('user_indicator_daily')
          .select('user_id, indicator_id, percentual_atingimento, status, valor, meta, indicators(nome, codigo), users(nome, worker_type, avatar_url, unidade_id, units(nome))')
          .gte('data_referencia', filters.dataInicio)
          .lte('data_referencia', filters.dataFim)
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;
        allData = allData.concat(page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (allData.length === 0) return [];

      // Fetch active goals with bonus info
      const { data: goalsData } = await supabase
        .from('goals')
        .select('indicator_id, worker_type, user_id, valor_meta, valor_desafio, valor_bonificacao, valor_bonificacao_desafio, indicators(codigo)')
        .eq('ativo', true);

      const goals = goalsData ?? [];

      // Helper: find goal for a given indicator + user
      function findGoal(indicatorId: string, userId: string, workerType: string | null) {
        const individual = goals.find(g => g.indicator_id === indicatorId && g.user_id === userId);
        if (individual) return individual;
        const byType = goals.find(g => g.indicator_id === indicatorId && !g.user_id && g.worker_type === workerType);
        if (byType) return byType;
        const general = goals.find(g => g.indicator_id === indicatorId && !g.user_id && !g.worker_type);
        if (general) return general;
        return null;
      }

      // Group by user
      const map = new Map<string, {
        nome: string; worker_type: string | null; unidade_id: string | null;
        unidade_nome: string | null; avatar_url: string | null;
        byIndicator: Map<string, { nome: string; codigo: string; sum: number; count: number; valores: number[]; metas: number[]; pcts: number[] }>;
      }>();

      for (const row of allData as any[]) {
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
            byIndicator: new Map(),
          });
        }
        const entry = map.get(uid)!;
        const indId = row.indicator_id;
        const indNome = row.indicators?.nome ?? '—';
        const indCodigo = row.indicators?.codigo ?? '';

        if (!entry.byIndicator.has(indId)) {
          entry.byIndicator.set(indId, { nome: indNome, codigo: indCodigo, sum: 0, count: 0, valores: [], metas: [], pcts: [] });
        }
        const ind = entry.byIndicator.get(indId)!;
        ind.sum += (row.valor ?? 0);
        ind.count++;
        ind.valores.push(row.valor ?? 0);
        ind.metas.push(row.meta ?? 0);
        ind.pcts.push(row.percentual_atingimento ?? 0);
      }

      // Second pass: compute bonus and onTarget from aggregated data
      const result: RankingEntry[] = [];
      for (const [user_id, e] of map) {
        let bonusPotencial = 0;
        let bonusGanho = 0;
        let onTargetCount = 0;
        let totalIndicators = 0;
        const breakdown: IndicatorBreakdown[] = [];
        let bestPct = -1, worstPct = Infinity;
        let bestName: string | null = null, worstName: string | null = null;
        const allPcts: number[] = [];

        for (const [ind_id, ind] of e.byIndicator) {
          totalIndicators += ind.count;
          const indAvgPct = ind.pcts.reduce((a, b) => a + b, 0) / ind.pcts.length;
          const avgValor = ind.valores.reduce((a, b) => a + b, 0) / ind.valores.length;
          const avgMeta = ind.metas.reduce((a, b) => a + b, 0) / ind.metas.length;
          allPcts.push(...ind.pcts);

          // Monthly aggregate for bonus: sum for TX_REPOSICAO, average for others
          const valorAgregado = SUM_CODES.has(ind.codigo) ? ind.sum : ind.sum / ind.count;

          // Find goal to determine target
          const goal = findGoal(ind_id, user_id, e.worker_type);
          let indOnTarget = 0;

          if (goal) {
            const metaVal = Number(goal.valor_meta);
            const bonif = Number(goal.valor_bonificacao);
            const desafioVal = Number(goal.valor_desafio);
            const bonifDesafio = Number(goal.valor_bonificacao_desafio);

            if (bonif > 0 || bonifDesafio > 0) {
              bonusPotencial += bonif + (desafioVal > 0 ? bonifDesafio : 0);
            }

            if (metaVal > 0 && valorAgregado <= metaVal) {
              indOnTarget = 1;
              if (bonif > 0) bonusGanho += bonif;
              if (desafioVal > 0 && valorAgregado <= desafioVal && bonifDesafio > 0) {
                bonusGanho += bonifDesafio;
              }
            }
          }

          onTargetCount += indOnTarget;

          breakdown.push({
            indicator_id: ind_id,
            indicator_nome: ind.nome,
            indicator_codigo: ind.codigo,
            avg_pct: Math.round(indAvgPct * 10) / 10,
            avg_valor: Math.round(avgValor * 10) / 10,
            avg_meta: Math.round(avgMeta * 10) / 10,
            count: ind.count,
            on_target: indOnTarget,
          });

          if (indAvgPct > bestPct) { bestPct = indAvgPct; bestName = ind.nome; }
          if (indAvgPct < worstPct) { worstPct = indAvgPct; worstName = ind.nome; }
        }

        breakdown.sort((a, b) => b.avg_pct - a.avg_pct);
        const avg = allPcts.length > 0 ? allPcts.reduce((a, b) => a + b, 0) / allPcts.length : 0;

        result.push({
          user_id,
          nome: e.nome,
          worker_type: e.worker_type,
          unidade_nome: e.unidade_nome,
          avatar_url: e.avatar_url,
          total_indicators: e.byIndicator.size,
          avg_atingimento: Math.round(avg * 10) / 10,
          on_target_count: onTargetCount,
          best_indicator: bestName,
          worst_indicator: worstName,
          indicators_breakdown: breakdown,
          bonus_potencial: Math.round(bonusPotencial * 100) / 100,
          bonus_ganho: Math.round(bonusGanho * 100) / 100,
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
