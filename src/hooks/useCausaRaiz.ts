import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CausaRaizRow {
  id: string; user_id: string; indicator_id: string; data_referencia: string;
  descricao_problema: string; categoria_causa: string; causa_raiz: string;
  impacto: string; created_at: string;
  users: { nome: string; worker_type: string | null } | null;
  indicators: { nome: string; codigo: string } | null;
}

export interface ActionPlanRow {
  id: string; root_cause_id: string; responsavel_user_id: string;
  descricao_acao: string; prazo: string | null; status: string;
  observacoes: string; created_at: string; updated_at: string;
}

export function useCausaRaiz(filters?: { user_id?: string; indicator_id?: string; categoria_causa?: string }) {
  return useQuery({
    queryKey: ['root_cause_records', filters],
    queryFn: async () => {
      let q = (supabase.from('root_cause_records' as any) as any)
        .select('*, users(nome, worker_type), indicators(nome, codigo)')
        .order('created_at', { ascending: false });
      if (filters?.user_id) q = q.eq('user_id', filters.user_id);
      if (filters?.indicator_id) q = q.eq('indicator_id', filters.indicator_id);
      if (filters?.categoria_causa) q = q.eq('categoria_causa', filters.categoria_causa);
      const { data, error } = await q;
      if (error) throw error;
      return data as CausaRaizRow[];
    },
  });
}

export function useCausaRaizPorColaborador(userId?: string) {
  return useQuery({
    queryKey: ['root_cause_records', 'byUser', userId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('root_cause_records' as any) as any)
        .select('*, indicators(nome, codigo)')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CausaRaizRow[];
    },
    enabled: !!userId,
  });
}

export function useActionPlansByCause(rootCauseId?: string) {
  return useQuery({
    queryKey: ['action_plans', 'byCause', rootCauseId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('action_plans' as any) as any)
        .select('*')
        .eq('root_cause_id', rootCauseId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ActionPlanRow[];
    },
    enabled: !!rootCauseId,
  });
}

export function useCreateCausaRaiz() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (row: { user_id: string; indicator_id: string; data_referencia: string; descricao_problema: string; categoria_causa: string; causa_raiz: string; impacto: string }) => {
      const { data, error } = await (supabase.from('root_cause_records' as any) as any)
        .insert(row).select().single();
      if (error) throw error;
      return data as CausaRaizRow;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['root_cause_records'] }); },
    onError: () => { toast({ title: 'Erro ao registrar causa raiz.', variant: 'destructive' }); },
  });
}

export function useUpdateCausaRaiz() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; indicator_id?: string; data_referencia?: string; descricao_problema?: string; categoria_causa?: string; causa_raiz?: string; impacto?: string }) => {
      const { error } = await (supabase.from('root_cause_records' as any) as any)
        .update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['root_cause_records'] }); toast({ title: 'Causa raiz atualizada!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar.', variant: 'destructive' }); },
  });
}

export function useCreateActionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { root_cause_id: string; responsavel_user_id: string; descricao_acao: string; prazo: string | null }) => {
      const { data, error } = await (supabase.from('action_plans' as any) as any)
        .insert(row).select().single();
      if (error) throw error;
      return data as ActionPlanRow;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['action_plans'] }); },
    onError: () => { },
  });
}
