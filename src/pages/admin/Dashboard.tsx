import { useState, useMemo, useEffect, useRef } from 'react';
import { format, formatDistanceToNow, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useFeedbacks } from '@/hooks/useFeedbacks';
import { usePlanosDeAcao } from '@/hooks/usePlanosDeAcao';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { useAllowedUnits } from '@/hooks/useAllowedUnits';
import { useMetas } from '@/hooks/useMetas';
import { useCaixasBatidasAdminMes } from '@/hooks/useCaixasBatidas';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { DateRangePick } from '@/components/shared/DateRangePick';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Users, MessageSquare, ClipboardList, DollarSign, TrendingUp,
  TrendingDown, AlertTriangle, ChevronRight, Target, BarChart3, Truck,
  UserCheck, Zap, Clock, ArrowUpRight, MapPin, Package, Trophy, Flame, Loader2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

const PIE_COLORS: Record<string, string> = {
  baixa: '#94a3b8', media: '#fbbf24', alta: '#f97316', critica: '#ef4444',
};
const PIE_LABELS: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Indicator UUIDs (must match supabase/functions/calculate-monthly-bonus/index.ts)
const INDICATOR_IDS = {
  TML: '11496dac-52b6-4331-80f0-f9687e9fd1b7',
  TR: 'd99beda1-c397-42f1-84e0-4eb60ae7af99',
  TI: '27fff464-bc98-4e5f-864d-b3b2b6aad46e',
  JL: 'e1393945-535e-4506-8ef7-e8c28e4788b6',
  TX_DEVOLUCAO: 'c4fdd7a6-27f3-4d46-a378-1242bdb556aa',
  DISP_TEMPO: '488d1de9-9d88-42f2-bf3b-625752c0db02',
  TX_REPOSICAO: 'c4c40e3e-f23b-46ce-a576-885c610f2df7',
  REFUGO: 'f5ded347-5b60-4b87-a2bb-d4d79d4f8e2a',
} as const;
const SUM_INDICATORS = new Set<string>([INDICATOR_IDS.TX_REPOSICAO]);

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [unidadeFilter, setUnidadeFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [bonusDetailOpen, setBonusDetailOpen] = useState(false);

  const { data: usuarios = [] } = useUsuarios();
  const { data: feedbacks = [] } = useFeedbacks({ unidade_id: unidadeFilter || undefined });
  const { data: planos = [] } = usePlanosDeAcao();
  const { data: desempenho = [] } = useDesempenhoDiario(dateFrom, dateTo, {
    unidade_id: unidadeFilter || undefined,
    worker_type: tipoFilter || undefined,
  });
  const { allowedUnits, allowedUnitIds } = useAllowedUnits();
  const { data: metasAtivas = [] } = useMetas({ ativo: 'true' });

  const mesAtual = format(new Date(), 'yyyy-MM');
  const mesInicio = mesAtual + '-01';
  const mesFim = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  // Bônus Estimado do mês atual: independe dos filtros do topo (unidade/perfil)
  const { data: desempenhoMes = [] } = useDesempenhoDiario(mesInicio, mesFim);
  const { data: caixasBatidasMes = [] } = useCaixasBatidasAdminMes(mesAtual);

  // Bônus mensal pré-calculado pela edge function `calculate-monthly-bonus`.
  // Evita recalcular 6k+ linhas no cliente; lê apenas ~100 linhas agregadas.
  type BonusMensalRow = {
    user_id: string;
    valor_estimado: number;
    created_at: string;
    detalhes_json: {
      tipo: string;
      mes: string;
      indicadores: {
        indicator_id: string;
        valor_agregado: number;
        meta: number;
        atingiu: boolean;
        bonus: number;
        desafio: number;
        atingiu_desafio: boolean;
        bonus_desafio: number;
      }[];
    };
  };
  const { data: bonusMensalRows = [], isFetching: isFetchingBonus, refetch: refetchBonusMensal } = useQuery({
    queryKey: ['bonus-mensal', mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_incentives_daily')
        .select('user_id, valor_estimado, created_at, detalhes_json')
        .eq('data_referencia', mesInicio);
      if (error) throw error;
      return ((data ?? []) as unknown as BonusMensalRow[])
        .filter(r => r.detalhes_json?.tipo === 'bonus_mensal');
    },
    staleTime: 5 * 60_000,
  });

  // Auto-refresh: se o último cálculo for mais antigo que 15 min, dispara em background.
  const autoRefreshFiredRef = useRef(false);
  useEffect(() => {
    if (autoRefreshFiredRef.current) return;
    if (isFetchingBonus) return;
    const latest = bonusMensalRows.reduce<number>((acc, r) => {
      const t = new Date(r.created_at).getTime();
      return t > acc ? t : acc;
    }, 0);
    const ageMs = latest > 0 ? Date.now() - latest : Infinity;
    if (ageMs > 15 * 60_000) {
      autoRefreshFiredRef.current = true;
      supabase.functions
        .invoke('calculate-monthly-bonus', { body: { month: mesAtual } })
        .then(() => refetchBonusMensal())
        .catch(() => { /* silencioso: card mostra valor atual */ });
    }
  }, [bonusMensalRows, isFetchingBonus, mesAtual, refetchBonusMensal]);

  // ALL active collaborators system-wide (independente de unidade visível ao admin)
  const { data: allCollaborators = [] } = useQuery({
    queryKey: ['all-active-collaborators-bonus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, worker_type, ativo, role')
        .eq('ativo', true)
        .eq('role', 'colaborador')
        .not('worker_type', 'is', null);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const bonusMesData = useMemo(() => {
    const goalsComBonus = metasAtivas.filter(m => m.valor_bonificacao > 0);
    type Breakdown = {
      indicator_id: string;
      codigo: string;
      nome: string;
      total: number;
      beneficiarios: number;
      bonusUnit: number;
      bonusDesafio: number;
      desafiosAtingidos: number;
    };
    const empty = { total: 0, breakdown: [] as Breakdown[] };

    // ── Caminho rápido: usa o que a edge function já calculou (user_incentives_daily) ──
    if (bonusMensalRows.length > 0) {
      const indMeta = new Map<string, { codigo: string; nome: string }>();
      for (const g of goalsComBonus) {
        if (g.indicator_id && g.indicators) {
          indMeta.set(g.indicator_id, {
            codigo: g.indicators.codigo ?? '—',
            nome: g.indicators.nome ?? g.indicator_id,
          });
        }
      }
      const breakdownMap = new Map<string, Breakdown>();
      let total = 0;
      for (const row of bonusMensalRows) {
        total += Number(row.valor_estimado) || 0;
        for (const det of row.detalhes_json?.indicadores ?? []) {
          if (!det.atingiu) continue;
          const meta = indMeta.get(det.indicator_id);
          let br = breakdownMap.get(det.indicator_id);
          if (!br) {
            br = {
              indicator_id: det.indicator_id,
              codigo: meta?.codigo ?? '—',
              nome: meta?.nome ?? det.indicator_id,
              total: 0,
              beneficiarios: 0,
              bonusUnit: Number(det.bonus) || 0,
              bonusDesafio: Number(det.bonus_desafio) || 0,
              desafiosAtingidos: 0,
            };
            breakdownMap.set(det.indicator_id, br);
          }
          br.total += (Number(det.bonus) || 0) + (Number(det.bonus_desafio) || 0);
          br.beneficiarios += 1;
          if (det.atingiu_desafio) br.desafiosAtingidos += 1;
        }
      }
      const breakdown = [...breakdownMap.values()].sort((a, b) => b.total - a.total);
      return { total: Math.round(total * 100) / 100, breakdown };
    }

    // ── Fallback: recalcula no cliente quando ainda não há dado pré-agregado ──
    if (goalsComBonus.length === 0 || desempenhoMes.length === 0) return empty;

    // Mirror logic from supabase/functions/calculate-monthly-bonus/index.ts
    // 1) ALL active collaborators system-wide (não usar `usuarios` que pode estar filtrado por unidade)
    const activeCollaborators = allCollaborators;
    if (activeCollaborators.length === 0) return empty;

    // 2) Goal lookup respeitando applies_to_worker_type do indicador.
    //    Regra: meta com worker_type específico só vale para esse worker_type.
    //    Meta com worker_type=null só vale como universal SE indicator.applies_to_worker_type='ambos'.
    //    Em qualquer caso, o indicador também precisa aplicar-se ao worker_type do colaborador.
    const findGoal = (indicatorId: string, workerType: string) => {
      // Aceita applies_to_worker_type como 'ambos', um único worker_type, ou
      // lista separada por vírgula (defesa contra dados sujos no banco).
      const matchesApplies = (applies: string | undefined | null) => {
        const a = (applies ?? 'ambos').toLowerCase();
        if (a === 'ambos') return true;
        return a.split(',').map(s => s.trim()).includes(workerType);
      };
      // Procura match exato por worker_type
      const exact = goalsComBonus.find(
        g => g.indicator_id === indicatorId && g.worker_type === workerType,
      );
      if (exact) {
        if (!matchesApplies(exact.indicators?.applies_to_worker_type)) return undefined;
        return exact;
      }
      // Fallback universal: meta com worker_type=null vale para qualquer perfil
      // que esteja contemplado pelo applies_to_worker_type do indicador.
      const universal = goalsComBonus.find(
        g => g.indicator_id === indicatorId && g.worker_type === null,
      );
      if (universal) {
        if (!matchesApplies(universal.indicators?.applies_to_worker_type)) return undefined;
        return universal;
      }
      return undefined;
    };

    const goalIndicatorIds = [...new Set(goalsComBonus.map(g => g.indicator_id))];

    // 3) Aggregate: for SUM indicators -> total sum; otherwise -> average of daily averages
    const dailyMap = new Map<string, Map<string, { sum: number; count: number }>>();
    const sumMap = new Map<string, number>();
    for (const d of desempenhoMes) {
      if (!goalIndicatorIds.includes(d.indicator_id)) continue;
      const key = `${d.user_id}|${d.indicator_id}`;
      const val = Number(d.valor) || 0;
      if (SUM_INDICATORS.has(d.indicator_id)) {
        sumMap.set(key, (sumMap.get(key) || 0) + val);
      } else {
        let dayMap = dailyMap.get(key);
        if (!dayMap) {
          dayMap = new Map();
          dailyMap.set(key, dayMap);
        }
        const dayEntry = dayMap.get(d.data_referencia);
        if (dayEntry) {
          dayEntry.sum += val;
          dayEntry.count += 1;
        } else {
          dayMap.set(d.data_referencia, { sum: val, count: 1 });
        }
      }
    }

    // 4) Iterate over ALL active collaborators and compute bonus
    let total = 0;
    const breakdownMap = new Map<string, Breakdown>();
    const ensureRow = (indId: string, goal: typeof goalsComBonus[number]): Breakdown => {
      let row = breakdownMap.get(indId);
      if (!row) {
        row = {
          indicator_id: indId,
          codigo: goal.indicators?.codigo ?? '—',
          nome: goal.indicators?.nome ?? indId,
          total: 0,
          beneficiarios: 0,
          bonusUnit: Number(goal.valor_bonificacao) || 0,
          bonusDesafio: Number(goal.valor_bonificacao_desafio) || 0,
          desafiosAtingidos: 0,
        };
        breakdownMap.set(indId, row);
      }
      return row;
    };
    for (const user of activeCollaborators) {
      for (const indId of goalIndicatorIds) {
        const goal = findGoal(indId, user.worker_type!);
        if (!goal || Number(goal.valor_bonificacao) <= 0) continue;

        const key = `${user.id}|${indId}`;
        let valorAgregado: number | null = null;

        if (SUM_INDICATORS.has(indId)) {
          if (sumMap.has(key)) {
            valorAgregado = Math.round((sumMap.get(key) || 0) * 100) / 100;
          }
        } else {
          const dayMap = dailyMap.get(key);
          if (dayMap && dayMap.size > 0) {
            let sumOfDailyAvgs = 0;
            for (const [, day] of dayMap) sumOfDailyAvgs += day.sum / day.count;
            valorAgregado = Math.round((sumOfDailyAvgs / dayMap.size) * 100) / 100;
          }
        }

        if (valorAgregado === null) continue;

        const metaVal = Number(goal.valor_meta);
        const atingiu = valorAgregado <= metaVal;
        if (!atingiu) continue;

        const row = ensureRow(indId, goal);
        const bMeta = Number(goal.valor_bonificacao);
        total += bMeta;
        row.total += bMeta;
        row.beneficiarios += 1;
        const desafioVal = Number(goal.valor_desafio) || 0;
        if (desafioVal > 0 && valorAgregado <= desafioVal) {
          const bDes = Number(goal.valor_bonificacao_desafio) || 0;
          total += bDes;
          row.total += bDes;
          row.desafiosAtingidos += 1;
        }
      }
    }
    const breakdown = [...breakdownMap.values()].sort((a, b) => b.total - a.total);
    return { total, breakdown };
  }, [metasAtivas, desempenhoMes, allCollaborators, bonusMensalRows]);

  const bonusMes = bonusMesData.total;

  // Caixas Batidas: soma de todos os colaboradores no mês (já com teto aplicado)
  const caixasBatidasTotal = useMemo(
    () => caixasBatidasMes.reduce((s, c) => s + Number(c.valor_final || 0), 0),
    [caixasBatidasMes],
  );

  // Total geral estimado para pagamento aos colaboradores no mês
  const bonusTotalMes = bonusMes + caixasBatidasTotal;

  // Desafio stats (período filtrado): % das metas atingidas que também atingiram desafio
  const desafioStats = useMemo(() => {
    const withDesafio = desempenho.filter(d => d.desafio != null && Number(d.desafio) > 0);
    const metasAtingidas = withDesafio.filter(d => d.status === 'dentro_meta' || d.status === 'acima_meta');
    const desafiosAtingidos = metasAtingidas.filter(d => d.status_desafio === 'atingiu');
    const percentual = metasAtingidas.length > 0 ? Math.round((desafiosAtingidos.length / metasAtingidas.length) * 100) : 0;

    return {
      totalComDesafio: withDesafio.length,
      metasAtingidas: metasAtingidas.length,
      desafiosAtingidos: desafiosAtingidos.length,
      percentual,
    };
  }, [desempenho]);

  const filteredUsers = useMemo(() => {
    let list = usuarios.filter(u => u.ativo && u.role === 'colaborador');
    list = list.filter(u => !u.unidade_id || allowedUnitIds.has(u.unidade_id));
    if (unidadeFilter) list = list.filter(u => u.unidade_id === unidadeFilter);
    if (tipoFilter) list = list.filter(u => u.worker_type === tipoFilter);
    return list;
  }, [usuarios, unidadeFilter, tipoFilter, allowedUnitIds]);

  const filteredUserIds = useMemo(() => new Set(filteredUsers.map(u => u.id)), [filteredUsers]);
  const filteredDesempenho = desempenho;

  const filteredFeedbacks = feedbacks;
  const filteredPlanos = useMemo(() => {
    if (!unidadeFilter) return planos;
    return planos.filter(p => filteredUserIds.has(p.responsavel_user_id));
  }, [planos, unidadeFilter, filteredUserIds]);

  // Desafios mensais agregados: % das metas atingidas que também atingiram desafio
  const desafioStatsMes = useMemo(() => {
    const monthlyGoals = metasAtivas.filter(
      m => m.periodo_tipo === 'mensal' && Number(m.valor_desafio) > 0,
    );

    if (monthlyGoals.length === 0 || desempenhoMes.length === 0 || filteredUsers.length === 0) {
      return { total: 0, metasAtingidas: 0, desafiosAtingidos: 0, bonus: 0, percentual: 0 };
    }

    const TX_REPOSICAO_ID = 'c4c40e3e-f23b-46ce-a576-885c610f2df7';
    const dailyMap = new Map<string, Map<string, { sum: number; count: number }>>();
    const sumMap = new Map<string, number>();

    for (const row of desempenhoMes) {
      const key = `${row.user_id}|${row.indicator_id}`;
      const val = Number(row.valor) || 0;

      if (row.indicator_id === TX_REPOSICAO_ID) {
        sumMap.set(key, (sumMap.get(key) || 0) + val);
      } else {
        let byDay = dailyMap.get(key);
        if (!byDay) {
          byDay = new Map();
          dailyMap.set(key, byDay);
        }
        const dayKey = row.data_referencia;
        const entry = byDay.get(dayKey);
        if (entry) {
          entry.sum += val;
          entry.count += 1;
        } else {
          byDay.set(dayKey, { sum: val, count: 1 });
        }
      }
    }

    const matchesGoal = (goal: typeof monthlyGoals[number], worker: typeof filteredUsers[number]) => {
      if (goal.user_id && goal.user_id !== worker.id) return false;
      if (goal.worker_type && goal.worker_type !== worker.worker_type) return false;
      if (goal.unidade_id && goal.unidade_id !== worker.unidade_id) return false;
      return true;
    };

    const getBestGoal = (indicatorId: string, worker: typeof filteredUsers[number]) => {
      const candidates = monthlyGoals
        .filter(goal => goal.indicator_id === indicatorId && matchesGoal(goal, worker))
        .sort((a, b) => {
          const score = (goal: typeof monthlyGoals[number]) =>
            (goal.user_id ? 4 : 0) + (goal.unidade_id ? 2 : 0) + (goal.worker_type ? 1 : 0);
          return score(b) - score(a);
        });
      return candidates[0];
    };

    const indicatorIds = [...new Set(monthlyGoals.map(goal => goal.indicator_id))];
    let total = 0;
    let metasAtingidas = 0;
    let desafiosAtingidos = 0;
    let bonus = 0;

    for (const worker of filteredUsers) {
      for (const indicatorId of indicatorIds) {
        const goal = getBestGoal(indicatorId, worker);
        if (!goal) continue;

        const key = `${worker.id}|${indicatorId}`;
        let valorAgregado: number | null = null;

        if (indicatorId === TX_REPOSICAO_ID) {
          if (sumMap.has(key)) valorAgregado = Math.round((sumMap.get(key) || 0) * 100) / 100;
        } else {
          const byDay = dailyMap.get(key);
          if (byDay && byDay.size > 0) {
            let sumOfDailyAvgs = 0;
            for (const [, day] of byDay) sumOfDailyAvgs += day.sum / day.count;
            valorAgregado = Math.round((sumOfDailyAvgs / byDay.size) * 100) / 100;
          }
        }

        if (valorAgregado === null) continue;

        total += 1;
        const atingiuMeta = valorAgregado <= Number(goal.valor_meta);
        const atingiuDesafio = atingiuMeta && valorAgregado <= Number(goal.valor_desafio);

        if (atingiuMeta) metasAtingidas += 1;
        if (atingiuDesafio) {
          desafiosAtingidos += 1;
          bonus += Number(goal.valor_bonificacao_desafio) || 0;
        }
      }
    }

    const percentual = metasAtingidas > 0 ? Math.round((desafiosAtingidos / metasAtingidas) * 100) : 0;

    return { total, metasAtingidas, desafiosAtingidos, bonus, percentual };
  }, [metasAtivas, desempenhoMes, filteredUsers]);

  const motoristas = filteredUsers.filter(u => u.worker_type === 'motorista').length;
  const ajudantes = filteredUsers.filter(u => u.worker_type === 'ajudante').length;

  const feedbacksAbertos = filteredFeedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).length;
  const feedbacksCriticos = filteredFeedbacks.filter(f => f.urgencia === 'critica' && ['aberto', 'em_analise'].includes(f.status)).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const planosPendentes = filteredPlanos.filter(p => ['aberto', 'em_andamento'].includes(p.status)).length;
  const planosAtrasados = filteredPlanos.filter(p => p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status)).length;

  const dentroMeta = filteredDesempenho.filter(d => d.status === 'dentro_meta' || d.status === 'acima_meta').length;
  const abaixoMeta = filteredDesempenho.filter(d => d.status === 'abaixo_meta').length;
  const totalMetasDash = dentroMeta + abaixoMeta;
  const pctAtingidas = totalMetasDash > 0 ? Math.round((dentroMeta / totalMetasDash) * 100) : 0;

  const barData = useMemo(() => {
    const byInd: Record<string, { codigo: string; nome: string; total: number; atingiu: number }> = {};
    filteredDesempenho.forEach(d => {
      if (!byInd[d.indicator_id]) byInd[d.indicator_id] = { codigo: d.indicators?.codigo ?? '', nome: d.indicators?.nome ?? '', total: 0, atingiu: 0 };
      byInd[d.indicator_id].total++;
      if (d.status === 'dentro_meta' || d.status === 'acima_meta') byInd[d.indicator_id].atingiu++;
    });
    return Object.values(byInd).map(v => ({
      indicador: v.codigo, nome: v.nome,
      media: v.total > 0 ? Math.round((v.atingiu / v.total) * 100) : 0,
    })).sort((a, b) => a.media - b.media);
  }, [filteredDesempenho]);

  const pieData = useMemo(() => {
    const byUrg: Record<string, number> = { baixa: 0, media: 0, alta: 0, critica: 0 };
    filteredFeedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).forEach(f => { byUrg[f.urgencia] = (byUrg[f.urgencia] ?? 0) + 1; });
    return Object.entries(byUrg).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, label: PIE_LABELS[k] ?? k, value: v }));
  }, [filteredFeedbacks]);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const topCritical = useMemo(() => {
    const byInd: Record<string, { nome: string; codigo: string; total: number; falhas: number }> = {};
    filteredDesempenho.forEach(d => {
      if (!byInd[d.indicator_id]) byInd[d.indicator_id] = { nome: d.indicators?.nome ?? '', codigo: d.indicators?.codigo ?? '', total: 0, falhas: 0 };
      byInd[d.indicator_id].total++;
      if (d.status === 'abaixo_meta') byInd[d.indicator_id].falhas++;
    });
    return Object.values(byInd)
      .map(v => ({ nome: v.nome, codigo: v.codigo, media: v.total > 0 ? Math.round((1 - v.falhas / v.total) * 100) : 100, gap: v.total > 0 ? -Math.round((v.falhas / v.total) * 100) : 0, afetados: v.total }))
      .filter(v => v.gap < 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 5);
  }, [filteredDesempenho]);

  const recentFeedbacks = useMemo(() =>
    filteredFeedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).slice(0, 5),
  [filteredFeedbacks]);

  const latePlans = useMemo(() =>
    filteredPlanos
      .filter(p => p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status))
      .map(p => ({ ...p, diasAtraso: Math.ceil((Date.now() - new Date(p.prazo + 'T00:00:00').getTime()) / 86400000) }))
      .sort((a, b) => b.diasAtraso - a.diasAtraso)
      .slice(0, 5),
  [filteredPlanos, todayStr]);

  const getBarColor = (media: number) => {
    if (media >= 100) return 'hsl(var(--success))';
    if (media >= 90) return 'hsl(var(--primary))';
    return 'hsl(var(--destructive))';
  };

  const firstName = user?.nome?.split(' ')[0] ?? 'Admin';
  const desafioPct = desafioStats.percentual;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* ── Hero Header ──────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden gradient-hero shadow-xl">
        <div className="p-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs text-white/50 uppercase tracking-[0.2em] font-semibold mb-1">Painel Administrativo</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                {getGreeting()}, {firstName}
              </h1>
              <p className="text-sm text-white/60 mt-1">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DateRangePick from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} className="w-full sm:w-56" />
              <Select value={unidadeFilter} onValueChange={v => setUnidadeFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-full sm:w-44 h-9 text-xs bg-white/10 border-white/20 text-white"><SelectValue placeholder="Unidade" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todas</SelectItem>{allowedUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={v => setTipoFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-full sm:w-36 h-9 text-xs bg-white/10 border-white/20 text-white"><SelectValue placeholder="Perfil" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="ajudante">Ajudante</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Hero stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/10 bg-white/[0.06] backdrop-blur-sm">
          <HeroStat icon={<Users className="h-4 w-4" />} value={filteredUsers.length} label="Colaboradores" sub={`${motoristas} mot · ${ajudantes} aj`} />
          <HeroStat icon={<Target className="h-4 w-4" />} value={`${pctAtingidas}%`} label="Metas Atingidas" sub={`${dentroMeta} de ${totalMetasDash}`} />
          <HeroStat
            icon={<DollarSign className="h-4 w-4" />}
            value={fmtBRL(bonusTotalMes)}
            label={`Bônus Estimado · ${format(new Date(), 'MMMM', { locale: ptBR })}`}
            sub={`Metas ${fmtBRL(bonusMes)} + Cx. Batidas ${fmtBRL(caixasBatidasTotal)}`}
            isSmall
            onClick={() => setBonusDetailOpen(true)}
            loading={isFetchingBonus}
          />
          <HeroStat icon={<Trophy className="h-4 w-4" />} value={`${desafioStatsMes.percentual}%`} label="Desafio nas Metas" sub={desafioStatsMes.metasAtingidas > 0 ? `${desafioStatsMes.desafiosAtingidos}/${desafioStatsMes.metasAtingidas} metas` : 'Sem base no mês'} />
        </div>
      </div>

      {/* Active filters */}
      {(unidadeFilter || tipoFilter || dateFrom !== today || dateTo !== today) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Filtros:</span>
          {unidadeFilter && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{allowedUnits.find(u => u.id === unidadeFilter)?.nome}</span>}
          {tipoFilter && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">{tipoFilter}</span>}
          {(dateFrom !== today || dateTo !== today) && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{format(new Date(dateFrom + 'T00:00:00'), 'dd/MM')} — {format(new Date(dateTo + 'T00:00:00'), 'dd/MM/yyyy')}</span>}
          <button onClick={() => { setUnidadeFilter(''); setTipoFilter(''); setDateFrom(today); setDateTo(today); }} className="text-destructive hover:underline ml-1">Limpar</button>
        </div>
      )}

      {/* ── Quick Action Cards ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickCard
          onClick={() => navigate('/admin/desempenho')}
          icon={<Target className="h-5 w-5" />}
          iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          value={`${dentroMeta}/${totalMetasDash}`}
          label="Metas Atingidas"
          accent={pctAtingidas >= 80 ? 'border-l-emerald-500' : 'border-l-destructive'}
          badge={pctAtingidas >= 100 ? <Flame className="h-3.5 w-3.5 text-amber-500" /> : undefined}
        />
        <QuickCard
          onClick={() => navigate('/admin/feedbacks')}
          icon={<MessageSquare className="h-5 w-5" />}
          iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          value={feedbacksAbertos}
          label="Feedbacks Abertos"
          accent="border-l-amber-500"
          badge={feedbacksCriticos > 0 ? <span className="text-[9px] font-bold text-destructive bg-destructive/10 rounded-full px-1.5 py-0.5">⚠ {feedbacksCriticos}</span> : undefined}
        />
        <QuickCard
          onClick={() => navigate('/admin/planos-de-acao')}
          icon={<ClipboardList className="h-5 w-5" />}
          iconClass="bg-primary/10 text-primary"
          value={planosPendentes}
          label="Planos Pendentes"
          accent={planosAtrasados > 0 ? 'border-l-destructive' : 'border-l-primary'}
          badge={planosAtrasados > 0 ? <span className="text-[9px] font-bold text-destructive bg-destructive/10 rounded-full px-1.5 py-0.5">{planosAtrasados} atrasados</span> : undefined}
        />
      </div>

      {/* ── Desafio Banner ───────────────────────────── */}
      {desafioStats.totalComDesafio > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-card to-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <span className="text-lg">🎯</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">Desafio nas Metas Atingidas</h3>
              <p className="text-[11px] text-muted-foreground">Percentual das metas batidas que também bateram o desafio</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-foreground">{desafioPct}%</p>
              <p className="text-[10px] text-muted-foreground">conversão para desafio</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-xl font-extrabold text-foreground">{desafioStats.totalComDesafio}</p>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Com Desafio</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-3 text-center">
              <p className="text-xl font-extrabold text-primary">{desafioStats.metasAtingidas}</p>
              <p className="text-[9px] text-primary font-medium uppercase tracking-wider mt-0.5">Metas Batidas</p>
            </div>
            <div className="rounded-xl bg-success/10 p-3 text-center">
              <p className="text-xl font-extrabold text-success">{desafioStats.desafiosAtingidos}</p>
              <p className="text-[9px] text-success font-medium uppercase tracking-wider mt-0.5">Bateram Desafio</p>
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar value={desafioPct} color={desafioPct >= 80 ? 'green' : desafioPct >= 50 ? 'yellow' : 'red'} className="h-2" />
          </div>
        </div>
      )}

      {/* ── Charts Row ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Desempenho por Indicador</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => navigate('/admin/desempenho')}>
              Ver tudo <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="indicador" tick={{ fontSize: 11 }} width={55} />
                <Tooltip formatter={(v: number, _n: string, p: any) => [`${v}% atingiram`, p.payload.nome]} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                <ReferenceLine x={90} stroke="hsl(var(--destructive))" strokeDasharray="5 5" />
                <ReferenceLine x={100} stroke="hsl(var(--success))" strokeDasharray="5 5" />
                <Bar dataKey="media" radius={[0, 6, 6, 0]} barSize={18}>
                  {barData.map((entry, i) => <Cell key={i} fill={getBarColor(entry.media)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart icon={<BarChart3 className="h-8 w-8" />} text="Sem dados para esta data" />
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-foreground">Feedbacks por Urgência</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => navigate('/admin/feedbacks')}>
              Ver <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          {pieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[entry.name] ?? '#94a3b8'} />)}
                  </Pie>
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">{pieTotal}</text>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[d.name] }} />
                    <span className="text-[11px] text-muted-foreground">{d.label} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart icon={<MessageSquare className="h-8 w-8" />} text="Nenhum feedback aberto" />
          )}
        </div>
      </div>

      {/* ── Bottom Panels ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Critical indicators */}
        {topCritical.length > 0 && (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <PanelHeader icon={<TrendingDown className="h-4 w-4 text-destructive" />} title="Indicadores Críticos" onAction={() => navigate('/admin/desempenho')} />
            <div className="space-y-3">
              {topCritical.map((c, i) => (
                <div key={i} onClick={() => navigate('/admin/desempenho')} className="flex items-center gap-3 cursor-pointer hover:bg-muted/30 rounded-lg p-2 -mx-2 transition-colors active:scale-[0.98]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary font-mono">{c.codigo}</span>
                      <span className="text-xs font-medium text-foreground truncate">{c.nome}</span>
                    </div>
                    <ProgressBar value={c.media} color="red" className="h-1.5" />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-destructive">{c.media}%</p>
                    <p className="text-[10px] text-muted-foreground">{c.afetados} reg.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent feedbacks */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <PanelHeader icon={<MessageSquare className="h-4 w-4 text-amber-500" />} title="Feedbacks Recentes" onAction={() => navigate('/admin/feedbacks')} />
          {recentFeedbacks.length > 0 ? (
            <div className="space-y-2.5">
              {recentFeedbacks.map(f => (
                <div
                  key={f.id}
                  onClick={() => navigate('/admin/feedbacks')}
                  className={cn(
                    'rounded-xl border p-3 transition-all cursor-pointer hover:shadow-sm active:scale-[0.98]',
                    f.urgencia === 'critica' ? 'border-destructive/30 bg-destructive/5' : 'border-border/50 hover:border-border'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate max-w-[150px]">{f.users?.nome ?? '—'}</span>
                    <StatusBadge status={f.urgencia} />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{f.titulo}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart icon={<MessageSquare className="h-6 w-6" />} text="Nenhum feedback aberto" small />
          )}
        </div>

        {/* Late plans */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <PanelHeader icon={<Clock className="h-4 w-4 text-destructive" />} title="Planos Atrasados" onAction={() => navigate('/admin/planos-de-acao')} />
          {latePlans.length > 0 ? (
            <div className="space-y-2.5">
              {latePlans.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigate('/admin/planos-de-acao')}
                  className={cn(
                    'rounded-xl border p-3 transition-all cursor-pointer hover:shadow-sm active:scale-[0.98]',
                    p.diasAtraso > 3 ? 'border-destructive/30 bg-destructive/5' : 'border-border/50 hover:border-border'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate max-w-[150px]">{p.users?.nome ?? '—'}</span>
                    <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-bold">
                      {p.diasAtraso}d atraso
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{p.descricao_acao}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Prazo: {p.prazo ? format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Zap className="h-6 w-6 text-success mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum plano atrasado 🎉</p>
            </div>
          )}
        </div>
      </div>

      {/* Bônus Estimado — detalhamento */}
      <Dialog open={bonusDetailOpen} onOpenChange={setBonusDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bônus Estimado · {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</DialogTitle>
            <DialogDescription>
              Total previsto: <span className="font-semibold text-foreground">{fmtBRL(bonusTotalMes)}</span>
              {' · '}Considera todos os colaboradores ativos do sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resumo dos dois componentes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bônus por Meta</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{fmtBRL(bonusMes)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Caixas Batidas</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{fmtBRL(caixasBatidasTotal)}</p>
              </div>
            </div>

            {/* Breakdown por indicador */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Bônus por Meta — detalhamento por indicador
              </h4>
              {bonusMesData.breakdown.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Nenhuma meta atingida no mês até o momento.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-semibold text-muted-foreground text-xs">Indicador</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground text-xs text-right">Beneficiários</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground text-xs text-right">Desafios</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground text-xs text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bonusMesData.breakdown.map(row => (
                        <tr key={row.indicator_id} className="hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">{row.codigo}</div>
                            <div className="text-xs text-muted-foreground">{row.nome}</div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{row.beneficiarios}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {row.desafiosAtingidos > 0 ? row.desafiosAtingidos : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">
                            {fmtBRL(row.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/40 font-semibold">
                      <tr>
                        <td className="px-3 py-2 text-foreground">Total Bônus por Meta</td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">
                          {bonusMesData.breakdown.reduce((s, r) => s + r.beneficiarios, 0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">
                          {bonusMesData.breakdown.reduce((s, r) => s + r.desafiosAtingidos, 0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">{fmtBRL(bonusMes)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Cálculo baseado nas metas mensais ativas, agregando o desempenho do mês por colaborador.
              Para cada meta atingida, soma-se o valor de bonificação; quando o desafio também é atingido, soma-se o bônus de desafio.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────── */

function HeroStat({ icon, value, label, sub, isSmall, onClick, loading }: { icon: React.ReactNode; value: string | number; label: string; sub?: string; isSmall?: boolean; onClick?: () => void; loading?: boolean }) {
  const content = (
    <>
      <div className="flex items-center justify-center gap-1 text-white/40 mb-1.5">
        {icon}
        {loading && <Loader2 className="h-3 w-3 animate-spin text-white/60" />}
      </div>
      <p className={cn('font-extrabold text-white leading-none', isSmall ? 'text-base' : 'text-xl')}>{value}</p>
      <p className="text-[8px] text-white/50 font-medium uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>}
    </>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="py-4 px-4 text-center transition-colors hover:bg-white/5 active:bg-white/10 cursor-pointer"
      >
        {content}
      </button>
    );
  }
  return <div className="py-4 px-4 text-center">{content}</div>;
}

function QuickCard({ onClick, icon, iconClass, value, label, accent, badge, isText }: {
  onClick: () => void; icon: React.ReactNode; iconClass: string; value: string | number;
  label: string; accent: string; badge?: React.ReactNode; isText?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-2xl border bg-card p-4 shadow-sm border-l-[3px] transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] text-left group cursor-pointer',
        accent
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', iconClass)}>
          {icon}
        </div>
        {badge && <div>{badge}</div>}
      </div>
      <p className={cn('font-extrabold text-foreground leading-none', isText ? 'text-lg' : 'text-2xl')}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wider">{label}</p>
    </button>
  );
}

function PanelHeader({ icon, title, onAction }: { icon: React.ReactNode; title: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={onAction}>
        Ver <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  );
}

function EmptyChart({ icon, text, small }: { icon: React.ReactNode; text: string; small?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-muted-foreground/30', small ? 'py-8' : 'py-16')}>
      {icon}
      <p className="text-sm text-muted-foreground mt-2">{text}</p>
    </div>
  );
}
