import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface IndicatorRow {
  id: string; codigo: string; nome: string; categoria: string;
  unidade_medida: string; descricao: string; applies_to_worker_type: string;
  ativo: boolean; created_at: string;
}

export function useIndicadores(filters?: { ativo?: string }) {
  return useQuery({
    queryKey: ['indicators', filters],
    queryFn: async () => {
      let q = supabase.from('indicators').select('*').order('nome');
      if (filters?.ativo === 'true') q = q.eq('ativo', true);
      if (filters?.ativo === 'false') q = q.eq('ativo', false);
      const { data, error } = await q;
      if (error) throw error;
      return data as IndicatorRow[];
    },
  });
}

export function useIndicadoresByWorkerType(workerType?: string) {
  return useQuery({
    queryKey: ['indicators', 'byType', workerType],
    queryFn: async () => {
      const { data, error } = await supabase.from('indicators').select('*')
        .eq('ativo', true).in('applies_to_worker_type', [workerType!, 'ambos']).order('nome');
      if (error) throw error;
      return data as IndicatorRow[];
    },
    enabled: !!workerType,
  });
}

export function useCreateIndicador() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async (ind: Omit<IndicatorRow, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('indicators').insert(ind).select().single();
      if (error) throw error; return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['indicators'] }); toast({ title: 'Indicador salvo com sucesso!' }); },
    onError: (error: any) => {
      const msg = error?.message?.includes('indicators_codigo_key')
        ? 'Já existe um indicador com este código.'
        : 'Erro ao salvar indicador.';
      toast({ title: msg, variant: 'destructive' });
    },
  });
}

export function useUpdateIndicador() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...ind }: Partial<IndicatorRow> & { id: string }) => {
      const { error } = await supabase.from('indicators').update(ind).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['indicators'] }); toast({ title: 'Indicador salvo!' }); },
    onError: () => { toast({ title: 'Erro ao salvar.', variant: 'destructive' }); },
  });
}

export function useToggleIndicadorAtivo() {
  const qc = useQueryClient(); const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('indicators').update({ ativo: !ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['indicators'] }); toast({ title: 'Status atualizado!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar.', variant: 'destructive' }); },
  });
}
