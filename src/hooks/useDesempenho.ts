import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

      while (true) {
        let q = supabase.from('user_indicator_daily')
          .select('*, users(nome, worker_type, matricula, unidade_id), indicators(nome, codigo, periodicidade)')
          .gte('data_referencia', dataInicio)
          .lte('data_referencia', dataFim)
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

      return allRows as DesempenhoRow[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useDesempenhoPorColaborador(userId: string | undefined, dataInicio: string, dataFim: string) {
  return useQuery({
    queryKey: ['user_indicator_daily', 'byUser', userId, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_indicator_daily')
        .select('*, indicators(nome, codigo, periodicidade)')
        .eq('user_id', userId!)
        .gte('data_referencia', dataInicio).lte('data_referencia', dataFim)
        .order('data_referencia', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
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
