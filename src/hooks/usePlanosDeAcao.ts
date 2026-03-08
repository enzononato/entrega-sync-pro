import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ActionPlanWithRelations {
  id: string; root_cause_id: string; responsavel_user_id: string;
  descricao_acao: string; prazo: string | null; status: string;
  observacoes: string; created_at: string; updated_at: string;
  users: { nome: string; worker_type: string | null } | null;
  root_cause_records: { descricao_problema: string; causa_raiz: string; data_referencia: string; indicators: { nome: string; codigo: string } | null } | null;
}

export function usePlanosDeAcao(filters?: { status?: string; user_id?: string; atrasados?: boolean }) {
  return useQuery({
    queryKey: ['action_plans', filters],
    queryFn: async () => {
      let q = (supabase.from('action_plans' as any) as any)
        .select('*, users(nome, worker_type), root_cause_records(descricao_problema, causa_raiz, data_referencia, indicators(nome, codigo))')
        .order('created_at', { ascending: false });
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.user_id) q = q.eq('responsavel_user_id', filters.user_id);
      const { data, error } = await q;
      if (error) throw error;
      let result = data as unknown as ActionPlanWithRelations[];
      if (filters?.atrasados) {
        const today = new Date().toISOString().split('T')[0];
        result = result.filter(p => p.prazo && p.prazo < today && !['concluido', 'cancelado'].includes(p.status));
      }
      return result;
    },
  });
}

export function usePlanosDoColaborador(userId?: string) {
  return useQuery({
    queryKey: ['action_plans', 'byUser', userId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('action_plans' as any) as any)
        .select('*, root_cause_records(descricao_problema, causa_raiz, data_referencia, indicators(nome, codigo))')
        .eq('responsavel_user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as ActionPlanWithRelations[];
    },
    enabled: !!userId,
  });
}

export function useCreatePlano() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (row: { root_cause_id: string; responsavel_user_id: string; descricao_acao: string; prazo: string | null; observacoes?: string }) => {
      const { data, error } = await (supabase.from('action_plans' as any) as any).insert(row).select().single();
      if (error) throw error; return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['action_plans'] }); toast({ title: 'Plano criado!' }); },
    onError: () => { toast({ title: 'Erro ao criar plano.', variant: 'destructive' }); },
  });
}

export function useUpdatePlano() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; descricao_acao?: string; prazo?: string | null; status?: string; observacoes?: string }) => {
      const { error } = await (supabase.from('action_plans' as any) as any).update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['action_plans'] }); toast({ title: 'Plano atualizado!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar.', variant: 'destructive' }); },
  });
}

export function useDeletePlano() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('action_plans' as any) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['action_plans'] }); toast({ title: 'Plano excluído!' }); },
    onError: () => { toast({ title: 'Erro ao excluir.', variant: 'destructive' }); },
  });
}
