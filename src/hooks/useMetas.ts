import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GoalWithRelations {
  id: string; indicator_id: string; unidade_id: string | null;
  worker_type: string | null; user_id: string | null;
  valor_meta: number; valor_bonificacao: number; periodo_tipo: string; vigencia_inicio: string;
  vigencia_fim: string | null; ativo: boolean; created_at: string;
  indicators: { nome: string; codigo: string; unidade_medida?: string } | null;
  units: { nome: string } | null;
  users: { nome: string } | null;
}

export function useMetas(filters?: { indicator_id?: string; worker_type?: string; unidade_id?: string; ativo?: string; vigentes?: boolean }) {
  return useQuery({
    queryKey: ['goals', filters],
    queryFn: async () => {
      let q = supabase.from('goals').select('*, indicators(nome, codigo, unidade_medida), units(nome), users(nome)').order('created_at', { ascending: false });
      if (filters?.indicator_id) q = q.eq('indicator_id', filters.indicator_id);
      if (filters?.worker_type) q = q.eq('worker_type', filters.worker_type);
      if (filters?.unidade_id) q = q.eq('unidade_id', filters.unidade_id);
      if (filters?.ativo === 'true') q = q.eq('ativo', true);
      if (filters?.ativo === 'false') q = q.eq('ativo', false);
      if (filters?.vigentes) {
        const today = new Date().toISOString().split('T')[0];
        q = q.eq('ativo', true).lte('vigencia_inicio', today).or(`vigencia_fim.is.null,vigencia_fim.gte.${today}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as GoalWithRelations[];
    },
  });
}

export function useCreateMeta() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (goal: { indicator_id: string; unidade_id?: string | null; worker_type?: string | null; user_id?: string | null; valor_meta: number; valor_bonificacao?: number; periodo_tipo: string; vigencia_inicio: string; vigencia_fim?: string | null; ativo: boolean }) => {
      const { data, error } = await supabase.from('goals').insert(goal).select().single();
      if (error) throw error; return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast({ title: 'Meta salva com sucesso!' }); },
    onError: () => { toast({ title: 'Erro ao salvar meta.', variant: 'destructive' }); },
  });
}

export function useUpdateMeta() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...goal }: { id: string; indicator_id?: string; unidade_id?: string | null; worker_type?: string | null; user_id?: string | null; valor_meta?: number; valor_bonificacao?: number; periodo_tipo?: string; vigencia_inicio?: string; vigencia_fim?: string | null; ativo?: boolean }) => {
      const { error } = await supabase.from('goals').update(goal).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast({ title: 'Meta atualizada!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar.', variant: 'destructive' }); },
  });
}

export function useToggleMetaAtivo() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('goals').update({ ativo: !ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast({ title: 'Status atualizado!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar.', variant: 'destructive' }); },
  });
}
