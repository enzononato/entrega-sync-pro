import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RouteWithUnit {
  id: string;
  unidade_id: string;
  nome: string;
  codigo: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
  units: { nome: string } | null;
}

export function useRotas(unidadeId?: string) {
  return useQuery({
    queryKey: ['routes', unidadeId],
    queryFn: async () => {
      let query = supabase.from('routes').select('*, units(nome)').order('nome');
      if (unidadeId) query = query.eq('unidade_id', unidadeId);
      const { data, error } = await query;
      if (error) throw error;
      return data as RouteWithUnit[];
    },
  });
}

export function useRota(id: string | undefined) {
  return useQuery({
    queryKey: ['routes', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('routes').select('*, units(nome)').eq('id', id!).single();
      if (error) throw error;
      return data as RouteWithUnit;
    },
    enabled: !!id,
  });
}

export function useCreateRota() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (route: { unidade_id: string; nome: string; codigo: string; descricao: string; ativo: boolean }) => {
      const { data, error } = await supabase.from('routes').insert(route).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast({ title: 'Rota salva com sucesso!' }); },
    onError: () => { toast({ title: 'Erro ao salvar. Tente novamente.', variant: 'destructive' }); },
  });
}

export function useUpdateRota() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...route }: { id: string; unidade_id?: string; nome?: string; codigo?: string; descricao?: string; ativo?: boolean }) => {
      const { data, error } = await supabase.from('routes').update(route).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast({ title: 'Rota salva com sucesso!' }); },
    onError: () => { toast({ title: 'Erro ao salvar. Tente novamente.', variant: 'destructive' }); },
  });
}

export function useToggleRotaAtivo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('routes').update({ ativo: !ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast({ title: 'Status atualizado!' }); },
    onError: () => { toast({ title: 'Erro ao atualizar status.', variant: 'destructive' }); },
  });
}
