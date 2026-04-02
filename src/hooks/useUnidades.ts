import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Unit } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useUnidades() {
  return useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').order('nome');
      if (error) throw error;
      return data as Unit[];
    },
  });
}

export function useUnidade(id: string | undefined) {
  return useQuery({
    queryKey: ['units', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as Unit;
    },
    enabled: !!id,
  });
}

export function useCreateUnidade() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (unit: Omit<Unit, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('units').insert(unit).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] });
      toast({ title: 'Unidade salva com sucesso!' });
    },
    onError: (err: any) => {
      console.error('Erro ao criar unidade:', err);
      toast({ title: 'Erro ao salvar unidade', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    },
  });
}

export function useUpdateUnidade() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...unit }: Partial<Unit> & { id: string }) => {
      const { data, error } = await supabase.from('units').update(unit).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] });
      toast({ title: 'Unidade salva com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao salvar. Tente novamente.', variant: 'destructive' });
    },
  });
}

export function useToggleUnidadeAtivo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('units').update({ ativo: !ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] });
      toast({ title: 'Status atualizado!' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar status.', variant: 'destructive' });
    },
  });
}
