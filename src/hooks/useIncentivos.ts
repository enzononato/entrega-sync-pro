import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface IncentiveRuleWithRelations {
  id: string; indicator_id: string; worker_type: string; unidade_id: string | null;
  peso: number; meta: number; valor_minimo: number; valor_maximo: number;
  regra_json: Record<string, unknown>; vigencia_inicio: string;
  vigencia_fim: string | null; ativo: boolean; created_at: string;
  indicators: { nome: string } | null; units: { nome: string } | null;
}

export function useIncentivos(filters?: { worker_type?: string; indicator_id?: string; unidade_id?: string; ativo?: string }) {
  return useQuery({
    queryKey: ['incentive_rules', filters],
    queryFn: async () => {
      let q = supabase.from('incentive_rules').select('*, indicators(nome), units(nome)').order('created_at', { ascending: false });
      if (filters?.worker_type) q = q.eq('worker_type', filters.worker_type);
      if (filters?.indicator_id) q = q.eq('indicator_id', filters.indicator_id);
      if (filters?.unidade_id) q = q.eq('unidade_id', filters.unidade_id);
      if (filters?.ativo === 'true') q = q.eq('ativo', true);
      if (filters?.ativo === 'false') q = q.eq('ativo', false);
      const { data, error } = await q;
      if (error) throw error;
      return data as IncentiveRuleWithRelations[];
    },
  });
}

export function useCreateIncentivo() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (rule: { indicator_id: string; worker_type: string; unidade_id?: string | null; peso: number; meta: number; valor_minimo: number; valor_maximo: number; regra_json: Record<string, string>; vigencia_inicio: string; vigencia_fim?: string | null; ativo: boolean }) => {
      const { data, error } = await supabase.from('incentive_rules').insert(rule as any).select().single();
      if (error) throw error; return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['incentive_rules'] }); toast({ title: 'Regra salva com sucesso!' }); },
    onError: () => { toast({ title: 'Erro ao salvar.', variant: 'destructive' }); },
  });
}

export function useUpdateIncentivo() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...rule }: Partial<IncentiveRuleWithRelations> & { id: string }) => {
      const { indicators, units, ...data } = rule;
      const { error } = await supabase.from('incentive_rules').update(data as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['incentive_rules'] }); toast({ title: 'Regra atualizada!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar.', variant: 'destructive' }); },
  });
}

export function useToggleIncentivoAtivo() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('incentive_rules').update({ ativo: !ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['incentive_rules'] }); toast({ title: 'Status atualizado!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar.', variant: 'destructive' }); },
  });
}
