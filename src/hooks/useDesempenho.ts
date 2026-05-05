import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DesempenhoRow {
  id: string; user_id: string; indicator_id: string; data_referencia: string;
  valor: number; meta: number | null; percentual_atingimento: number | null;
  status: string | null; origem_dado: string; created_at: string; updated_at: string;
  mapa_numero: string | null;
  desafio: number | null; status_desafio: string | null;
  users: { nome: string; worker_type: string | null; matricula: string; unidade_id: string | null } | null;
  indicators: { nome: string; codigo: string; periodicidade?: 'diario' | 'mensal' } | null;
}

export function useDesempenhoDiario(dataInicio: string, dataFim: string, filters?: { unidade_id?: string; worker_type?: string; user_id?: string; indicator_id?: string }) {
  return useQuery({
    queryKey: ['user_indicator_daily', dataInicio, dataFim, filters],
    queryFn: async () => {
      // Pré-filtrar IDs de usuários no servidor quando há filtro de unidade/worker_type.
      // Isso reduz drasticamente o payload em vez de baixar tudo e filtrar no cliente.
      let preFilteredUserIds: string[] | null = null;
      if (filters?.unidade_id || filters?.worker_type) {
        let uq = supabase.from('users').select('id');
        if (filters?.unidade_id) uq = uq.eq('unidade_id', filters.unidade_id);
        if (filters?.worker_type) uq = uq.eq('worker_type', filters.worker_type);
        const { data: uList, error: uErr } = await uq;
        if (uErr) throw uErr;
        preFilteredUserIds = (uList ?? []).map(u => u.id);
        if (preFilteredUserIds.length === 0) return [] as DesempenhoRow[];
      }

      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let from = 0;

      // Indicadores mensais são gravados no dia 01 do mês de referência.
      // Para que qualquer dia escolhido dentro de um mês traga o registro mensal,
      // expandimos o range no servidor para cobrir mês cheio das pontas e
      // depois filtramos no cliente: diários respeitam o intervalo original,
      // mensais são mantidos por interseção de mês.
      const startOfMonth = (d: string) => `${d.slice(0, 7)}-01`;
      const endOfMonth = (d: string) => {
        const [y, m] = d.split('-').map(Number);
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return `${d.slice(0, 7)}-${String(last).padStart(2, '0')}`;
      };
      const fetchFrom = startOfMonth(dataInicio);
      const fetchTo = endOfMonth(dataFim);

      while (true) {
        let q = supabase.from('user_indicator_daily')
          .select('*, users(nome, worker_type, matricula, unidade_id), indicators(nome, codigo, periodicidade)')
          .gte('data_referencia', fetchFrom)
          .lte('data_referencia', fetchTo)
          .order('data_referencia', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (filters?.user_id) q = q.eq('user_id', filters.user_id);
        if (filters?.indicator_id) q = q.eq('indicator_id', filters.indicator_id);
        if (preFilteredUserIds) {
          // Supabase aceita até ~1000 ids confortavelmente; em caso de mais,
          // dividir em chunks. Aqui mantemos simples (unidades raramente passam disso).
          q = q.in('user_id', preFilteredUserIds);
        }
        const { data: page, error } = await q;
        if (error) throw error;
        if (!page || page.length === 0) break;
        allRows = allRows.concat(page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Pós-filtro: diários estritamente no intervalo; mensais por interseção de mês.
      const inicioYM = dataInicio.slice(0, 7);
      const fimYM = dataFim.slice(0, 7);
      const filtered = (allRows as DesempenhoRow[]).filter(r => {
        const isMonthly = r.indicators?.periodicidade === 'mensal';
        if (isMonthly) {
          const ym = (r.data_referencia ?? '').slice(0, 7);
          return ym >= inicioYM && ym <= fimYM;
        }
        return r.data_referencia >= dataInicio && r.data_referencia <= dataFim;
      });
      return filtered;
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Versão enxuta para dashboards: pula o join `users` e baixa apenas os
 * campos necessários para contagens / gráficos (status, indicator, datas,
 * desafio). Reduz dramaticamente o payload em períodos longos.
 */
export interface DesempenhoSlim {
  user_id: string;
  indicator_id: string;
  data_referencia: string;
  valor: number;
  status: string | null;
  status_desafio: string | null;
  desafio: number | null;
  indicators: { nome: string; codigo: string; periodicidade?: 'diario' | 'mensal' } | null;
}
export function useDesempenhoDashboard(
  dataInicio: string,
  dataFim: string,
  filters?: { unidade_id?: string; worker_type?: string },
) {
  return useQuery({
    queryKey: ['user_indicator_daily_slim', dataInicio, dataFim, filters],
    queryFn: async () => {
      let preFilteredUserIds: string[] | null = null;
      if (filters?.unidade_id || filters?.worker_type) {
        let uq = supabase.from('users').select('id').eq('ativo', true);
        if (filters?.unidade_id) uq = uq.eq('unidade_id', filters.unidade_id);
        if (filters?.worker_type) uq = uq.eq('worker_type', filters.worker_type);
        const { data: uList, error: uErr } = await uq;
        if (uErr) throw uErr;
        preFilteredUserIds = (uList ?? []).map(u => u.id);
        if (preFilteredUserIds.length === 0) return [] as DesempenhoSlim[];
      }
      // Lookup leve (cached) de indicadores: evita o join pesado por linha.
      const { data: indicatorsList, error: indErr } = await supabase
        .from('indicators')
        .select('id, nome, codigo, periodicidade');
      if (indErr) throw indErr;
      const indMap = new Map<string, { nome: string; codigo: string; periodicidade?: 'diario' | 'mensal' }>();
      for (const i of indicatorsList ?? []) {
        indMap.set(i.id, { nome: i.nome, codigo: i.codigo, periodicidade: i.periodicidade as any });
      }
      const monthlyIds = new Set(
        (indicatorsList ?? []).filter(i => i.periodicidade === 'mensal').map(i => i.id),
      );

      // Query enxuta: SEM join, só colunas necessárias, e janela exata.
      // Diários: [dataInicio, dataFim]. Mensais: dia 01 dos meses do intervalo.
      const inicioYM = dataInicio.slice(0, 7);
      const fimYM = dataFim.slice(0, 7);
      const monthlyDates: string[] = [];
      {
        const cur = new Date(inicioYM + '-01T00:00:00Z');
        const end = new Date(fimYM + '-01T00:00:00Z');
        while (cur <= end) {
          monthlyDates.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-01`);
          cur.setUTCMonth(cur.getUTCMonth() + 1);
        }
      }

      const PAGE_SIZE = 1000;
      const fetchPaged = async (build: (q: any) => any): Promise<any[]> => {
        const out: any[] = [];
        let from = 0;
        while (true) {
          let q = supabase
            .from('user_indicator_daily')
            .select('user_id, indicator_id, data_referencia, valor, status, status_desafio, desafio');
          q = build(q);
          if (preFilteredUserIds) q = q.in('user_id', preFilteredUserIds);
          q = q.range(from, from + PAGE_SIZE - 1);
          const { data: page, error } = await q;
          if (error) throw error;
          if (!page || page.length === 0) break;
          out.push(...page);
          if (page.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
        return out;
      };

      // Diários: estritamente no intervalo.
      const dailyRows = await fetchPaged(q =>
        q.gte('data_referencia', dataInicio).lte('data_referencia', dataFim),
      );
      // Mensais: só os dias 01 do(s) mês(es) cobertos.
      const monthlyRows = monthlyDates.length
        ? await fetchPaged(q => q.in('data_referencia', monthlyDates))
        : [];

      const merged = [
        ...dailyRows.filter(r => !monthlyIds.has(r.indicator_id)),
        ...monthlyRows.filter(r => monthlyIds.has(r.indicator_id)),
      ];

      // Anexa metadados de indicador a partir do mapa local.
      return merged.map(r => ({
        ...r,
        indicators: indMap.get(r.indicator_id) ?? null,
      })) as DesempenhoSlim[];
    },
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useDesempenhoPorColaborador(userId: string | undefined, dataInicio: string, dataFim: string) {
  return useQuery({
    queryKey: ['user_indicator_daily', 'byUser', userId, dataInicio, dataFim],
    queryFn: async () => {
      const startOfMonth = (d: string) => `${d.slice(0, 7)}-01`;
      const endOfMonth = (d: string) => {
        const [y, m] = d.split('-').map(Number);
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return `${d.slice(0, 7)}-${String(last).padStart(2, '0')}`;
      };
      const { data, error } = await supabase.from('user_indicator_daily')
        .select('*, indicators(nome, codigo, periodicidade)')
        .eq('user_id', userId!)
        .gte('data_referencia', startOfMonth(dataInicio)).lte('data_referencia', endOfMonth(dataFim))
        .order('data_referencia', { ascending: false });
      if (error) throw error;
      const inicioYM = dataInicio.slice(0, 7);
      const fimYM = dataFim.slice(0, 7);
      return (data ?? []).filter((r: any) => {
        const isMonthly = r.indicators?.periodicidade === 'mensal';
        if (isMonthly) {
          const ym = (r.data_referencia ?? '').slice(0, 7);
          return ym >= inicioYM && ym <= fimYM;
        }
        return r.data_referencia >= dataInicio && r.data_referencia <= dataFim;
      });
    },
    enabled: !!userId,
  });
}

/**
 * Versão ultra enxuta usada nos cards de bônus/desafio do Dashboard.
 * Retorna apenas as 4 colunas necessárias para agregação no cliente,
 * sem join, com filtros de unidade/worker_type aplicados no servidor.
 */
export interface DesempenhoMesSlim {
  user_id: string;
  indicator_id: string;
  data_referencia: string;
  valor: number;
}
export function useDesempenhoMesSlim(
  dataInicio: string,
  dataFim: string,
  filters?: { unidade_id?: string; worker_type?: string },
) {
  return useQuery({
    queryKey: ['user_indicator_daily_mes_slim', dataInicio, dataFim, filters],
    queryFn: async () => {
      let preFilteredUserIds: string[] | null = null;
      if (filters?.unidade_id || filters?.worker_type) {
        let uq = supabase.from('users').select('id').eq('ativo', true);
        if (filters?.unidade_id) uq = uq.eq('unidade_id', filters.unidade_id);
        if (filters?.worker_type) uq = uq.eq('worker_type', filters.worker_type);
        const { data: uList, error: uErr } = await uq;
        if (uErr) throw uErr;
        preFilteredUserIds = (uList ?? []).map(u => u.id);
        if (preFilteredUserIds.length === 0) return [] as DesempenhoMesSlim[];
      }
      const PAGE_SIZE = 1000;
      const out: DesempenhoMesSlim[] = [];
      let from = 0;
      while (true) {
        let q = supabase
          .from('user_indicator_daily')
          .select('user_id, indicator_id, data_referencia, valor')
          .gte('data_referencia', dataInicio)
          .lte('data_referencia', dataFim)
          .range(from, from + PAGE_SIZE - 1);
        if (preFilteredUserIds) q = q.in('user_id', preFilteredUserIds);
        const { data: page, error } = await q;
        if (error) throw error;
        if (!page || page.length === 0) break;
        out.push(...(page as DesempenhoMesSlim[]));
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return out;
    },
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

function calcStatus(valor: number, meta: number) {
  const pct = meta > 0 ? (valor / meta) * 100 : 0;
  const status = pct >= 100 ? 'acima_meta' : pct >= 90 ? 'dentro_meta' : 'abaixo_meta';
  return { percentual_atingimento: Math.round(pct * 10) / 10, status };
}

export function useCreateLancamento() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (row: { user_id: string; indicator_id: string; data_referencia: string; valor: number; meta: number; origem_dado: string }) => {
      const { percentual_atingimento, status } = calcStatus(row.valor, row.meta);
      const { data, error } = await supabase.from('user_indicator_daily').upsert(
        { ...row, percentual_atingimento, status, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,indicator_id,data_referencia,mapa_numero' }
      ).select().single();
      if (error) throw error; return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user_indicator_daily'] }); toast({ title: 'Lançamento salvo!' }); },
    onError: () => { toast({ title: 'Erro ao salvar lançamento.', variant: 'destructive' }); },
  });
}

export function useUpdateLancamento() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, valor, meta }: { id: string; valor: number; meta: number }) => {
      const { percentual_atingimento, status } = calcStatus(valor, meta);
      const { error } = await supabase.from('user_indicator_daily').update({ valor, meta, percentual_atingimento, status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user_indicator_daily'] }); toast({ title: 'Lançamento atualizado!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar.', variant: 'destructive' }); },
  });
}

export function useDeleteLancamento() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_indicator_daily').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user_indicator_daily'] }); toast({ title: 'Lançamento excluído!' }); },
    onError: () => { toast({ title: 'Erro ao excluir.', variant: 'destructive' }); },
  });
}

export function useBatchCreateLancamentos() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (rows: { user_id: string; indicator_id: string; data_referencia: string; valor: number; meta: number; origem_dado: string; desafio?: number | null; status_desafio?: string | null; valor_financeiro?: number | null }[]) => {
      const prepared = rows.map(r => {
        const { percentual_atingimento, status } = calcStatus(r.valor, r.meta);
        return { ...r, percentual_atingimento, status, updated_at: new Date().toISOString() };
      });
      const { error } = await supabase.from('user_indicator_daily').upsert(prepared, { onConflict: 'user_id,indicator_id,data_referencia,mapa_numero' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user_indicator_daily'] }); toast({ title: 'Lançamento em lote salvo!' }); },
    onError: () => { toast({ title: 'Erro no lançamento em lote.', variant: 'destructive' }); },
  });
}
