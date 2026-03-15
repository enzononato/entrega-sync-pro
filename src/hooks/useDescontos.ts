import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DeductionRow {
  id: string;
  user_id: string;
  indicator_id: string;
  data_referencia: string;
  valor_meta: number;
  valor_realizado: number;
  percentual_atingimento: number;
  valor_desconto: number;
  motivo: string;
  created_at: string;
  created_by: string | null;
}

export interface DeductionWithRelations extends DeductionRow {
  users: { nome: string; worker_type: string | null } | null;
  indicators: { nome: string; codigo: string } | null;
}

export function useDescontosColaborador(userId?: string, days = 30) {
  return useQuery({
    queryKey: ['incentive_deductions', 'colaborador', userId, days],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('incentive_deductions' as any) as any)
        .select('*, indicators(nome, codigo)')
        .eq('user_id', userId!)
        .order('data_referencia', { ascending: false })
        .limit(days);
      if (error) throw error;
      return data as unknown as (DeductionRow & { indicators: { nome: string; codigo: string } | null })[];
    },
    enabled: !!userId,
  });
}

export function useDescontosAdmin(data_referencia?: string) {
  return useQuery({
    queryKey: ['incentive_deductions', 'admin', data_referencia],
    queryFn: async () => {
      let q = (supabase.from('incentive_deductions' as any) as any)
        .select('*, users(nome, worker_type), indicators(nome, codigo)')
        .order('data_referencia', { ascending: false });
      if (data_referencia) q = q.eq('data_referencia', data_referencia);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data as unknown as DeductionWithRelations[];
    },
  });
}

export function useCreateDesconto() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (row: {
      user_id: string;
      indicator_id: string;
      data_referencia: string;
      valor_meta: number;
      valor_realizado: number;
      percentual_atingimento: number;
      valor_desconto: number;
      motivo: string;
      created_by?: string;
    }) => {
      const { data, error } = await (supabase
        .from('incentive_deductions' as any) as any)
        .upsert(row, { onConflict: 'user_id,indicator_id,data_referencia' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incentive_deductions'] });
      toast({ title: 'Desconto registrado!' });
    },
    onError: () => {
      toast({ title: 'Erro ao registrar desconto.', variant: 'destructive' });
    },
  });
}

export function useDeleteDesconto() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from('incentive_deductions' as any) as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incentive_deductions'] });
      toast({ title: 'Desconto removido!' });
    },
    onError: () => {
      toast({ title: 'Erro ao remover desconto.', variant: 'destructive' });
    },
  });
}
